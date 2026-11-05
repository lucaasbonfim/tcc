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
