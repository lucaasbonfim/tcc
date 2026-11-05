import {randomUUID} from 'node:crypto';
import {assert,transaction} from './errors.js';
import {assertSessionTransition} from './agent-contract.js';

export function createAgentSessionStore(pool,job) {
  async function owned(db) {
    const stage=(await db.query('SELECT * FROM research.stages WHERE id=$1 FOR UPDATE',[job.stage.id])).rows[0];
    assert(stage?.run_id===job.run.id && stage.status==='running' && stage.lease_token===job.token && new Date(stage.lease_until)>new Date(),'Posse da tarefa expirada ou cancelada.',409);
  }
  async function locked(db,id) {
    // Lock order matches the processor: run before stage before session.
    await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);
    await owned(db);
    const session=(await db.query('SELECT * FROM research.agent_sessions WHERE id=$1 AND run_id=$2 AND stage_id=$3 FOR UPDATE',[id,job.run.id,job.stage.id])).rows[0];
    assert(session && session.attempt_id===job.attemptId,'Sessão fora da tentativa.',409);
    return session;
  }
  return {
    async find() {return (await pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[job.attemptId])).rows[0];},
    async previous() {return job.automationPart ? (await pool.query('SELECT * FROM research.agent_sessions WHERE automation_part_id=$1 AND attempt_id<>$2 ORDER BY started_at DESC LIMIT 1',[job.automationPart.id,job.attemptId])).rows[0] : null;},
    async heartbeat() {return Boolean((await pool.query("UPDATE research.stages SET lease_until=now()+interval '180 seconds' WHERE id=$1 AND run_id=$2 AND status='running' AND lease_token=$3 RETURNING id",[job.stage.id,job.run.id,job.token])).rowCount);},
    async create({task,policy,context}) {
      return transaction(pool,async db=>{
        await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);await owned(db);
        const existing=(await db.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[job.attemptId])).rows[0];
        if(existing)return existing;
        return (await db.query(`INSERT INTO research.agent_sessions(id,project_id,run_id,stage_id,attempt_id,automation_part_id,agent,mode,status,task,policy,context)
          VALUES($1,$2,$3,$4,$5,$6,'automation','agent/v1','running',$7,$8,$9) RETURNING *`,
          [randomUUID(),job.run.project_id,job.run.id,job.stage.id,job.attemptId,job.automationPart?.id ?? null,task,policy,context])).rows[0];
      });
    },
    async get(id) {return (await pool.query('SELECT * FROM research.agent_sessions WHERE id=$1 AND run_id=$2 AND attempt_id=$3',[id,job.run.id,job.attemptId])).rows[0];},
    async beginStep(id,request) {
      return transaction(pool,async db=>{
        const session=await locked(db,id);assert(session.status==='running','Sessão encerrada.',409);
        const used=(await db.query(`SELECT COALESCE(sum(model_turns),0)::int AS model_turns,COALESCE(sum(total_tokens),0)::bigint AS total_tokens
          FROM research.agent_sessions WHERE run_id=$1`,[job.run.id])).rows[0];
        const previous=job.automationPart ? (await db.query('SELECT COALESCE(sum(model_turns),0)::int AS turns,COALESCE(sum(total_tokens),0)::bigint AS tokens FROM research.agent_sessions WHERE automation_part_id=$1',[job.automationPart.id])).rows[0] : {turns:session.model_turns,tokens:session.total_tokens};
        assert(previous.turns<session.policy.limits.max_model_turns && Number(previous.tokens)<session.policy.limits.max_total_tokens && used.model_turns<session.policy.run_limits.max_model_turns && Number(used.total_tokens)<session.policy.run_limits.max_total_tokens,'Orçamento de chamadas/tokens esgotado.',422);
        assert(!(await db.query("SELECT id FROM research.agent_steps WHERE session_id=$1 AND status='requested'",[id])).rowCount,'Turno anterior sem resposta; requer interrupção explícita.',409);
        const sequence=(await db.query('SELECT COALESCE(max(sequence),0)+1 AS n FROM research.agent_steps WHERE session_id=$1',[id])).rows[0].n;
        const step=(await db.query("INSERT INTO research.agent_steps(id,session_id,sequence,status,request) VALUES($1,$2,$3,'requested',$4) RETURNING *",[randomUUID(),id,sequence,request])).rows[0];
        await db.query('UPDATE research.agent_sessions SET model_turns=model_turns+1 WHERE id=$1',[id]);return step;
      });
    },
    async completeStep(id,stepId,response,metadata,checkpoint=null,elapsed=0) {
      return transaction(pool,async db=>{
        const session=await locked(db,id);assert(session.status==='running','Sessão encerrada.',409);
        const step=(await db.query('SELECT * FROM research.agent_steps WHERE session_id=$1 AND id=$2 FOR UPDATE',[id,stepId])).rows[0];
        assert(step,'Turno fora da sessão.',409);
        if(step.status==='completed'){assert(step.response?.sha256===response.sha256,'Resposta do turno não pode ser substituída.',409);return step;}
        assert(step.status==='requested','Turno interrompido.',409);
        const tokens=metadata?.usage?.totalTokenCount;
        assert(tokens==null || (Number.isSafeInteger(tokens) && tokens>=0),'Contagem de tokens inválida.',422);
        await db.query('UPDATE research.agent_sessions SET total_tokens=total_tokens+$2,usage_unknown=usage_unknown OR $3 WHERE id=$1',[id,tokens ?? 0,tokens==null]);
        if(checkpoint)await db.query('UPDATE research.agent_sessions SET context=$2,elapsed_ms=$3 WHERE id=$1',[id,checkpoint,elapsed]);
        return (await db.query("UPDATE research.agent_steps SET status='completed',response=$3,provider_metadata=$4,finished_at=now() WHERE session_id=$1 AND id=$2 RETURNING *",[id,stepId,response,metadata])).rows[0];
      });
    },
    async beginCall(id,stepId,call,argsRef) {
      return transaction(pool,async db=>{
        const session=await locked(db,id);assert(session.status==='running','Sessão encerrada.',409);
        const step=(await db.query('SELECT status FROM research.agent_steps WHERE id=$1 AND session_id=$2',[stepId,id])).rows[0];
        assert(step?.status==='completed','Ferramenta exige resposta de modelo preservada nesta sessão.',409);
        const existing=(await db.query('SELECT * FROM research.agent_tool_calls WHERE step_id=$1 AND call_id=$2',[stepId,call.id])).rows[0];
        if(existing){assert(existing.session_id===id && existing.name===call.name && existing.arguments.sha256===argsRef.sha256,'ID de chamada reutilizado com conteúdo diferente.',409);return existing;}
        const used=(await db.query('SELECT COALESCE(sum(tool_calls),0)::int AS n FROM research.agent_sessions WHERE run_id=$1',[job.run.id])).rows[0].n;
        const previous=job.automationPart ? (await db.query('SELECT COALESCE(sum(tool_calls),0)::int AS n FROM research.agent_sessions WHERE automation_part_id=$1',[job.automationPart.id])).rows[0].n : session.tool_calls;
        assert(previous<session.policy.limits.max_tool_calls && used<session.policy.run_limits.max_tool_calls,'Orçamento de ferramentas esgotado.',422);
        const row=(await db.query(`INSERT INTO research.agent_tool_calls(id,session_id,step_id,call_id,name,tool_version,arguments,status)
          VALUES($1,$2,$3,$4,$5,'1.0.0',$6,'requested') RETURNING *`,[randomUUID(),id,stepId,call.id,call.name,argsRef])).rows[0];
        await db.query('UPDATE research.agent_sessions SET tool_calls=tool_calls+1 WHERE id=$1',[id]);return row;
      });
    },
    async completeCall(id,callId,observation,{rejected=false,duration_ms=0,checkpoint=null,elapsed=0}={}) {
      return transaction(pool,async db=>{
        const session=await locked(db,id);assert(session.status==='running','Sessão encerrada.',409);
        const call=(await db.query('SELECT * FROM research.agent_tool_calls WHERE id=$1 AND session_id=$2 FOR UPDATE',[callId,id])).rows[0];
        assert(call,'Chamada fora da sessão.',409);
        if(call.status!=='requested'){assert(call.observation?.sha256===observation.sha256,'Observação não pode ser substituída.',409);return call;}
        if(checkpoint)await db.query('UPDATE research.agent_sessions SET context=$2,elapsed_ms=$3 WHERE id=$1',[id,checkpoint,elapsed]);
        return (await db.query('UPDATE research.agent_tool_calls SET status=$3,observation=$4,duration_ms=$5,finished_at=now() WHERE id=$1 AND session_id=$2 RETURNING *',[callId,id,rejected?'rejected':'completed',observation,duration_ms])).rows[0];
      });
    },
    async checkpoint(id,context,elapsed) {return transaction(pool,async db=>{const s=await locked(db,id);assert(s.status==='running','Sessão encerrada.',409);await db.query('UPDATE research.agent_sessions SET context=$2,elapsed_ms=$3 WHERE id=$1',[id,context,elapsed]);});},
    async recordLateResponse(id,stepId,response,metadata) {
      return transaction(pool,async db=>{
        await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);
        const session=(await db.query('SELECT id FROM research.agent_sessions WHERE id=$1 AND attempt_id=$2 FOR UPDATE',[id,job.attemptId])).rows[0];
        assert(session,'Sessão fora da tentativa.',409);
        const result=await db.query("UPDATE research.agent_steps SET response=$3,provider_metadata=$4,status='interrupted',finished_at=now() WHERE session_id=$1 AND id=$2 AND response IS NULL RETURNING id",[id,stepId,response,{...metadata,late_response:true}]);
        if(result.rowCount){const n=metadata?.usage?.totalTokenCount;await db.query('UPDATE research.agent_sessions SET usage_unknown=true,total_tokens=total_tokens+$2 WHERE id=$1',[id,Number.isSafeInteger(n)&&n>=0?n:0]);}
      });
    },
    async adoptStep(id,pending) {
      return transaction(pool,async db=>{
        const s=await locked(db,id);assert(s.status==='running','Sessão encerrada.',409);
        const own=(await db.query('SELECT id FROM research.agent_steps WHERE id=$1 AND session_id=$2',[pending.step_id,id])).rows[0];
        if(own)return own.id;
        const existing=(await db.query("SELECT id FROM research.agent_steps WHERE session_id=$1 AND provider_metadata->>'reused_from_step_id'=$2",[id,pending.step_id])).rows[0];
        if(existing)return existing.id;
        const sequence=(await db.query('SELECT COALESCE(max(sequence),0)+1 AS n FROM research.agent_steps WHERE session_id=$1',[id])).rows[0].n;
        const stepId=randomUUID();
        await db.query("INSERT INTO research.agent_steps(id,session_id,sequence,status,request,response,provider_metadata,finished_at) VALUES($1,$2,$3,'completed',$4,$5,$6,now())",[stepId,id,sequence,pending.request_ref,pending.response_ref,{reused_from_step_id:pending.step_id,usage:null,cost:null}]);
        return stepId;
      });
    },
    async lostLease(id) {
      // Only close this attempt's old session if it no longer owns the stage. Never finish its parent stage.
      await pool.query(`UPDATE research.agent_sessions a SET status=CASE WHEN s.status='cancelled' THEN 'cancelled' ELSE 'interrupted' END,
        stop_reason='lease_lost',usage_unknown=usage_unknown OR EXISTS(SELECT 1 FROM research.agent_steps p WHERE p.session_id=a.id AND p.status='requested'),finished_at=now()
        FROM research.stages s WHERE a.id=$1 AND a.attempt_id=$2 AND s.id=a.stage_id AND a.status='running'
        AND (s.status<>'running' OR s.lease_token IS DISTINCT FROM $3 OR s.lease_until<now())`,[id,job.attemptId,job.token]);
    },
    async finish(id,status,reason,output=null,elapsed=0) {
      return transaction(pool,async db=>{
        const session=await locked(db,id);assertSessionTransition(session.status,status);
        if(status==='interrupted' || status==='failed' || status==='cancelled') {
          const interrupted=await db.query("UPDATE research.agent_steps SET status='interrupted',finished_at=now() WHERE session_id=$1 AND status='requested' RETURNING id",[id]);
          if(interrupted.rowCount)await db.query('UPDATE research.agent_sessions SET usage_unknown=true WHERE id=$1',[id]);
        }
        return (await db.query('UPDATE research.agent_sessions SET status=$2,stop_reason=$3,output=$4,elapsed_ms=$5,finished_at=now() WHERE id=$1 RETURNING *',[id,status,reason,output,elapsed])).rows[0];
      });
    },
  };
}
