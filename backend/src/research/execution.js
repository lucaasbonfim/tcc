import {randomUUID} from 'node:crypto';
import {assert,text,transaction} from './errors.js';
import {createExecutorClient} from './executor-client.js';
import {sha256,validateBundle,validateExecutionResult} from '../../../shared/execution-protocol.js';

export const EXECUTION_INSTRUCTION='Agente 3 determinístico v2: executar somente scripts aprovados com fontes do SHA em serviço dedicado autenticado e política validada; comandos fixos por adaptador. Preservar ambiente, resultados e evidências sem inferir defeito funcional. Nenhuma chamada LLM autoriza comandos.';
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
        assert(scripts.length>0 && scripts.length<=20,'Nenhum script aprovado compatível.',422);
        const scope=await store.json(automation.context.scope);
        assert(receipt.images[scope.module.adapter],'Imagem do adaptador indisponível.',503);
        const id=randomUUID(),bundle={protocol_version:1,job_id:id,run_id:runId,repository_url:scope.repository_url,commit_sha:scope.commit_sha,adapter:scope.module.adapter,
          source_files:scope.files.map(({path,content,git_sha,sha256})=>({path,content,git_sha,sha256})),generated_tests:[]};
        for(const script of scripts)bundle.generated_tests.push({id:script.id,test_case_id:script.test_case_id,version:script.version,
          files:(await store.json(script.files)).map(file=>({...file,sha256:sha256(file.code)}))});
        validateBundle(bundle);
        const bundleRef=await store.put(bundle),hash=sha256(bundle);
        const stage=(await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='execution' FOR UPDATE",[runId])).rows[0];
        await db.query(`INSERT INTO research.execution_jobs(id,run_id,stage_id,status,adapter,bundle,request_sha256,executor_receipt)
          VALUES($1,$2,$3,'pending',$4,$5,$6,$7)`,[id,runId,stage.id,bundle.adapter,bundleRef,hash,JSON.stringify(receipt)]);
        await db.query("UPDATE research.stages SET status='pending',instruction_version='2.0.0',instruction=$2,context=$3,message='Execução autorizada, aguardando worker.' WHERE id=$1",[stage.id,EXECUTION_INSTRUCTION,{job_id:id}]);
        await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
        await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
          VALUES($1,$2,$3,'stage',$3,'approved',$4,$5,$6,'admin')`,[randomUUID(),runId,stage.id,justification,{status:stage.status},{job_id:id,bundle_sha256:hash,policy_sha256:receipt.policy_sha256,image:receipt.images[bundle.adapter].image_id}]);
        return {job_id:id,status:'pending'};
      });
    },
    async prepare(job) {
      const row=(await pool.query('SELECT * FROM research.execution_jobs WHERE id=$1 AND run_id=$2',[job.stage.context.job_id,job.run.id])).rows[0];
      assert(row && row.status!=='cancelled','Trabalho não autorizado ou cancelado.',409);
      const bundle=await store.json(row.bundle);validateBundle(bundle);
      assert(sha256(bundle)===row.request_sha256,'Bundle de execução adulterado.',409);
      await pool.query("UPDATE research.execution_jobs SET status='running',error=NULL WHERE id=$1 AND status<>'cancelled'",[row.id]);
      return {bundle,receipt:row.executor_receipt};
    },
    async perform(input,signal){return client.execute(input.bundle,input.receipt,{signal});},
    async persist(db,job,output) {
      const row=(await db.query('SELECT * FROM research.execution_jobs WHERE id=$1 FOR UPDATE',[job.stage.context.job_id])).rows[0];
      const bundle=await store.json(row.bundle);validateExecutionResult(output,bundle,row.request_sha256);
      assert(output.environment.image_id===row.executor_receipt.images[row.adapter].image_id && output.environment.deployment_id===row.executor_receipt.deployment_id && output.environment.policy_sha256===row.executor_receipt.policy_sha256,'Ambiente recebido não corresponde à autorização.',422);
      const ref=await store.put(output),evidenceId=randomUUID();
      await db.query("UPDATE research.execution_jobs SET status='completed',result=$2,finished_at=now() WHERE id=$1",[row.id,ref]);
      await db.query('INSERT INTO research.evidence(id,run_id,job_id,artifact) VALUES($1,$2,$3,$4)',[evidenceId,job.run.id,row.id,ref]);
      for(const test of output.tests)await db.query(`INSERT INTO research.test_results(id,run_id,job_id,evidence_id,automated_test_id,test_case_id,status,content)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),job.run.id,row.id,evidenceId,test.artifact_id,test.test_case_id,test.status,JSON.stringify(test)]);
    },
    async list(runId) {
      const jobs=(await pool.query('SELECT * FROM research.execution_jobs WHERE run_id=$1 ORDER BY created_at',[runId])).rows;
      return Promise.all(jobs.map(async job=>({...job,result_data:job.result ? await store.json(job.result) : null})));
    },
    async cancel(runId){for(const row of (await pool.query('SELECT id FROM research.execution_jobs WHERE run_id=$1',[runId])).rows)await client.cancel(row.id).catch(()=>{});},
  };
}
