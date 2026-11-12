import {randomUUID} from 'node:crypto';
import {assert,text,transaction} from './errors.js';
import {EVALUATION,CLASSIFICATIONS} from './evaluation-contract.js';
import {agentMode} from './agent-policy.js';
import {AGENT_CONTRACT_VERSION} from './runtime/session-contract.js';
import {recordHumanEvent} from './run-events.js';
import {verifyEvaluationProvenance} from './evaluation-provenance.js';

export function createEvaluationService({pool,store}) {
  const service={
    async queue(db,runId) {
      const count=(await db.query("SELECT count(*)::int AS n FROM research.evidence WHERE run_id=$1 AND origin='executor'",[runId])).rows[0].n;
      assert(count>0,'Avaliação requer evidência independente de executor.',409);
      const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='evaluation' FOR UPDATE",[runId])).rows[0];
      assert(stage && stage.attempt_count===0 && ['not_supported','blocked'].includes(stage.status),'Avaliação já iniciada. Use repetição de falha ou nova execução.',409);
      const run=(await db.query('SELECT snapshot FROM research.runs WHERE id=$1',[runId])).rows[0],snapshot=await store.json(run.snapshot);
      const isAgent=agentMode(snapshot,'evaluation')==='agent/v1';
      const definition=isAgent?snapshot.evaluation_agent_definition:(snapshot.evaluation_definition || EVALUATION);
      assert(definition && (!isAgent || definition.contract_version===AGENT_CONTRACT_VERSION),'Definição de A4 ausente/incompatível.',422);
      await db.query("UPDATE research.stages SET status='pending',instruction_version=$2,instruction=$3,context=$4,message='Evidências disponíveis para análise.' WHERE id=$1",[stage.id,definition.version,definition.instruction,{schema:definition.schema || EVALUATION.schema,...(isAgent?{execution_mode:'agent/v1',agent_definition:definition}:{})}]);
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
    async inputFor(runId,db=pool) {
      const evidence=(await db.query("SELECT * FROM research.evidence WHERE run_id=$1 AND origin='executor'",[runId])).rows;
      assert(evidence.length>0,'Não há evidência independente para avaliar.',422);
      const results=(await db.query('SELECT * FROM research.test_results WHERE run_id=$1 ORDER BY id',[runId])).rows;
      assert(results.length>0 && results.length<=200,'Resultados fora dos limites de avaliação.',422);
      const cases=(await db.query("SELECT id,content FROM research.test_cases WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) ORDER BY code",[runId])).rows;
      const requirements=(await db.query("SELECT id,code,content FROM research.requirements WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) ORDER BY code",[runId])).rows;
      const scripts=(await db.query("SELECT id,test_case_id,version,revision,generation_attempt_id,content,files FROM research.automated_tests WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status)",[runId])).rows;
      const records=[];for(const row of evidence)records.push({id:row.id,job_id:row.job_id,origin:row.origin,data:await store.json(row.artifact)});
      const approvedScripts=[];for(const script of scripts)approvedScripts.push({...script,files_data:await store.json(script.files)});
      const jobs=(await db.query('SELECT * FROM research.execution_jobs WHERE run_id=$1',[runId])).rows;
      const plans=(await db.query('SELECT * FROM research.execution_plans WHERE run_id=$1',[runId])).rows;
      const bundles=new Map(),manifests=new Map(),provenance=new Map();
      for(const result of results) {
        const job=jobs.find(row=>row.id===result.job_id),plan=plans.find(row=>row.id===job?.plan_id);
        assert(job && plan,'Trabalho/plano da evidência não encontrado.',409);
        if(!bundles.has(job.id))bundles.set(job.id,await store.json(job.bundle));
        if(!manifests.has(plan.id))manifests.set(plan.id,await store.json(plan.manifest));
        const record=records.find(row=>row.id===result.evidence_id && row.job_id===job.id);
        provenance.set(result.id,verifyEvaluationProvenance({runId,result,job,plan,bundle:bundles.get(job.id),manifest:manifests.get(plan.id),
          script:approvedScripts.find(row=>row.id===result.automated_test_id),evidence:record?.data}));
      }
      return {requirements:requirements.map(r=>({id:r.id,code:r.code,...r.content})),
        original_source_excerpts:requirements.flatMap(r=>r.content.sources.map(s=>({requirement_code:r.code,...s}))),
        test_cases:cases,automated_tests:approvedScripts,
        environments:records.map(row=>({evidence_id:row.id,environment:row.data.environment,commands:row.data.commands,exit_code:row.data.exit_code,status:row.data.status,limitations:row.data.limitations})),
        results:results.map(row=>({id:row.id,evidence_id:row.evidence_id,test_case_id:row.test_case_id,automated_test_id:row.automated_test_id,status:row.status,
          execution_provenance:provenance.get(row.id),test_name:row.content.test_name,observed_excerpt:row.content.observed.slice(0,8000),omitted_characters:Math.max(0,row.content.observed.length-8000)}))};
    },
    async persist(db,job,output) {
      for(const finding of output.findings) {
        const req=(await db.query("SELECT id FROM research.requirements WHERE run_id=$1 AND code=$2 AND research.artifact_eligible(run_id,review_status,processing_status)",[job.run.id,finding.requirement_code])).rows[0];
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
        assert((run?.workflow_mode!=='autonomous/v1' && run?.status==='awaiting_review' && stage?.status==='awaiting_review') || (run?.workflow_mode==='autonomous/v1' && run.status==='completed' && stage?.status==='completed'),'Avaliação não está aberta para revisão.',409);
        const before=(await db.query('SELECT * FROM research.findings WHERE id=$1 AND run_id=$2 FOR UPDATE',[id,runId])).rows[0];
        assert(before,'Análise não encontrada.',404);
        assert(Number.isInteger(input.revision) && before.revision===input.revision,'Análise alterada por outra revisão.',409);
        const classification=input.decision==='inconclusive' ? 'inconclusive' : input.classification || (input.decision==='confirmed' ? before.content.classification : null);
        const after=(await db.query('UPDATE research.findings SET review_status=$3,human_classification=$4,revision=revision+1 WHERE id=$1 AND run_id=$2 RETURNING *',[id,runId,input.decision,classification])).rows[0];
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'finding',$4,$5,$6,$7,$8,'admin')`,[randomUUID(),runId,stage.id,id,input.decision,justification,JSON.stringify(before),JSON.stringify(after)]);
        await recordHumanEvent(db,store,{run_id:runId,stage_id:stage.id,source_key:`finding:${id}:review:${after.revision}`,entity_type:'finding',entity_id:id,decision:input.decision,justification,before,after});
        return after;
      });
    },
    async approve(runId,input) {
      const justification=text(input.justification,'Justificativa',5000,true);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='evaluation' FOR UPDATE",[runId])).rows[0];
        assert(run?.status==='awaiting_review' && stage?.status==='awaiting_review','Avaliação não aguarda revisão.',409);
        assert(!(await db.query("SELECT id FROM research.execution_proposals WHERE run_id=$1 AND phase='diagnosis' AND review_status='pending'",[runId])).rowCount,'Revise o diagnóstico do A3 antes de concluir a avaliação.',409);
        assert(!(await db.query("SELECT id FROM research.agent_messages WHERE run_id=$1 AND kind='script_review' AND (status<>'answered' OR review_status='pending')",[runId])).rowCount,'Revise as respostas de revisão de script antes de concluir a avaliação.',409);
        const rows=(await db.query('SELECT review_status FROM research.findings WHERE run_id=$1',[runId])).rows;
        assert(rows.length>0 && rows.every(row=>row.review_status!=='pending'),'Revise todas as análises antes de concluir.',409);
        await db.query("UPDATE research.stages SET status='completed',message='Análises revisadas; consulte classificações humanas e evidências.' WHERE id=$1",[stage.id]);
        await db.query("UPDATE research.runs SET status='completed',finished_at=now() WHERE id=$1",[runId]);
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,'admin')`,[randomUUID(),runId,stage.id,justification]);
        await recordHumanEvent(db,store,{run_id:runId,stage_id:stage.id,source_key:`stage:${stage.id}:evaluation-approved`,entity_type:'stage',entity_id:stage.id,decision:'approved',justification});
        return {status:'completed'};
      });
    },
  };return service;
}
