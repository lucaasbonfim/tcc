import { randomUUID } from 'node:crypto';
import { assert, text, transaction, uuid } from '../shared/errors.js';
import {AUTOMATION} from '../agents/tests/scripts/definition.js';
import {generatedPath,validateAutomation} from '../agents/tests/scripts/contracts.js';
import {testCoverage} from '../agents/tests/cases/parts.js';
import {planAutomationParts} from '../agents/tests/scripts/parts.js';
import {planModuleScopes} from '../sources/module-scopes.js';
import {agentMode} from '../runtime/policy.js';
import {AGENT_CONTRACT_VERSION} from '../runtime/session-contract.js';
import {admitProduced,assertInitialGrant} from '../orchestrator/workflow-policy.js';
import {appendRunEvent,recordHumanEvent} from '../storage/run-events.js';
import {operationalReason,recordOperation} from './operational-record.js';

export function createAutomationService({pool,store}) {
  async function inputFor(runId,stage,db=pool,caseIds=stage.context.case_ids) {
    const scope=await store.json(stage.context.scope);
    const cases=(await db.query("SELECT id,content FROM research.test_cases WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) AND id=ANY($2::uuid[]) ORDER BY code",[runId,caseIds])).rows;
    const codes=[...new Set(cases.flatMap(row=>row.content.requirement_codes))];
    const requirements=(await db.query("SELECT content FROM research.requirements WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) AND code=ANY($2::text[]) ORDER BY code",[runId,codes])).rows.map(r=>r.content);
    return {scope,test_cases:cases,requirements,generated_paths:cases.map(row=>({test_case_id:row.id,...generatedPath(row.id,scope.module.adapter)}))};
  }
  async function reviewContext(row,db=pool) {
    const attempt=(await db.query('SELECT input FROM research.attempts WHERE id=$1',[row.generation_attempt_id])).rows[0];
    assert(attempt?.input,'Entrada original do script não encontrada.',409);
    const input=(await store.json(attempt.input)).input;
    return {...input,test_cases:input.test_cases.filter(item=>item.id===row.test_case_id)};
  }
  return {
    inputFor,
    async partInput(part) {
      const input=await store.json(part.input);
      const finished=new Set(part.dispositions.filter(item=>item.status!=='deferred').map(item=>item.test_case_id));
      const cases=input.test_cases.filter(row=>!finished.has(row.id)),ids=new Set(cases.map(row=>row.id));
      assert(cases.length,'Lote não possui casos pendentes; confira os checkpoints.',422);
      const codes=new Set(cases.flatMap(row=>row.content.requirement_codes));
      return {...input,test_cases:cases,requirements:input.requirements.filter(row=>codes.has(row.code)),
        generated_paths:input.generated_paths.filter(row=>ids.has(row.test_case_id)),
        ...(part.error ? {previous_generation_error:part.error} : {})};
    },
    async start(runId,input,{automatic=false}={}) {
      uuid(input.inspection_id);
      const justification=operationalReason(input,'Geração de scripts solicitada para os casos e o módulo selecionados. Não autoriza execução de código.');
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run && run.status===(automatic?'pending':'completed'),'Conclua a etapa textual antes de preparar automação.',409);
        assert(automatic?run.workflow_mode==='autonomous/v1':run.workflow_mode!=='autonomous/v1','Modo de preparação diverge da condição da análise.',409);
        const grant=automatic?await assertInitialGrant(db,run,store):null;
        if(grant)assert(input.inspection_id===grant.inspection_id && input.module_root===grant.module_root && input.target_paths===undefined && input.test_case_ids===undefined,'Escopo diverge da autorização inicial.',422);
        const snapshot=await store.json(run.snapshot),mode=agentMode(snapshot,'automation'),agentDefinition=snapshot.automation_agent_definition;
        if(mode==='agent/v1')assert(agentDefinition?.contract_version===AGENT_CONTRACT_VERSION && Array.isArray(agentDefinition.tools),'Definição agentiva ausente/incompatível; crie nova análise.',422);
        assert(input.execution_mode===undefined || input.execution_mode===mode,'Modo fixado no snapshot; crie outra análise para mudar a condição.',422);
        const tests=(await db.query("SELECT status FROM research.stages WHERE run_id=$1 AND agent='tests'",[runId])).rows[0];
        assert(tests?.status==='completed','Casos textuais ainda não aprovados.',409);
        const coverage=testCoverage((await db.query('SELECT code,content,review_status,processing_status FROM research.requirements WHERE run_id=$1',[runId])).rows,(await db.query('SELECT code,content,review_status,processing_status FROM research.test_cases WHERE run_id=$1',[runId])).rows);
        assert(!(automatic?coverage.missing_eligible:coverage.missing_approved).length,`Existem requisitos sem caso ${automatic?'admitido':'aprovado'}. Complete a geração textual antes da automação.`,409);
        assert(!(await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND agent='automation'",[runId])).rowCount,'Automação já preparada. Consulte/replique a execução ou repita a etapa com falha.',409);
        const inspection=(await db.query('SELECT * FROM research.inspections WHERE id=$1 AND code_version_id=$2',[input.inspection_id,run.code_version_id])).rows[0];
        assert(inspection,'Inspeção deve pertencer à versão de código desta execução.',422);
        if(grant)assert(inspection.artifact.sha256===grant.inspection_sha256,'Inspeção diverge da autorização inicial.',422);
        const sourcePlan=planModuleScopes(await store.json(inspection.artifact),text(input.module_root,'Módulo',200),input.target_paths);
        assert(sourcePlan.scopes.length,'Nenhum fechamento de fontes deste módulo é compatível com o adaptador. Consulte as restrições por arquivo.',422);
        let cases=(await db.query("SELECT id FROM research.test_cases WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) ORDER BY code",[runId])).rows.map(r=>r.id);
        if(input.test_case_ids!==undefined) {
          assert(Array.isArray(input.test_case_ids) && new Set(input.test_case_ids).size===input.test_case_ids.length,'Seleção de casos inválida.',422);
          input.test_case_ids.forEach(uuid);
          assert(input.test_case_ids.every(id=>cases.includes(id)),'Caso selecionado não aprovado nesta execução.',422);cases=input.test_case_ids;
        }
        assert(cases.length>0 && cases.length<=6000,'Selecione casos aprovados dentro do limite da análise.',422);
        if(grant)assert(cases.length<=grant.limits.max_scripts,'Quantidade de casos excede a autorização inicial.',422);
        const id=randomUUID(),created=[],scopeRefs=[];let parts;
        try {
          for(const scope of mode==='agent/v1' ? sourcePlan.scopes.slice(0,1) : sourcePlan.scopes){const ref=await store.put(scope);created.push(ref);scopeRefs.push(ref);}
          const scopeRef=scopeRefs[0];
          parts=planAutomationParts(await inputFor(runId,{context:{scope:scopeRef,case_ids:cases}},db)).map(part=>({...part,scope_route:{index:0,total:scopeRefs.length}}));
          await db.query(`INSERT INTO research.stages(id,run_id,agent,position,status,instruction_version,instruction,context)
            VALUES($1,$2,'automation',5,'pending',$3,$4,$5)`,[id,runId,mode==='agent/v1'?agentDefinition.version:AUTOMATION.version,mode==='agent/v1'?agentDefinition.instruction:AUTOMATION.instruction,{execution_mode:mode,...(mode==='agent/v1'?{agent_definition:agentDefinition}:{}),scope:scopeRef,scopes:scopeRefs,scope_plan:sourcePlan.summary,inspection_id:inspection.id,case_ids:cases,schema:AUTOMATION.schema}]);
          for(const part of parts) {
            const ref=await store.put(part);created.push(ref);
            await db.query("INSERT INTO research.automation_parts(id,run_id,sequence,status,input,case_ids) VALUES($1,$2,$3,'pending',$4,$5)",[randomUUID(),runId,part.batch.sequence,ref,JSON.stringify(part.batch.case_ids)]);
          }
          await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
          if(!automatic && input.operation_record==='system/v1')await recordOperation(db,{run_id:runId,stage_id:id,operation:'generate_scripts',description:justification,payload:{inspection_id:inspection.id,scope_plan:sourcePlan.summary,test_case_ids:cases}});
          else if(!automatic)await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,after_value,actor)
            VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,'admin')`,[randomUUID(),runId,id,justification,{inspection_id:inspection.id,scope_plan:sourcePlan.summary,test_case_ids:cases}]);
          else await appendRunEvent(db,{run_id:runId,stage_id:id,source_key:'automation:prepared',kind:'automation_prepared',payload:{grant_id:grant.id,inspection_id:inspection.id,case_ids:cases,human_approval:false}});
        }catch(error){for(const ref of created)await store.remove(ref);throw error;}
        return {id,run_id:runId,status:'pending',selected_cases:cases.length,parts:parts.length,source_scopes:scopeRefs.length};
      });
    },
    async persist(db,job,output) {
      const dispositions=[];
      for(const artifact of output.artifacts) {
        const {files,...content}=artifact;
        const ref=await store.put(files);
        const id=randomUUID();
        await db.query(`INSERT INTO research.automated_tests(id,run_id,test_case_id,generation_attempt_id,adapter,content,files,compatibility)
          VALUES($1,$2,$3,$4,$5,$6,$7,'compatible')`,[id,job.run.id,artifact.test_case_id,job.attemptId,artifact.adapter,JSON.stringify(content),ref]);
        dispositions.push({test_case_id:artifact.test_case_id,status:'generated',automated_test_id:id});
      }
      const planned=job.automationPart ? await store.json(job.automationPart.input) : null;
      const index=planned?.scope_route?.index ?? 0,scopeRefs=job.stage.context.scopes || [];
      if(job.stage.context.execution_mode!=='agent/v1' && output.unsupported_cases.length && index+1<scopeRefs.length) {
        for(const item of output.unsupported_cases)dispositions.push({...item,status:'deferred',scope_index:index});
        const ids=new Set(output.unsupported_cases.map(item=>item.test_case_id));
        const nextInput={...planned,scope:await store.json(scopeRefs[index+1]),test_cases:planned.test_cases.filter(row=>ids.has(row.id))};
        const next=planAutomationParts(nextInput),offset=(await db.query('SELECT COALESCE(max(sequence),0)::int AS n FROM research.automation_parts WHERE run_id=$1',[job.run.id])).rows[0].n;
        assert(offset+next.length<=12000,'Geração excede o orçamento de 12000 lotes de scripts. Preserve o histórico e revise o escopo.',422);
        for(let i=0;i<next.length;i++) {
          const part={...next[i],scope_route:{index:index+1,total:scopeRefs.length},batch:{...next[i].batch,sequence:offset+i+1,total:offset+next.length}};
          const ref=await store.put(part);
          await db.query("INSERT INTO research.automation_parts(id,run_id,sequence,status,input,case_ids) VALUES($1,$2,$3,'pending',$4,$5)",[randomUUID(),job.run.id,part.batch.sequence,ref,JSON.stringify(part.batch.case_ids)]);
        }
      }else for(const item of output.unsupported_cases)dispositions.push({...item,status:'unsupported',scope_index:index,
        reason:scopeRefs.length>1 ? `Sem script após considerar ${scopeRefs.length} escopos compatíveis do módulo. Última justificativa: ${item.reason}` : item.reason});
      return dispositions;
    },
    async list(runId) {
      const rows=(await pool.query('SELECT * FROM research.automated_tests WHERE run_id=$1 ORDER BY created_at',[runId])).rows;
      return Promise.all(rows.map(async row=>({...row,files_data:await store.json(row.files)})));
    },
    async review(runId,id,input) {
      assert(['approved','rejected','edited'].includes(input.decision),'Escolha aprovar, rejeitar ou salvar correção.');
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run?.workflow_mode!=='autonomous/v1','Scripts autônomos são preservados para avaliação posterior.',409);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Automação não está aberta para revisão.',409);
        const row=(await db.query('SELECT * FROM research.automated_tests WHERE id=$1 AND run_id=$2 FOR UPDATE',[id,runId])).rows[0];
        assert(row,'Script não encontrado.',404);
        assert(Number.isInteger(input.revision) && input.revision===row.revision,'Script alterado por outra revisão. Atualize a página.',409);
        const candidate={...row.content,files:input.files || await store.json(row.files)};
        const context=await reviewContext(row,db);
        validateAutomation({artifacts:[candidate],unsupported_cases:[],warnings:[]},{...context,test_cases:context.test_cases.filter(t=>t.id===row.test_case_id)});
        const files=input.files ? await store.put(candidate.files) : row.files;
        const after=(await db.query(`UPDATE research.automated_tests SET files=$3,review_status=$4,revision=revision+1,version=version+$5
          WHERE id=$1 AND run_id=$2 RETURNING *`,[id,runId,files,input.decision==='edited' ? 'pending' : input.decision,input.files ? 1 : 0])).rows[0];
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'automated_test',$4,$5,$6,$7,$8,'admin')`,[randomUUID(),runId,stage.id,id,input.decision,justification,JSON.stringify(row),JSON.stringify(after)]);
        await recordHumanEvent(db,store,{run_id:runId,stage_id:stage.id,source_key:`script:${id}:review:${after.revision}`,entity_type:'automated_test',entity_id:id,decision:input.decision,justification,before:{...row,files_data:await store.json(row.files)},after:{...after,files_data:await store.json(after.files)}});
        return after;
      });
    },
    async approve(runId,input,{automatic=false}={}) {
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(automatic?run?.workflow_mode==='autonomous/v1':run?.workflow_mode!=='autonomous/v1','Modo de admissão diverge da condição da análise.',409);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Etapa não aguarda revisão.',409);
        assert(input.approve_pending===undefined || typeof input.approve_pending==='boolean','Opção de aprovação em lote inválida.');
        if(automatic) {
          const rows=(await db.query('SELECT * FROM research.automated_tests WHERE run_id=$1 ORDER BY id FOR UPDATE',[runId])).rows;
          for(const row of rows)validateAutomation({artifacts:[{...row.content,files:await store.json(row.files)}],unsupported_cases:[],warnings:[]},await reviewContext(row,db));
          await admitProduced(db,run,stage,'automated_tests',store);
        } else if(input.approve_pending) {
          const rows=(await db.query('SELECT * FROM research.automated_tests WHERE run_id=$1 ORDER BY id FOR UPDATE',[runId])).rows;
          const items=input.items ?? (input.revisions && typeof input.revisions==='object' && !Array.isArray(input.revisions) ? Object.entries(input.revisions).map(([id,revision])=>({id,revision})) : null);
          assert(Array.isArray(items) && items.length===rows.length && new Set(items.map(row=>row?.id)).size===rows.length,'Lista de scripts mudou. Atualize a página.',409);
          const versions=new Map(items.map(row=>[row?.id,row?.revision]));
          assert(rows.every(row=>Number.isInteger(versions.get(row.id)) && versions.get(row.id)===row.revision),'Script alterado por outra revisão. Atualize a página.',409);
          for(const row of rows.filter(row=>row.review_status!=='rejected'))validateAutomation({artifacts:[{...row.content,files:await store.json(row.files)}],unsupported_cases:[],warnings:[]},await reviewContext(row,db));
          const updated=(await db.query("UPDATE research.automated_tests SET review_status='approved',revision=revision+1 WHERE run_id=$1 AND review_status='pending' RETURNING *",[runId])).rows;
          if(updated.length) {
            const originals=new Map(rows.map(row=>[row.id,row]));
            const entries=updated.map(row=>({id:randomUUID(),entity_id:row.id,before_value:originals.get(row.id),after_value:row}));
            await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
              SELECT e.id,$2,$3,'automated_test',e.entity_id,'approved',$4,e.before_value,e.after_value,'admin'
              FROM jsonb_to_recordset($1::jsonb) AS e(id uuid,entity_id uuid,before_value jsonb,after_value jsonb)`,[JSON.stringify(entries),runId,stage.id,justification]);
          }
        }
        const counts=(await db.query(`SELECT count(*) FILTER(WHERE ${automatic?"review_status='pending' AND processing_status<>'eligible'":"review_status='pending'"})::int AS pending,
          count(*) FILTER(WHERE ${automatic?'research.artifact_eligible(run_id,review_status,processing_status)':"review_status='approved'"})::int AS approved FROM research.automated_tests WHERE run_id=$1`,[runId])).rows[0];
        assert(counts.pending===0 && counts.approved>0,'Revise todos os scripts e aprove pelo menos um.',409);
        await db.query("UPDATE research.stages SET status='completed',message=$2 WHERE id=$1",[stage.id,automatic?'Scripts admitidos tecnicamente; sem avaliação humana.':'Scripts revisados. Execução exige autorização separada e executor disponível.']);
        await db.query(`UPDATE research.runs SET status=$2,finished_at=${automatic?'NULL':'now()'} WHERE id=$1`,[runId,automatic?'pending':'completed']);
        if(!automatic)await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,after_value,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,'admin')`,[randomUUID(),runId,stage.id,justification,input.approve_pending ? {approval_mode:'bulk'} : null]);
        return {status:'completed'};
      });
    },
  };
}
