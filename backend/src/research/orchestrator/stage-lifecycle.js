import { randomUUID } from 'node:crypto';
import {validateRequirement} from '../agents/requirements/contracts.js';
import { transaction } from '../shared/errors.js';
import {consolidateParts} from '../agents/requirements/parts.js';
import {preservedOutput} from '../agents/requirements/citations.js';
import {persistTestPart,testCoverage} from '../agents/tests/cases/parts.js';
import {assert} from '../shared/errors.js';
import {appendRunEvent} from '../storage/run-events.js';
import {recordAttemptOutput} from '../storage/attempt-snapshots.js';

export function createStageLifecycle({pool,store,automation,execution,evaluation}) {
  async function finish(job, { inputRef, outputRef, metadata, output, error, elapsed, automationValidated=false }) {
    return transaction(pool, async db => {
      await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);
      const current = (await db.query('SELECT status,lease_token FROM research.stages WHERE id=$1 FOR UPDATE',[job.stage.id])).rows[0];
      if (current.status !== 'running' || current.lease_token !== job.token) {
        // Preserve a resposta tardia para auditoria, sem reabrir a execução cancelada/interrompida.
        await db.query(`UPDATE research.attempts SET input=COALESCE(input,$2),output=COALESCE(output,$3),provider_metadata=COALESCE(provider_metadata,$4),duration_ms=COALESCE(duration_ms,$5)
          WHERE id=$1`,[job.attemptId,inputRef,outputRef,metadata,elapsed]);
        await recordAttemptOutput(db,store,job,{inputRef,outputRef,output,error,late:true});
        return;
      }
      let partial=false;
      if(job.part) {
        await db.query('UPDATE research.requirement_parts SET status=$2,output=$3,error=$4 WHERE id=$1',[job.part.id,error ? 'failed' : 'completed',outputRef,error]);
        if(!error) {
          const parts=(await db.query('SELECT * FROM research.requirement_parts WHERE run_id=$1 ORDER BY sequence',[job.run.id])).rows;
          partial=parts.some(p=>p.status!=='completed');
          if(!partial) {
            const inputs=[];for(const part of parts)inputs.push({id:part.id,output:preservedOutput(await store.json(part.output))});
            const consolidated=consolidateParts(inputs),snapshot=await store.json(job.run.snapshot);
            consolidated.output.requirements.forEach(req=>validateRequirement(req,snapshot.documents));
            const ref=await store.put(consolidated);
            await db.query('UPDATE research.runs SET consolidation=$2 WHERE id=$1',[job.run.id,ref]);output=consolidated.output;
          }
        }
      }
      if(job.testPart) {
        const mapping=error ? [] : await persistTestPart(db,job.run.id,output);
        await db.query('UPDATE research.test_parts SET status=$2,output=$3,error=$4,mapping=$5 WHERE id=$1',[job.testPart.id,error ? 'failed' : 'completed',outputRef,error,JSON.stringify(mapping)]);
        if(!error) {
          partial=Boolean((await db.query("SELECT id FROM research.test_parts WHERE run_id=$1 AND status IN ('pending','running','failed') LIMIT 1",[job.run.id])).rowCount);
          if(!partial) {
            const requirements=(await db.query('SELECT code,content,review_status,processing_status FROM research.requirements WHERE run_id=$1',[job.run.id])).rows;
            const cases=(await db.query('SELECT code,content,review_status,processing_status FROM research.test_cases WHERE run_id=$1',[job.run.id])).rows;
            assert(!testCoverage(requirements,cases).missing.length,'Consolidação de testes possui requisitos sem caso. Complete os cenários antes de continuar.',422);
          }
        }
      }
      if(job.automationPart) {
        const dispositions=[...job.automationPart.dispositions,...(!error || automationValidated ? await automation.persist(db,job,output) : [])];
        await db.query('UPDATE research.automation_parts SET status=$2,output=$3,error=$4,dispositions=$5 WHERE id=$1',[job.automationPart.id,error ? 'failed' : 'completed',outputRef,error,JSON.stringify(dispositions)]);
        if(!error) {
          const parts=(await db.query('SELECT status,dispositions FROM research.automation_parts WHERE run_id=$1',[job.run.id])).rows;
          partial=parts.some(part=>part.status!=='completed');
          if(!partial){const addressed=parts.flatMap(part=>part.dispositions.filter(item=>item.status!=='deferred').map(item=>item.test_case_id));assert(addressed.length===job.stage.context.case_ids.length && new Set(addressed).size===addressed.length && job.stage.context.case_ids.every(id=>addressed.includes(id)),'Existem casos sem script ou justificativa na consolidação.',422);}
        }
      }
      if (!error && !partial && !job.testPart && !job.automationPart) {
        if(job.stage.agent==='evaluation')await evaluation.persist(db,job,output);
        else if(job.stage.agent==='execution') {if(job.stage.context.phase==='planning')await execution.persistPlanning(db,job,output);else if(job.stage.context.phase==='diagnosis')await execution.persistDiagnosis(db,job,output,inputRef);else await execution.persist(db,job,output);}
        else if(job.stage.agent==='automation') await automation.persist(db,job,output);
        else {
        const items = job.stage.agent === 'requirements' ? output.requirements : output.test_cases;
        const table = job.stage.agent === 'requirements' ? 'requirements' : 'test_cases';
        for (const content of items) {
          const id = randomUUID();
          await db.query(`INSERT INTO research.${table}(id,run_id,code,content) VALUES($1,$2,$3,$4)`,[id,job.run.id,content.code,JSON.stringify(content)]);
          if (table === 'test_cases') for (const code of content.requirement_codes) await db.query(`INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id)
            SELECT $1,$2,id FROM research.requirements WHERE run_id=$1 AND code=$3 AND research.artifact_eligible(run_id,review_status,processing_status)`,[job.run.id,id,code]);
        }
        }
      }
      if(job.stage.agent==='execution' && !['planning','diagnosis'].includes(job.stage.context.phase)) {
        if(error){await db.query("UPDATE research.execution_jobs SET status='failed',error=$2,finished_at=now() WHERE id=$1",[job.stage.context.job_id,error]);await db.query("UPDATE research.execution_plans SET status='failed',finished_at=now() WHERE run_id=$1",[job.run.id]);}
        else {const next=(await db.query("SELECT * FROM research.execution_jobs WHERE run_id=$1 AND status<>'completed' ORDER BY sequence LIMIT 1",[job.run.id])).rows[0];
          if(next){partial=true;await db.query('UPDATE research.stages SET context=$2,attempt_count=$3 WHERE id=$1',[job.stage.id,{...job.stage.context,job_id:next.id},next.attempt_count]);}}
      }
      await db.query(`UPDATE research.attempts SET status=$2,input=$3,output=$4,provider_metadata=$5,error=$6,finished_at=now(),duration_ms=$7 WHERE id=$1`,
        [job.attemptId,error ? 'failed' : 'completed',inputRef,outputRef,metadata,error,elapsed]);
      await recordAttemptOutput(db,store,job,{inputRef,outputRef,output,error});
      await appendRunEvent(db,{run_id:job.run.id,source_key:`attempt:${job.attemptId}:finished`,kind:error?'attempt_failed':'attempt_finished',actor:job.executionJob?'executor':'agent',agent:job.stage.agent,stage_id:job.stage.id,attempt_id:job.attemptId,job_id:job.executionJob?.id,payload:{phase:job.stage.context?.phase,status:error?'failed':'completed',error:error||null,elapsed_ms:elapsed,partial}});
      const unsupported=job.stage.agent==='automation' && !error && !partial && !(await db.query('SELECT id FROM research.automated_tests WHERE run_id=$1 LIMIT 1',[job.run.id])).rowCount;
      const diagnosed=job.stage.agent==='execution' && job.stage.context.phase==='diagnosis' && !error;
      const executed=job.stage.agent==='execution' && !['planning','diagnosis'].includes(job.stage.context.phase) && !error && !partial;
      await db.query(`UPDATE research.stages SET status=$2,message=$3,lease_token=NULL,lease_until=NULL WHERE id=$1`,
        [job.stage.id,error ? 'failed' : partial ? 'pending' : executed || diagnosed ? 'completed' : unsupported ? 'not_supported' : 'awaiting_review',error || (partial ? `Parte ${(job.part || job.testPart || job.automationPart || job.executionJob).sequence} concluída; checkpoint preservado.` : diagnosed ? 'Diagnóstico técnico proposto; revisão humana separada.' : executed ? 'Evidências independentes do executor preservadas.' : unsupported ? 'Nenhum caso selecionado pôde ser automatizado. Consulte as justificativas.' : 'Resultados estruturados disponíveis para revisão humana.')]);
      await db.query(`UPDATE research.runs SET status=$2,finished_at=${error || unsupported || executed ? 'now()' : 'NULL'} WHERE id=$1`,[job.run.id,error ? 'failed' : partial ? 'pending' : unsupported && job.run.workflow_mode==='autonomous/v1' ? 'awaiting_review' : unsupported || executed ? 'completed' : 'awaiting_review']);
      if(diagnosed || (executed && !await execution.queueDiagnosis(db,job.run.id)))await evaluation.queue(db,job.run.id);
    });
  }
  async function recoverExpired() {
      return transaction(pool, async db => {
        const expired = (await db.query(`SELECT r.id FROM research.runs r WHERE r.status='running'
          AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='running' AND s.lease_until<now())
          FOR UPDATE SKIP LOCKED`)).rows;
        for (const run of expired) {
          const stages = (await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND status='running' AND lease_until<now() FOR UPDATE",[run.id])).rows;
          for (const stage of stages) {
            await db.query("UPDATE research.attempts SET status='interrupted',finished_at=now(),error='Worker interrompido ou prazo da etapa excedido.' WHERE stage_id=$1 AND status='running'",[stage.id]);
            await db.query("UPDATE research.stages SET status='failed',message='Worker interrompido. Repetição explícita necessária.',lease_token=NULL,lease_until=NULL WHERE id=$1",[stage.id]);
            await db.query("UPDATE research.execution_jobs SET status='failed',error='Worker interrompido.' WHERE stage_id=$1 AND status='running'",[stage.id]);
            await db.query("UPDATE research.execution_plans SET status='failed' WHERE run_id=$1 AND status='running'",[run.id]);
            await db.query("UPDATE research.agent_sessions SET status='interrupted',stop_reason='worker_interrupted',finished_at=now(),usage_unknown=usage_unknown OR EXISTS(SELECT 1 FROM research.agent_steps p WHERE p.session_id=research.agent_sessions.id AND p.status='requested') WHERE stage_id=$1 AND status='running'",[stage.id]);
          }
          await db.query("UPDATE research.runs SET status='failed',finished_at=now() WHERE id=$1",[run.id]);
          await appendRunEvent(db,{run_id:run.id,source_key:`worker:interrupted:${stages.map(s=>s.id).join(':')}`,kind:'worker_interrupted',payload:{stage_ids:stages.map(s=>s.id),reason:'Worker interrompido ou prazo excedido; resposta não presumida.'}});
          await db.query("UPDATE research.execution_jobs SET status='failed',error='Worker interrompido; consulte o executor antes de repetir.',finished_at=now() WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.requirement_parts SET status='failed',error='Worker interrompido; parte requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.test_parts SET status='failed',error='Worker interrompido; lote requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.automation_parts SET status='failed',error='Worker interrompido; lote requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
        }
        return expired.length;
      });
    }
  return {finish,recoverExpired};
}
