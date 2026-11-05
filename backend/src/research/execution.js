import {randomUUID} from 'node:crypto';
import {assert,text,transaction} from './errors.js';
import {createExecutorClient} from './executor-client.js';
import {sha256,validateBundle,validateExecutionResult} from '../../../shared/execution-protocol.js';
import {buildExecutionBundles} from './execution-plan.js';
import {agentMode} from './agent-policy.js';
import {AGENT_CONTRACT_VERSION} from './agent-contract.js';
import {createEvaluationService} from './evaluation.js';
import {isEligible,assertInitialGrant,assertEnvironmentGrant} from './workflow-policy.js';
import {appendRunEvent,recordHumanEvent} from './run-events.js';

export const EXECUTION_INSTRUCTION='Serviço A3 determinístico v2.2: executar os bundles do plano autorizado com scripts/revisões/hashes aprovados e fontes do SHA, em serviço autenticado com política do perfil validada. Cada bundle tem checkpoint e identidade de transporte estáveis; comandos fixos por adaptador. Preservar perfil local/dedicado, ambiente, resultados e evidências sem inferir defeito funcional. Nenhuma chamada LLM autoriza comandos.';
export function createExecutionService({pool,store,client=createExecutorClient()}) {
  const receiptIdentity=receipt=>({deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256,isolation_profile:receipt.isolation_profile,development_only:Boolean(receipt.development_only),images:Object.fromEntries(Object.entries(receipt.images || {}).map(([adapter,image])=>[adapter,image.image_id]))});
  async function capture(db,runId,receipt) {
    const automation=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation'",[runId])).rows[0];assert(automation?.status==='completed','Scripts precisam de revisão e aprovação da etapa.',409);
    const scripts=(await db.query("SELECT * FROM research.automated_tests WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) AND compatibility='compatible' ORDER BY id",[runId])).rows;
    assert(scripts.length>0 && scripts.length<=200,'Plano requer entre 1 e 200 scripts aprovados compatíveis.',422);
    const entries=[];
    for(const script of scripts){const attempt=(await db.query('SELECT input FROM research.attempts WHERE id=$1',[script.generation_attempt_id])).rows[0];const test_case=(await db.query("SELECT id,content,revision FROM research.test_cases WHERE id=$1 AND run_id=$2 AND research.artifact_eligible(run_id,review_status,processing_status)",[script.test_case_id,runId])).rows[0];assert(test_case,'Caso aprovado do script não encontrado.',422);entries.push({script,scope_input:attempt?.input ?? null,test_case});}
    const signature=sha256({scope:automation.context.scope.sha256,entries:entries.map(({script,scope_input,test_case})=>({id:script.id,version:script.version,revision:script.revision,files:script.files.sha256,scope_input:scope_input?.sha256,case_sha256:sha256(test_case)})),receipt:receiptIdentity(receipt)});
    return {runId,scope_ref:automation.context.scope,entries,receipt,signature};
  }
  async function materialize(captured) {const scope=await store.json(captured.scope_ref);return {...captured,scope,entries:await Promise.all(captured.entries.map(async({scope_input,...entry})=>({...entry,scope:scope_input?(await store.json(scope_input)).input.scope:scope,files:await store.json(entry.script.files)})))};}
  return {
    capabilities:()=>client.health(),
    async startPlanning(runId,input,{automatic=false}={}) {
      const justification=text(input.justification,'Justificativa',5000,true),receipt=await client.health();assert(receipt.ready,receipt.reason || 'Executor indisponível para planejamento.',503);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];assert(run?.status===(automatic?'pending':'completed'),'Conclua as etapas antes do planejamento.',409);
        assert(automatic?run.workflow_mode==='autonomous/v1':run.workflow_mode!=='autonomous/v1','Modo de planejamento diverge da condição.',409);
        const grant=automatic?await assertInitialGrant(db,run,store):null;if(grant)assertEnvironmentGrant(grant,receipt,grant.adapter);
        const snapshot=await store.json(run.snapshot);assert(agentMode(snapshot,'execution')==='agent/v1','Esta análise não habilitou A3 com ferramentas.',409);
        assert(!(await db.query('SELECT id FROM research.execution_jobs WHERE run_id=$1',[runId])).rowCount,'Execução já autorizada.',409);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];assert(stage?.attempt_count===0 && ['not_supported','blocked'].includes(stage.status),'Planejamento já iniciado; use repetição de falha.',409);
        const definition=snapshot.execution_agent_definitions?.planning;assert(definition?.contract_version===AGENT_CONTRACT_VERSION,'Perfil A3 ausente/incompatível.',422);
        const captured=await capture(db,runId,receipt),ref=await store.put(captured);
        await db.query("UPDATE research.stages SET status='pending',instruction=$2,instruction_version=$3,context=$4,message='Planejamento A3 enfileirado; execução ainda não autorizada.' WHERE id=$1",[stage.id,definition.instruction,definition.version,{phase:'planning',execution_mode:'agent/v1',agent_definition:definition,schema:definition.schema,planning_input:ref}]);
        await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
        if(!automatic)await db.query("INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,actor) VALUES($1,$2,$3,'stage',$3,'approved',$4,'admin')",[randomUUID(),runId,stage.id,justification]);
        else await appendRunEvent(db,{run_id:runId,stage_id:stage.id,source_key:'planning:requested',kind:'planning_requested',agent:'execution',payload:{grant_id:grant.id,human_approval:false}});
        return {status:'pending',execution_authorized:false};
      });
    },
    async planningInput(ref) {return materialize(await store.json(ref));},
    async persistPlanning(db,job,output) {
      const id=randomUUID();await db.query("INSERT INTO research.execution_proposals(id,run_id,stage_id,attempt_id,phase,input,output) VALUES($1,$2,$3,$4,'planning',$5,$6)",[id,job.run.id,job.stage.id,job.attemptId,job.stage.context.planning_input,await store.put(output)]);
      await db.query('UPDATE research.stages SET context=context || $2::jsonb WHERE id=$1',[job.stage.id,JSON.stringify({proposal_id:id})]);
    },
    async queueDiagnosis(db,runId) {
      const run=(await db.query('SELECT snapshot FROM research.runs WHERE id=$1',[runId])).rows[0],snapshot=await store.json(run.snapshot),definition=snapshot.execution_agent_definitions?.diagnosis;
      if(agentMode(snapshot,'execution')!=='agent/v1' || !definition)return false;
      assert(definition.contract_version===AGENT_CONTRACT_VERSION,'Perfil de diagnóstico A3 incompatível.',422);
      const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];
      const results=(await db.query('SELECT id FROM research.test_results WHERE run_id=$1 ORDER BY id',[runId])).rows;
      await db.query("UPDATE research.stages SET status='pending',attempt_count=0,instruction=$2,instruction_version=$3,context=$4,message='Diagnóstico A3 enfileirado sobre evidências preservadas.' WHERE id=$1",[stage.id,definition.instruction,definition.version,{phase:'diagnosis',execution_mode:'agent/v1',agent_definition:definition,schema:definition.schema,plan_id:stage.context.plan_id,diagnosis_result_ids:results.map(r=>r.id)}]);
      await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);return true;
    },
    async diagnosisInput(job) {
      const input=await createEvaluationService({pool,store}).inputFor(job.run.id);
      assert(sha256(input.results.map(r=>r.id).sort())===sha256([...job.stage.context.diagnosis_result_ids].sort()),'Resultados divergem do diagnóstico enfileirado.',422);
      const plan=(await pool.query('SELECT manifest FROM research.execution_plans WHERE id=$1 AND run_id=$2',[job.stage.context.plan_id,job.run.id])).rows[0];assert(plan,'Plano do diagnóstico não encontrado.',422);
      const manifest=await store.json(plan.manifest);for(const script of input.automated_tests){const pinned=manifest.scripts.find(s=>s.id===script.id);assert(pinned?.version===script.version && pinned.revision===script.revision && pinned.files.sha256===script.files.sha256,'Script mudou após a execução; diagnóstico bloqueado.',422);}
      return input;
    },
    async persistDiagnosis(db,job,output,inputRef) {
      await db.query("INSERT INTO research.execution_proposals(id,run_id,stage_id,attempt_id,phase,input,output) VALUES($1,$2,$3,$4,'diagnosis',$5,$6)",[randomUUID(),job.run.id,job.stage.id,job.attemptId,inputRef,await store.put(output)]);
    },
    async reviewDiagnosis(runId,id,input) {
      const justification=text(input.justification,'Justificativa',5000,true);assert(['accepted','rejected','revision_requested'].includes(input.decision),'Decisão do diagnóstico inválida.',422);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];assert(run?.status==='awaiting_review' || (run?.workflow_mode==='autonomous/v1' && ['completed','failed','cancelled'].includes(run.status)),'Análise não aguarda revisão.',409);
        const row=(await db.query("SELECT * FROM research.execution_proposals WHERE id=$1 AND run_id=$2 AND phase='diagnosis' FOR UPDATE",[id,runId])).rows[0];assert(row?.review_status==='pending','Diagnóstico não está aberto para revisão.',409);
        await db.query('UPDATE research.execution_proposals SET review_status=$2,reviewed_at=now() WHERE id=$1',[id,input.decision]);
        await db.query("INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor) VALUES($1,$2,$3,'stage',$3,$4,$5,$6,$7,'admin')",[randomUUID(),runId,row.stage_id,input.decision==='accepted'?'approved':input.decision==='rejected'?'rejected':'edited',justification,{proposal_id:id,review_status:'pending'},{proposal_id:id,review_status:input.decision}]);
        await recordHumanEvent(db,store,{run_id:runId,stage_id:row.stage_id,source_key:`diagnosis:${id}:review`,entity_type:'execution_diagnosis',entity_id:id,decision:input.decision,justification,before:{...row,output_data:await store.json(row.output)},after:{review_status:input.decision}});
        return {review_status:input.decision};
      });
    },
    async proposals(runId) {return Promise.all((await pool.query('SELECT * FROM research.execution_proposals WHERE run_id=$1 ORDER BY created_at',[runId])).rows.map(async row=>({...row,input_data:await store.json(row.input),output_data:await store.json(row.output)})));},
    async authorize(runId,input,{automatic=false}={}) {
      const justification=text(input.justification,'Justificativa',5000,true);
      const receipt=await client.health();
      assert(receipt.ready,receipt.reason || 'Isolamento não validado.',503);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run,'Análise não encontrada.',404);
        assert(automatic?run.workflow_mode==='autonomous/v1':run.workflow_mode!=='autonomous/v1','Autorização desta análise depende do escopo inicial.',409);
        const grant=automatic?await assertInitialGrant(db,run,store):null;
        const snapshot=await store.json(run.snapshot),native=agentMode(snapshot,'execution')==='agent/v1';
        const executionStage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];
        assert(native?run.status==='awaiting_review' && executionStage.status==='awaiting_review' && executionStage.context.phase==='planning':run.status===(automatic?'pending':'completed'),'Conclua as etapas e o planejamento antes de autorizar execução.',409);
        const proposal=native?(await db.query("SELECT * FROM research.execution_proposals WHERE run_id=$1 AND phase='planning' FOR UPDATE",[runId])).rows[0]:null;
        if(native)assert(proposal?.review_status==='pending' && input.proposal_id===proposal.id,'Proposta ausente, alterada ou já revisada.',409);
        const automation=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation'",[runId])).rows[0];
        assert(automation?.status==='completed','Scripts precisam de revisão e aprovação da etapa.',409);
        assert(!(await db.query('SELECT id FROM research.execution_jobs WHERE run_id=$1',[runId])).rowCount,'Trabalho já criado. Consulte o histórico, repita falha de transporte ou crie outra execução experimental.',409);
        const scripts=(await db.query("SELECT * FROM research.automated_tests WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) AND compatibility='compatible' ORDER BY id",[runId])).rows;
        assert(scripts.length>0 && scripts.length<=200,'Plano requer entre 1 e 200 scripts aprovados compatíveis.',422);
        const scope=await store.json(automation.context.scope);
        if(grant){assert(scope.commit_sha===grant.commit_sha && scope.module.root===grant.module_root && scripts.length<=grant.limits.max_scripts,'Escopo excede a autorização inicial.',422);assertEnvironmentGrant(grant,receipt,scope.module.adapter);}
        assert(receipt.images[scope.module.adapter],'Imagem do adaptador indisponível.',503);
        const entries=[];
        for(const script of scripts) {
          const attempt=(await db.query('SELECT input FROM research.attempts WHERE id=$1',[script.generation_attempt_id])).rows[0];
          const original=attempt?.input ? (await store.json(attempt.input)).input.scope : scope;
          entries.push({script,scope:original,files:await store.json(script.files)});
        }
        if(native){const pinned=await store.json(proposal.input),current=await capture(db,runId,receipt);assert(current.signature===pinned.signature,'Scripts, casos, fontes ou ambiente mudaram após o planejamento. Crie outra análise.',422);}
        const groups=native?(await store.json(proposal.output)).groups.map(g=>g.script_ids):undefined;
        const bundles=buildExecutionBundles({runId,scope,entries,groups});
        if(grant)assert(bundles.length<=grant.limits.max_bundles,'Plano excede a autorização inicial.',422);
        const planId=randomUUID(),manifest={format_version:1,run_id:runId,commit_sha:scope.commit_sha,adapter:scope.module.adapter,receipt,
          scripts:entries.map(({script})=>({id:script.id,test_case_id:script.test_case_id,version:script.version,revision:script.revision,files:script.files})),
          bundles:bundles.map((bundle,i)=>({job_id:bundle.job_id,sequence:i+1,sha256:sha256(bundle),script_ids:bundle.generated_tests.map(t=>t.id)}))};
        const manifestRef=await store.put(manifest);
        await db.query("INSERT INTO research.execution_plans(id,run_id,format_version,status,manifest,planner_mode,proposal_id,authorization_source,grant_id) VALUES($1,$2,1,'pending',$3,$4,$5,$6,$7)",[planId,runId,manifestRef,native?'agent/v1':'deterministic/v1',proposal?.id ?? null,automatic?'initial_grant':'human',grant?.id ?? null]);
        if(native && !automatic)await db.query("UPDATE research.execution_proposals SET review_status='accepted',reviewed_at=now() WHERE id=$1",[proposal.id]);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];
        for(let i=0;i<bundles.length;i++){const bundle=bundles[i];await db.query(`INSERT INTO research.execution_jobs(id,run_id,stage_id,status,adapter,bundle,request_sha256,executor_receipt,plan_id,sequence)
          VALUES($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9)`,[bundle.job_id,runId,stage.id,bundle.adapter,await store.put(bundle),sha256(bundle),receipt,planId,i+1]);}
        await db.query("UPDATE research.stages SET status='pending',attempt_count=0,instruction_version='2.2.0',instruction=$2,context=$3,message='Plano autorizado, aguardando worker.' WHERE id=$1",[stage.id,EXECUTION_INSTRUCTION,{phase:'executing',plan_id:planId,proposal_id:proposal?.id ?? null,job_id:bundles[0].job_id}]);
        await db.query("UPDATE research.stages SET status='blocked',message='Aguardando evidências independentes de execução.' WHERE run_id=$1 AND agent='evaluation' AND status='not_supported'",[runId]);
        await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
        if(!automatic)await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,$6,'admin')`,[randomUUID(),runId,stage.id,justification,{status:stage.status},{job_id:bundles[0].job_id,plan_id:planId,manifest_sha256:manifestRef.sha256,bundles:manifest.bundles,policy_sha256:receipt.policy_sha256,image:receipt.images[scope.module.adapter].image_id}]);
        else await appendRunEvent(db,{run_id:runId,stage_id:stage.id,source_key:'execution:authorized',kind:'execution_authorized',payload:{grant_id:grant.id,plan_id:planId,manifest:manifestRef,human_approval:false,authorization_source:'initial_grant'}});
        return {job_id:bundles[0].job_id,plan_id:planId,bundles:bundles.length,status:'pending'};
      });
    },
    async prepare(job) {
      const row=(await pool.query('SELECT * FROM research.execution_jobs WHERE id=$1 AND run_id=$2',[job.stage.context.job_id,job.run.id])).rows[0];
      assert(row && row.status!=='cancelled','Trabalho não autorizado ou cancelado.',409);
      const bundle=await store.json(row.bundle);validateBundle(bundle);
      assert(sha256(bundle)===row.request_sha256,'Bundle de execução adulterado.',409);
      const plan=(await pool.query('SELECT * FROM research.execution_plans WHERE id=$1 AND run_id=$2',[row.plan_id,job.run.id])).rows[0];
      assert(plan && plan.status!=='cancelled','Plano não autorizado ou cancelado.',409);
      if(plan.format_version===1) {
        const manifest=await store.json(plan.manifest),entry=manifest.bundles.find(b=>b.job_id===row.id);
        assert(entry?.sha256===row.request_sha256 && sha256(manifest.receipt)===sha256(row.executor_receipt),'Trabalho diverge do plano autorizado.',409);
        for(const pinned of manifest.scripts.filter(s=>entry.script_ids.includes(s.id))) {
          const script=(await pool.query('SELECT * FROM research.automated_tests WHERE id=$1 AND run_id=$2',[pinned.id,job.run.id])).rows[0];
          assert(script && isEligible(script) && script.version===pinned.version && script.revision===pinned.revision && script.files.sha256===pinned.files.sha256,'Script/revisão mudou depois da autorização; crie nova análise.',422);
        }
      }
      await pool.query("UPDATE research.execution_jobs SET status='running',error=NULL WHERE id=$1 AND status<>'cancelled'",[row.id]);
      await pool.query("UPDATE research.execution_plans SET status='running',finished_at=NULL WHERE id=$1 AND status<>'cancelled'",[row.plan_id]);
      return {bundle,receipt:row.executor_receipt};
    },
    async perform(input,signal){return client.execute(input.bundle,input.receipt,{signal});},
    async persist(db,job,output) {
      const row=(await db.query('SELECT * FROM research.execution_jobs WHERE id=$1 FOR UPDATE',[job.stage.context.job_id])).rows[0];
      const bundle=await store.json(row.bundle);validateExecutionResult(output,bundle,row.request_sha256);
      if(row.status==='completed'){assert(sha256(await store.json(row.result))===sha256(output),'Resultado concluído não pode ser substituído.',409);return;}
      assert(output.environment.image_id===row.executor_receipt.images[row.adapter].image_id && output.environment.deployment_id===row.executor_receipt.deployment_id && output.environment.policy_sha256===row.executor_receipt.policy_sha256,'Ambiente recebido não corresponde à autorização.',422);
      assert((output.environment.isolation_profile || 'dedicated-vm')===(row.executor_receipt.isolation_profile || 'dedicated-vm') && Boolean(output.environment.development_only)===Boolean(row.executor_receipt.development_only),'Perfil recebido não corresponde à autorização.',422);
      const ref=await store.put(output),evidenceId=randomUUID();
      await db.query("UPDATE research.execution_jobs SET status='completed',result=$2,finished_at=now() WHERE id=$1",[row.id,ref]);
      await db.query('INSERT INTO research.evidence(id,run_id,job_id,artifact) VALUES($1,$2,$3,$4)',[evidenceId,job.run.id,row.id,ref]);
      for(const test of output.tests)await db.query(`INSERT INTO research.test_results(id,run_id,job_id,evidence_id,automated_test_id,test_case_id,status,content)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),job.run.id,row.id,evidenceId,test.artifact_id,test.test_case_id,test.status,JSON.stringify(test)]);
      const pending=(await db.query("SELECT id FROM research.execution_jobs WHERE plan_id=$1 AND status<>'completed'",[row.plan_id])).rowCount;
      await db.query("UPDATE research.execution_plans SET status=$2,finished_at=CASE WHEN $2='completed' THEN now() ELSE NULL END WHERE id=$1",[row.plan_id,pending?'running':'completed']);
    },
    async list(runId) {
      const jobs=(await pool.query('SELECT * FROM research.execution_jobs WHERE run_id=$1 ORDER BY sequence,created_at',[runId])).rows;
      return Promise.all(jobs.map(async job=>({...job,result_data:job.result ? await store.json(job.result) : null})));
    },
    async plans(runId) {return Promise.all((await pool.query('SELECT * FROM research.execution_plans WHERE run_id=$1 ORDER BY created_at',[runId])).rows.map(async plan=>({...plan,manifest_data:await store.json(plan.manifest)})));},
    async cancel(runId){for(const row of (await pool.query('SELECT id FROM research.execution_jobs WHERE run_id=$1',[runId])).rows)await client.cancel(row.id).catch(()=>{});},
  };
}
