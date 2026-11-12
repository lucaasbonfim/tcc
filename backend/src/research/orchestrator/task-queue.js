import { randomUUID } from 'node:crypto';
import { transaction } from '../shared/errors.js';
import {assert} from '../shared/errors.js';
import {appendRunEvent} from '../storage/run-events.js';

export function createTaskQueue({pool}) {
  async function claim() {
    return transaction(pool, async db => {
      const run = (await db.query(`SELECT r.* FROM research.runs r WHERE r.status='pending'
        AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='pending' AND
          (s.attempt_count<3 OR (s.agent='requirements' AND EXISTS(SELECT 1 FROM research.requirement_parts p WHERE p.run_id=r.id AND p.status='pending')
            AND NOT EXISTS(SELECT 1 FROM research.requirement_parts p WHERE p.run_id=r.id AND p.status='failed'))
            OR (s.agent='tests' AND EXISTS(SELECT 1 FROM research.test_parts p WHERE p.run_id=r.id AND p.status='pending' AND p.attempt_count<3)
            AND NOT EXISTS(SELECT 1 FROM research.test_parts p WHERE p.run_id=r.id AND p.status='failed'))
            OR (s.agent='automation' AND EXISTS(SELECT 1 FROM research.automation_parts p WHERE p.run_id=r.id AND p.status='pending' AND p.attempt_count<3)
            AND NOT EXISTS(SELECT 1 FROM research.automation_parts p WHERE p.run_id=r.id AND p.status='failed'))))
        ORDER BY r.created_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
      if (!run) return null;
      const stage = (await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND status='pending' ORDER BY position LIMIT 1 FOR UPDATE",[run.id])).rows[0];
      const token = randomUUID();
      const attemptId = randomUUID();
      const part=stage.agent==='requirements' ? (await db.query("SELECT * FROM research.requirement_parts WHERE run_id=$1 AND status IN ('pending','failed') ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const testPart=stage.agent==='tests' ? (await db.query("SELECT * FROM research.test_parts WHERE run_id=$1 AND status IN ('pending','failed') AND attempt_count<3 ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const automationPart=stage.agent==='automation' ? (await db.query("SELECT * FROM research.automation_parts WHERE run_id=$1 AND status IN ('pending','failed') AND attempt_count<3 ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const executing=stage.agent==='execution' && !['planning','diagnosis'].includes(stage.context.phase);
      const executionJob=executing ? (await db.query('SELECT * FROM research.execution_jobs WHERE run_id=$1 AND id=$2 AND attempt_count<3 FOR UPDATE',[run.id,stage.context.job_id])).rows[0] : null;
      if(executing)assert(executionJob,'Trabalho de execução esgotado ou ausente.',409);
      const checkpoint=part || testPart || automationPart || executionJob;
      const increment=!checkpoint || stage.attempt_count===0 || checkpoint.status==='failed' ? 1 : 0;
      await db.query("UPDATE research.stages SET status='running',attempt_count=attempt_count+$3,lease_token=$2,lease_until=now()+interval '180 seconds',message=NULL WHERE id=$1",[stage.id,token,increment]);
      if(part)await db.query("UPDATE research.requirement_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[part.id]);
      if(testPart)await db.query("UPDATE research.test_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[testPart.id]);
      if(automationPart)await db.query("UPDATE research.automation_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[automationPart.id]);
      if(executionJob)await db.query("UPDATE research.execution_jobs SET attempt_count=attempt_count+1 WHERE id=$1",[executionJob.id]);
      await db.query("UPDATE research.runs SET status='running' WHERE id=$1",[run.id]);
      const number=(await db.query('SELECT COALESCE(max(number),0)+1 AS n FROM research.attempts WHERE stage_id=$1',[stage.id])).rows[0].n;
      await db.query("INSERT INTO research.attempts(id,stage_id,number,status,requirement_part_id,test_part_id,automation_part_id,execution_job_id) VALUES($1,$2,$3,'running',$4,$5,$6,$7)",[attemptId,stage.id,number,part?.id || null,testPart?.id || null,automationPart?.id || null,executionJob?.id || null]);
      await appendRunEvent(db,{run_id:run.id,source_key:`attempt:${attemptId}:started`,kind:'attempt_started',agent:stage.agent,stage_id:stage.id,attempt_id:attemptId,job_id:executionJob?.id,payload:{number,phase:stage.context?.phase,part_sequence:checkpoint?.sequence}});
      return {run,stage,token,attemptId,part,testPart,automationPart,executionJob};
    });
  }
  return {claim};
}
