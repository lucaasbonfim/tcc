import {createRunService} from '../services/runs.js';
import {createAutomationService} from '../services/automation.js';
import {createExecutionService} from '../services/execution.js';
import {assertInitialGrant} from './workflow-policy.js';
import {appendRunEvent} from '../storage/run-events.js';
import {transaction} from '../shared/errors.js';
export const AUTONOMY_LOCK_PREFIX='autonomy:xact/v1:';
export function createAutonomyController({pool,store,executorClient}) {
  const runs=createRunService({pool,store,executorClient}),automation=createAutomationService({pool,store}),execution=createExecutionService({pool,store,client:executorClient});
  async function advance(runId) {
    const lock=await pool.connect();let begun=false;
    try {
      // Pin one physical connection through transaction poolers. Session locks
      // acquired/unlocked in separate statements can strand ownership remotely.
      await lock.query('BEGIN');begun=true;
      const owned=(await lock.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS owned',[AUTONOMY_LOCK_PREFIX+runId])).rows[0].owned;if(!owned)return;
      for(let count=0;count<8;count++) {
        const run=(await pool.query('SELECT * FROM research.runs WHERE id=$1',[runId])).rows[0];if(run?.workflow_mode!=='autonomous/v1'||['completed','failed','cancelled','running'].includes(run.status))return;
        const stages=(await pool.query('SELECT * FROM research.stages WHERE run_id=$1 ORDER BY position',[runId])).rows;
        if(stages.some(s=>s.status==='running'||s.status==='pending'))return;
        const requirements=stages.find(s=>s.agent==='requirements'),tests=stages.find(s=>s.agent==='tests'),scripts=stages.find(s=>s.agent==='automation'),exec=stages.find(s=>s.agent==='execution'),evaluation=stages.find(s=>s.agent==='evaluation');
        const justification='Avanço automático sob autorização inicial; não é aprovação humana.';
        if(requirements?.status==='awaiting_review')await runs.approveStage(runId,'requirements',{justification},{automatic:true});
        else if(tests?.status==='awaiting_review')await runs.approveStage(runId,'tests',{justification},{automatic:true});
        else if(tests?.status==='completed' && !scripts) {const grant=await assertInitialGrant(pool,run,store);await automation.start(runId,{inspection_id:grant.inspection_id,module_root:grant.module_root,justification},{automatic:true});}
        else if(scripts?.status==='awaiting_review')await automation.approve(runId,{justification},{automatic:true});
        else if(scripts?.status==='completed' && exec.status==='not_supported') {
          const snapshot=await store.json(run.snapshot);if(snapshot.agent_policy?.modes.execution==='agent/v1')await execution.startPlanning(runId,{justification},{automatic:true});else await execution.authorize(runId,{justification},{automatic:true});
        } else if(exec?.status==='awaiting_review' && exec.context.phase==='planning')await execution.authorize(runId,{proposal_id:exec.context.proposal_id,justification},{automatic:true});
        else if(evaluation?.status==='awaiting_review' || scripts?.status==='not_supported') {
          await transaction(pool,async db=>{const current=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];if(['failed','cancelled'].includes(current.status))return;
            if(evaluation.status==='awaiting_review')await db.query("UPDATE research.stages SET status='completed',message='Saída autônoma preservada; avaliação humana posterior pendente.' WHERE id=$1",[evaluation.id]);
            await db.query("UPDATE research.runs SET status='completed',finished_at=now() WHERE id=$1",[runId]);
            await appendRunEvent(db,{run_id:runId,source_key:'workflow:finished',kind:'workflow_finished',payload:{human_evaluated:false,outcome:scripts?.status==='not_supported'?'no_executable_scripts':'artifacts_produced'}});});return;
        } else return;
      }
    }catch(error){await transaction(pool,async db=>{const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];if(!run||['completed','failed','cancelled','running'].includes(run.status))return;
      const message=[403,409,422,503].includes(error.statusCode)?error.message.slice(0,1000):'Falha ao avançar o fluxo autônomo; consulte o histórico.';
      await db.query("UPDATE research.runs SET status='failed',workflow_error=$2,finished_at=now() WHERE id=$1",[runId,message]);await appendRunEvent(db,{run_id:runId,source_key:'workflow:failed',kind:'workflow_failed',payload:{message}});});}
    finally{let releaseError;if(begun)try{await lock.query('ROLLBACK');}catch(error){releaseError=error;}lock.release(releaseError);}
  }
  return {advance,async recoverReady(){const rows=(await pool.query("SELECT id FROM research.runs WHERE workflow_mode='autonomous/v1' AND status IN ('pending','awaiting_review') ORDER BY created_at LIMIT 10")).rows;for(const row of rows)await advance(row.id);}};
}
