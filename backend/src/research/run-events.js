import {randomUUID} from 'node:crypto';
export async function appendRunEvent(db,{run_id,source_key,kind,actor='system',agent=null,recipient=null,stage_id=null,attempt_id=null,session_id=null,message_id=null,job_id=null,snapshot_id=null,correlation_id=null,payload={},occurred_at=null}) {
  return (await db.query(`INSERT INTO research.run_events(id,run_id,source_key,kind,actor,agent,recipient,stage_id,attempt_id,session_id,message_id,job_id,snapshot_id,correlation_id,payload,occurred_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16::timestamptz,now())) ON CONFLICT(run_id,source_key) DO NOTHING RETURNING *`,[randomUUID(),run_id,source_key,kind,actor,agent,recipient,stage_id,attempt_id,session_id,message_id,job_id,snapshot_id,correlation_id,payload,occurred_at])).rows[0];
}
export async function preserveSnapshot(db,{run_id,source_key,stage_id=null,attempt_id=null,kind,label,artifact,entity_type=null,entity_id=null,revision=null}) {
  const existing=(await db.query('SELECT * FROM research.artifact_snapshots WHERE run_id=$1 AND source_key=$2',[run_id,source_key])).rows[0];if(existing)return existing;
  return (await db.query(`INSERT INTO research.artifact_snapshots(id,run_id,source_key,stage_id,attempt_id,kind,label,artifact,entity_type,entity_id,revision)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[randomUUID(),run_id,source_key,stage_id,attempt_id,kind,label,artifact,entity_type,entity_id,revision])).rows[0];
}
export async function recordMessageEvent(db,message,side,data) {
  const response=side==='response',unavailable=response && data.status==='unavailable';
  const ref=response?message.response:message.request;
  const child=response?(await db.query('SELECT id,attempt_id FROM research.agent_sessions WHERE run_id=$1 AND message_id=$2 ORDER BY started_at DESC LIMIT 1',[message.run_id,message.id])).rows[0]:null;
  const snapshot=await preserveSnapshot(db,{run_id:message.run_id,source_key:`message:${message.id}:${side}`,stage_id:message.stage_id,attempt_id:child?.attempt_id || message.source_attempt_id,kind:response?'output':'input',label:response?'Resposta preservada da consulta':'Pedido preservado entre agentes',artifact:ref});
  return appendRunEvent(db,{run_id:message.run_id,source_key:`message:${message.id}:${side}`,kind:unavailable?'message_unavailable':response?'message_response':'message_request',actor:unavailable?'system':'agent',agent:response?message.recipient:message.sender,recipient:response?message.sender:message.recipient,stage_id:message.stage_id,attempt_id:child?.attempt_id || message.source_attempt_id,session_id:child?.id || message.source_session_id,message_id:message.id,correlation_id:message.id,snapshot_id:snapshot.id,payload:{message_kind:message.kind,text:(response?data.answer:data.question)?.slice(0,600),status:response?data.status:'pending',script_version:message.script_version,proposed_version:data.proposed_version,requirement_revision:message.requirement_revision}});
}
export async function recordHumanEvent(db,store,{run_id,stage_id=null,source_key,entity_type,entity_id=null,decision,justification,before=null,after=null}) {
  const artifact=await store.put({entity_type,entity_id,decision,justification,before,after});
  const snapshot=await preserveSnapshot(db,{run_id,stage_id,source_key,kind:'artifact',label:'Decisão humana e versões preservadas',artifact,entity_type,entity_id,revision:after?.revision ?? null});
  return appendRunEvent(db,{run_id,source_key,kind:'human_review',actor:'human',stage_id,snapshot_id:snapshot.id,payload:{entity_type,entity_id,decision,justification:justification?.slice(0,500)}});
}
