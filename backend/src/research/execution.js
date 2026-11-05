import {randomUUID} from 'node:crypto';
import {assert,text,transaction} from './errors.js';
import {createExecutorClient} from './executor-client.js';
import {sha256,validateBundle,validateExecutionResult} from '../../../shared/execution-protocol.js';
import {buildExecutionBundles} from './execution-plan.js';

export const EXECUTION_INSTRUCTION='Serviço A3 determinístico v2.2: executar os bundles do plano autorizado com scripts/revisões/hashes aprovados e fontes do SHA, em serviço autenticado com política do perfil validada. Cada bundle tem checkpoint e identidade de transporte estáveis; comandos fixos por adaptador. Preservar perfil local/dedicado, ambiente, resultados e evidências sem inferir defeito funcional. Nenhuma chamada LLM autoriza comandos.';
export function createExecutionService({pool,store,client=createExecutorClient()}) {
  return {
    capabilities:()=>client.health(),
    async authorize(runId,input) {
      const justification=text(input.justification,'Justificativa',5000,true);
      const receipt=await client.health();
      assert(receipt.ready,receipt.reason || 'Isolamento não validado.',503);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];
        assert(run?.status==='completed','Conclua as revisões antes de autorizar execução.',409);
        const automation=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation'",[runId])).rows[0];
        assert(automation?.status==='completed','Scripts precisam de revisão e aprovação da etapa.',409);
        assert(!(await db.query('SELECT id FROM research.execution_jobs WHERE run_id=$1',[runId])).rowCount,'Trabalho já criado. Consulte o histórico, repita falha de transporte ou crie outra execução experimental.',409);
        const scripts=(await db.query("SELECT * FROM research.automated_tests WHERE run_id=$1 AND review_status='approved' AND compatibility='compatible' ORDER BY id",[runId])).rows;
        assert(scripts.length>0 && scripts.length<=200,'Plano requer entre 1 e 200 scripts aprovados compatíveis.',422);
        const scope=await store.json(automation.context.scope);
        assert(receipt.images[scope.module.adapter],'Imagem do adaptador indisponível.',503);
        const entries=[];
        for(const script of scripts) {
          const attempt=(await db.query('SELECT input FROM research.attempts WHERE id=$1',[script.generation_attempt_id])).rows[0];
          const original=attempt?.input ? (await store.json(attempt.input)).input.scope : scope;
          entries.push({script,scope:original,files:await store.json(script.files)});
        }
        const bundles=buildExecutionBundles({runId,scope,entries});
        const planId=randomUUID(),manifest={format_version:1,run_id:runId,commit_sha:scope.commit_sha,adapter:scope.module.adapter,receipt,
          scripts:entries.map(({script})=>({id:script.id,test_case_id:script.test_case_id,version:script.version,revision:script.revision,files:script.files})),
          bundles:bundles.map((bundle,i)=>({job_id:bundle.job_id,sequence:i+1,sha256:sha256(bundle),script_ids:bundle.generated_tests.map(t=>t.id)}))};
        const manifestRef=await store.put(manifest);
        await db.query("INSERT INTO research.execution_plans(id,run_id,format_version,status,manifest) VALUES($1,$2,1,'pending',$3)",[planId,runId,manifestRef]);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];
        for(let i=0;i<bundles.length;i++){const bundle=bundles[i];await db.query(`INSERT INTO research.execution_jobs(id,run_id,stage_id,status,adapter,bundle,request_sha256,executor_receipt,plan_id,sequence)
          VALUES($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9)`,[bundle.job_id,runId,stage.id,bundle.adapter,await store.put(bundle),sha256(bundle),receipt,planId,i+1]);}
        await db.query("UPDATE research.stages SET status='pending',attempt_count=0,instruction_version='2.2.0',instruction=$2,context=$3,message='Plano autorizado, aguardando worker.' WHERE id=$1",[stage.id,EXECUTION_INSTRUCTION,{plan_id:planId,job_id:bundles[0].job_id}]);
        await db.query("UPDATE research.stages SET status='blocked',message='Aguardando evidências independentes de execução.' WHERE run_id=$1 AND agent='evaluation' AND status='not_supported'",[runId]);
        await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,$6,'admin')`,[randomUUID(),runId,stage.id,justification,{status:stage.status},{job_id:bundles[0].job_id,plan_id:planId,manifest_sha256:manifestRef.sha256,bundles:manifest.bundles,policy_sha256:receipt.policy_sha256,image:receipt.images[scope.module.adapter].image_id}]);
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
          assert(script?.review_status==='approved' && script.version===pinned.version && script.revision===pinned.revision && script.files.sha256===pinned.files.sha256,'Script/revisão mudou depois da autorização; crie nova análise.',422);
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
