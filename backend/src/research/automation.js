import { randomUUID } from 'node:crypto';
import { assert, text, transaction, uuid } from './errors.js';
import { AUTOMATION, buildScope, generatedPath, validateAutomation } from './automation-contract.js';
import {testCoverage} from './test-parts.js';

export function createAutomationService({pool,store}) {
  async function inputFor(runId,stage,db=pool) {
    const scope=await store.json(stage.context.scope);
    const cases=(await db.query("SELECT id,content FROM research.test_cases WHERE run_id=$1 AND review_status='approved' AND id=ANY($2::uuid[]) ORDER BY code",[runId,stage.context.case_ids])).rows;
    const requirements=(await db.query("SELECT content FROM research.requirements WHERE run_id=$1 AND review_status='approved' ORDER BY code",[runId])).rows.map(r=>r.content);
    return {scope,test_cases:cases,requirements,generated_paths:cases.map(row=>({test_case_id:row.id,...generatedPath(row.id,scope.module.adapter)}))};
  }
  return {
    inputFor,
    async start(runId,input) {
      uuid(input.inspection_id);
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run && run.status==='completed','Conclua a revisão textual antes de preparar automação.',409);
        const tests=(await db.query("SELECT status FROM research.stages WHERE run_id=$1 AND agent='tests'",[runId])).rows[0];
        assert(tests?.status==='completed','Casos textuais ainda não aprovados.',409);
        const coverage=testCoverage((await db.query('SELECT code,content,review_status FROM research.requirements WHERE run_id=$1',[runId])).rows,(await db.query('SELECT code,content,review_status FROM research.test_cases WHERE run_id=$1',[runId])).rows);
        assert(!coverage.missing_approved.length,'Existem requisitos sem caso aprovado. Complete a geração textual antes da automação.',409);
        assert(!(await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND agent='automation'",[runId])).rowCount,'Automação já preparada. Consulte/replique a execução ou repita a etapa com falha.',409);
        const inspection=(await db.query('SELECT * FROM research.inspections WHERE id=$1 AND code_version_id=$2',[input.inspection_id,run.code_version_id])).rows[0];
        assert(inspection,'Inspeção deve pertencer à versão de código desta execução.',422);
        const scope=buildScope(await store.json(inspection.artifact),text(input.module_root,'Módulo',200),input.target_paths);
        let cases=(await db.query("SELECT id FROM research.test_cases WHERE run_id=$1 AND review_status='approved' ORDER BY code",[runId])).rows.map(r=>r.id);
        if(input.test_case_ids!==undefined) {
          assert(Array.isArray(input.test_case_ids) && new Set(input.test_case_ids).size===input.test_case_ids.length,'Seleção de casos inválida.',422);
          input.test_case_ids.forEach(uuid);
          assert(input.test_case_ids.every(id=>cases.includes(id)),'Caso selecionado não aprovado nesta execução.',422);cases=input.test_case_ids;
        }
        assert(cases.length>0 && cases.length<=20,'Selecione entre 1 e 20 casos aprovados para automação.',422);
        const scopeRef=await store.put(scope),id=randomUUID();
        try {
          await db.query(`INSERT INTO research.stages(id,run_id,agent,position,status,instruction_version,instruction,context)
            VALUES($1,$2,'automation',5,'pending',$3,$4,$5)`,[id,runId,AUTOMATION.version,AUTOMATION.instruction,{scope:scopeRef,inspection_id:inspection.id,case_ids:cases,schema:AUTOMATION.schema}]);
          await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
          await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,after_value,actor)
            VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,'admin')`,[randomUUID(),runId,id,justification,{inspection_id:inspection.id,target_paths:scope.target_paths,test_case_ids:cases}]);
        }catch(error){await store.remove(scopeRef);throw error;}
        return {id,run_id:runId,status:'pending'};
      });
    },
    async persist(db,job,output) {
      for(const artifact of output.artifacts) {
        const {files,...content}=artifact;
        const ref=await store.put(files);
        await db.query(`INSERT INTO research.automated_tests(id,run_id,test_case_id,generation_attempt_id,adapter,content,files,compatibility)
          VALUES($1,$2,$3,$4,$5,$6,$7,'compatible')`,[randomUUID(),job.run.id,artifact.test_case_id,job.attemptId,artifact.adapter,JSON.stringify(content),ref]);
      }
    },
    async list(runId) {
      const rows=(await pool.query('SELECT * FROM research.automated_tests WHERE run_id=$1 ORDER BY created_at',[runId])).rows;
      return Promise.all(rows.map(async row=>({...row,files_data:await store.json(row.files)})));
    },
    async review(runId,id,input) {
      assert(['approved','rejected'].includes(input.decision),'Escolha aprovar ou rejeitar.');
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Automação não está aberta para revisão.',409);
        const row=(await db.query('SELECT * FROM research.automated_tests WHERE id=$1 AND run_id=$2 FOR UPDATE',[id,runId])).rows[0];
        assert(row,'Script não encontrado.',404);
        assert(Number.isInteger(input.revision) && input.revision===row.revision,'Script alterado por outra revisão. Atualize a página.',409);
        const candidate={...row.content,files:input.files || await store.json(row.files)};
        const context=await inputFor(runId,stage,db);
        validateAutomation({artifacts:[candidate],unsupported_cases:[],warnings:[]},{...context,test_cases:context.test_cases.filter(t=>t.id===row.test_case_id)});
        const files=input.files ? await store.put(candidate.files) : row.files;
        const after=(await db.query(`UPDATE research.automated_tests SET files=$3,review_status=$4,revision=revision+1,version=version+$5
          WHERE id=$1 AND run_id=$2 RETURNING *`,[id,runId,files,input.decision,input.files ? 1 : 0])).rows[0];
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'automated_test',$4,$5,$6,$7,$8,'admin')`,[randomUUID(),runId,stage.id,id,input.decision,justification,JSON.stringify(row),JSON.stringify(after)]);
        return after;
      });
    },
    async approve(runId,input) {
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Etapa não aguarda revisão.',409);
        const counts=(await db.query(`SELECT count(*) FILTER(WHERE review_status='pending')::int AS pending,
          count(*) FILTER(WHERE review_status='approved')::int AS approved FROM research.automated_tests WHERE run_id=$1`,[runId])).rows[0];
        assert(counts.pending===0 && counts.approved>0,'Revise todos os scripts e aprove pelo menos um.',409);
        await db.query("UPDATE research.stages SET status='completed',message='Scripts revisados. Execução exige autorização separada e executor disponível.' WHERE id=$1",[stage.id]);
        await db.query("UPDATE research.runs SET status='completed',finished_at=now() WHERE id=$1",[runId]);
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,'admin')`,[randomUUID(),runId,stage.id,justification]);
        return {status:'completed'};
      });
    },
  };
}
