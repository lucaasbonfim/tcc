import {randomUUID} from 'node:crypto';
import {assert,text,transaction} from './errors.js';
import {EVALUATION,CLASSIFICATIONS} from './evaluation-contract.js';

export function createEvaluationService({pool,store}) {
  const service={
    async queue(db,runId) {
      const count=(await db.query("SELECT count(*)::int AS n FROM research.evidence WHERE run_id=$1 AND origin='executor'",[runId])).rows[0].n;
      assert(count>0,'Avaliação requer evidência independente de executor.',409);
      const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='evaluation' FOR UPDATE",[runId])).rows[0];
      assert(stage && stage.attempt_count===0 && ['not_supported','blocked'].includes(stage.status),'Avaliação já iniciada. Use repetição de falha ou nova execução.',409);
      await db.query("UPDATE research.stages SET status='pending',instruction_version=$2,instruction=$3,context=$4,message='Evidências disponíveis para análise.' WHERE id=$1",[stage.id,EVALUATION.version,EVALUATION.instruction,{schema:EVALUATION.schema}]);
      await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
    },
    async start(runId,input) {
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run?.status==='completed','Execução não está concluída.',409);
        await service.queue(db,runId);
        const stage=(await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND agent='evaluation'",[runId])).rows[0];
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,'admin')`,[randomUUID(),runId,stage.id,justification]);
        return {status:'pending'};
      });
    },
    async inputFor(runId) {
      const evidence=(await pool.query("SELECT * FROM research.evidence WHERE run_id=$1 AND origin='executor'",[runId])).rows;
      assert(evidence.length>0,'Não há evidência independente para avaliar.',422);
      const results=(await pool.query('SELECT * FROM research.test_results WHERE run_id=$1 ORDER BY id',[runId])).rows;
      assert(results.length>0 && results.length<=200,'Resultados fora dos limites de avaliação.',422);
      const cases=(await pool.query("SELECT id,content FROM research.test_cases WHERE run_id=$1 AND review_status='approved' ORDER BY code",[runId])).rows;
      const requirements=(await pool.query("SELECT id,code,content FROM research.requirements WHERE run_id=$1 AND review_status='approved' ORDER BY code",[runId])).rows;
      const scripts=(await pool.query("SELECT id,test_case_id,content,files FROM research.automated_tests WHERE run_id=$1 AND review_status='approved'",[runId])).rows;
      const records=[];for(const row of evidence)records.push({id:row.id,origin:row.origin,data:await store.json(row.artifact)});
      const approvedScripts=[];for(const script of scripts)approvedScripts.push({...script,files_data:await store.json(script.files)});
      return {requirements:requirements.map(r=>({id:r.id,code:r.code,...r.content})),
        original_source_excerpts:requirements.flatMap(r=>r.content.sources.map(s=>({requirement_code:r.code,...s}))),
        test_cases:cases,automated_tests:approvedScripts,
        environments:records.map(row=>({evidence_id:row.id,environment:row.data.environment,commands:row.data.commands,exit_code:row.data.exit_code,status:row.data.status,limitations:row.data.limitations})),
        results:results.map(row=>({id:row.id,evidence_id:row.evidence_id,test_case_id:row.test_case_id,automated_test_id:row.automated_test_id,status:row.status,
          test_name:row.content.test_name,observed_excerpt:row.content.observed.slice(0,8000),omitted_characters:Math.max(0,row.content.observed.length-8000)}))};
    },
    async persist(db,job,output) {
      for(const finding of output.findings) {
        const req=(await db.query("SELECT id FROM research.requirements WHERE run_id=$1 AND code=$2 AND review_status='approved'",[job.run.id,finding.requirement_code])).rows[0];
        assert(req,'Requisito da avaliação não encontrado.',422);
        await db.query(`INSERT INTO research.findings(id,run_id,evaluation_attempt_id,test_result_id,automated_test_id,test_case_id,requirement_id,content)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),job.run.id,job.attemptId,finding.test_result_id,finding.automated_test_id,finding.test_case_id,req.id,JSON.stringify(finding)]);
      }
    },
    async review(runId,id,input) {
      assert(['confirmed','rejected','inconclusive'].includes(input.decision),'Escolha confirmar, rejeitar ou inconclusiva.');
      const justification=text(input.justification,'Justificativa',5000,true);
      assert(input.classification===undefined || CLASSIFICATIONS.includes(input.classification),'Classificação humana inválida.');
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='evaluation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Avaliação não está aberta para revisão.',409);
        const before=(await db.query('SELECT * FROM research.findings WHERE id=$1 AND run_id=$2 FOR UPDATE',[id,runId])).rows[0];
        assert(before,'Análise não encontrada.',404);
        assert(Number.isInteger(input.revision) && before.revision===input.revision,'Análise alterada por outra revisão.',409);
        const classification=input.decision==='inconclusive' ? 'inconclusive' : input.classification || (input.decision==='confirmed' ? before.content.classification : null);
        const after=(await db.query('UPDATE research.findings SET review_status=$3,human_classification=$4,revision=revision+1 WHERE id=$1 AND run_id=$2 RETURNING *',[id,runId,input.decision,classification])).rows[0];
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'finding',$4,$5,$6,$7,$8,'admin')`,[randomUUID(),runId,stage.id,id,input.decision,justification,JSON.stringify(before),JSON.stringify(after)]);
        return after;
      });
    },
    async approve(runId,input) {
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='evaluation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Avaliação não aguarda revisão.',409);
        const rows=(await db.query('SELECT review_status FROM research.findings WHERE run_id=$1',[runId])).rows;
        assert(rows.length>0 && rows.every(row=>row.review_status!=='pending'),'Revise todas as análises antes de concluir.',409);
        await db.query("UPDATE research.stages SET status='completed',message='Análises revisadas; consulte classificações humanas e evidências.' WHERE id=$1",[stage.id]);
        await db.query("UPDATE research.runs SET status='completed',finished_at=now() WHERE id=$1",[runId]);
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,'admin')`,[randomUUID(),runId,stage.id,justification]);
        return {status:'completed'};
      });
    },
  };return service;
}
