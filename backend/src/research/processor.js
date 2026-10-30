import { randomUUID } from 'node:crypto';
import { AGENTS, validateOutput } from './agents.js';
import { transaction } from './errors.js';
import { createAutomationService } from './automation.js';
import { validateAutomation } from './automation-contract.js';
import {createExecutionService} from './execution.js';
import {createEvaluationService} from './evaluation.js';
import {validateEvaluation} from './evaluation-contract.js';

export function createProcessor({ pool, store, generate, executorClient }) {
  const automation=createAutomationService({pool,store});
  const execution=createExecutionService({pool,store,client:executorClient});
  const evaluation=createEvaluationService({pool,store});
  async function claim() {
    return transaction(pool, async db => {
      const run = (await db.query(`SELECT r.* FROM research.runs r WHERE r.status='pending'
        AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='pending' AND s.attempt_count<3)
        ORDER BY r.created_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
      if (!run) return null;
      const stage = (await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND status='pending' ORDER BY position LIMIT 1 FOR UPDATE",[run.id])).rows[0];
      const token = randomUUID();
      const attemptId = randomUUID();
      await db.query("UPDATE research.stages SET status='running',attempt_count=attempt_count+1,lease_token=$2,lease_until=now()+interval '180 seconds',message=NULL WHERE id=$1",[stage.id,token]);
      await db.query("UPDATE research.runs SET status='running' WHERE id=$1",[run.id]);
      await db.query("INSERT INTO research.attempts(id,stage_id,number,status) VALUES($1,$2,$3,'running')",[attemptId,stage.id,stage.attempt_count+1]);
      return {run,stage,token,attemptId};
    });
  }
  async function finish(job, { inputRef, outputRef, metadata, output, error, elapsed }) {
    return transaction(pool, async db => {
      await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);
      const current = (await db.query('SELECT status,lease_token FROM research.stages WHERE id=$1 FOR UPDATE',[job.stage.id])).rows[0];
      if (current.status !== 'running' || current.lease_token !== job.token) {
        // Preserve a resposta tardia para auditoria, sem reabrir a execução cancelada/interrompida.
        await db.query(`UPDATE research.attempts SET input=COALESCE(input,$2),output=COALESCE(output,$3),provider_metadata=COALESCE(provider_metadata,$4),duration_ms=COALESCE(duration_ms,$5)
          WHERE id=$1`,[job.attemptId,inputRef,outputRef,metadata,elapsed]);
        return;
      }
      if (!error) {
        if(job.stage.agent==='evaluation')await evaluation.persist(db,job,output);
        else if(job.stage.agent==='execution')await execution.persist(db,job,output);
        else if(job.stage.agent==='automation') await automation.persist(db,job,output);
        else {
        const items = job.stage.agent === 'requirements' ? output.requirements : output.test_cases;
        const table = job.stage.agent === 'requirements' ? 'requirements' : 'test_cases';
        for (const content of items) {
          const id = randomUUID();
          await db.query(`INSERT INTO research.${table}(id,run_id,code,content) VALUES($1,$2,$3,$4)`,[id,job.run.id,content.code,JSON.stringify(content)]);
          if (table === 'test_cases') for (const code of content.requirement_codes) await db.query(`INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id)
            SELECT $1,$2,id FROM research.requirements WHERE run_id=$1 AND code=$3 AND review_status='approved'`,[job.run.id,id,code]);
        }
        }
      }
      if(error && job.stage.agent==='execution')await db.query("UPDATE research.execution_jobs SET status='failed',error=$2,finished_at=now() WHERE id=$1",[job.stage.context.job_id,error]);
      await db.query(`UPDATE research.attempts SET status=$2,input=$3,output=$4,provider_metadata=$5,error=$6,finished_at=now(),duration_ms=$7 WHERE id=$1`,
        [job.attemptId,error ? 'failed' : 'completed',inputRef,outputRef,metadata,error,elapsed]);
      const unsupported=job.stage.agent==='automation' && !error && output.artifacts.length===0;
      const executed=job.stage.agent==='execution' && !error;
      await db.query(`UPDATE research.stages SET status=$2,message=$3,lease_token=NULL,lease_until=NULL WHERE id=$1`,
        [job.stage.id,error ? 'failed' : executed ? 'completed' : unsupported ? 'not_supported' : 'awaiting_review',error || (executed ? 'Evidências independentes do executor preservadas.' : unsupported ? 'Nenhum caso selecionado pôde ser automatizado. Consulte as justificativas.' : 'Resultados estruturados disponíveis para revisão humana.')]);
      await db.query(`UPDATE research.runs SET status=$2,finished_at=${error || unsupported || executed ? 'now()' : 'NULL'} WHERE id=$1`,[job.run.id,error ? 'failed' : unsupported || executed ? 'completed' : 'awaiting_review']);
      if(executed)await evaluation.queue(db,job.run.id);
    });
  }
  return {
    async recoverExpired() {
      return transaction(pool, async db => {
        const expired = (await db.query(`SELECT r.id FROM research.runs r WHERE r.status='running'
          AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='running' AND s.lease_until<now())
          FOR UPDATE SKIP LOCKED`)).rows;
        for (const run of expired) {
          const stages = (await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND status='running' AND lease_until<now() FOR UPDATE",[run.id])).rows;
          for (const stage of stages) {
            await db.query("UPDATE research.attempts SET status='interrupted',finished_at=now(),error='Worker interrompido ou prazo da etapa excedido.' WHERE stage_id=$1 AND status='running'",[stage.id]);
            await db.query("UPDATE research.stages SET status='failed',message='Worker interrompido. Repetição explícita necessária.',lease_token=NULL,lease_until=NULL WHERE id=$1",[stage.id]);
          }
          await db.query("UPDATE research.runs SET status='failed',finished_at=now() WHERE id=$1",[run.id]);
          await db.query("UPDATE research.execution_jobs SET status='failed',error='Worker interrompido; consulte o executor antes de repetir.',finished_at=now() WHERE run_id=$1 AND status='running'",[run.id]);
        }
        return expired.length;
      });
    },
    async processOne() {
      const job = await claim();
      if (!job) return false;
      const started = Date.now();
      let inputRef = null, outputRef = null, metadata = null, output = null, error = null;
      try {
        const snapshot = await store.json(job.run.snapshot);
        let input;
        if(job.stage.agent==='evaluation')input=await evaluation.inputFor(job.run.id);
        else if(job.stage.agent==='execution')input=await execution.prepare(job);
        else if(job.stage.agent==='automation') input=await automation.inputFor(job.run.id,job.stage);
        else if (job.stage.agent === 'requirements') input = {project_name:snapshot.project.name,documents:snapshot.documents};
        else input = {project_name:snapshot.project.name,code_version:snapshot.code_version,
          requirements:(await pool.query("SELECT content FROM research.requirements WHERE run_id=$1 AND review_status='approved' ORDER BY code",[job.run.id])).rows.map(row => row.content)};
        const definition = ['automation','evaluation'].includes(job.stage.agent) ? {schema:job.stage.context.schema} : (snapshot.agent_definitions || AGENTS).find(agent => agent.agent === job.stage.agent);
        const request = { model:job.run.model,parameters:job.run.parameters,instruction:job.stage.instruction,
          instruction_version:job.stage.instruction_version,schema:definition.schema,input };
        inputRef = await store.put(request);
        // Cliente injetável; prazo também cobre provedores que não respeitem AbortSignal.
        const controller = new AbortController();
        let timer;
        let monitoring=false;
        const monitor=setInterval(async()=>{
          if(monitoring || controller.signal.aborted)return;monitoring=true;
          try{const row=(await pool.query('SELECT status,lease_token FROM research.stages WHERE id=$1',[job.stage.id])).rows[0];if(row?.status!=='running' || row.lease_token!==job.token)controller.abort();}
          catch{controller.abort();}finally{monitoring=false;}
        },2000);
        try {
          const result = await Promise.race([job.stage.agent==='execution' ? execution.perform(input,controller.signal).then(result=>({raw:JSON.stringify(result),metadata:{provider:'deterministic-executor'}})) : generate({...request,signal:controller.signal}),new Promise((_,reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Prazo de 95 segundos excedido na chamada ao modelo.')); },95000);
          })]);
          metadata = result.metadata;
          outputRef = await store.put({raw:result.raw});
          output = JSON.parse(result.raw);
          if(job.stage.agent==='automation')validateAutomation(output,input);
          else if(job.stage.agent==='evaluation')validateEvaluation(output,input);
          else if(job.stage.agent!=='execution')validateOutput(job.stage.agent,output,input);
        } finally { clearTimeout(timer);clearInterval(monitor); }
      } catch (cause) {
        // Não persistir objetos do SDK, cabeçalhos ou credenciais recebidos em erros remotos.
        error = cause.statusCode === 422 ? cause.message.slice(0,1000) :
          cause instanceof SyntaxError ? 'Resposta do modelo não é JSON válido. Consulte a saída bruta preservada.' :
          cause.name === 'AbortError' || cause.message?.includes('Prazo') ? 'Tempo limite da chamada ao modelo excedido.' :
          'Falha de processamento. Verifique disponibilidade do provedor, modelo, credenciais e armazenamento.';
      }
      await finish(job,{inputRef,outputRef,metadata,output,error,elapsed:Date.now()-started});
      return true;
    },
  };
}
