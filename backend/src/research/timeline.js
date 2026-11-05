import {createHash} from 'node:crypto';
import {assert} from './errors.js';
const legacyId=key=>{const s=createHash('sha256').update(key).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;};
function cursor(value='0'){const s=String(value);assert(/^\d{1,19}$/.test(s)&&BigInt(s)<=9223372036854775807n,'Cursor de histórico inválido.',422);return s;}
export function createTimelineService({pool,store}) {
  async function run(id){const row=(await pool.query('SELECT * FROM research.runs WHERE id=$1',[id])).rows[0];assert(row,'Análise não encontrada.',404);return row;}
  async function durable(id){return (await pool.query("SELECT payload->>'timeline_version' AS version FROM research.run_events WHERE run_id=$1 AND source_key='run:created'",[id])).rows[0]?.version==='1';}
  async function legacy(runId) {
    const result=[],add=(key,kind,occurred_at,extra={})=>{if(occurred_at)result.push({id:legacyId(key),run_id:runId,kind,occurred_at,actor:'system',legacy:true,payload:{},...extra});};
    const [attempts,messages,calls,reviews,evidence,assessments]=await Promise.all([
      pool.query('SELECT a.*,s.agent FROM research.attempts a JOIN research.stages s ON s.id=a.stage_id WHERE s.run_id=$1',[runId]),pool.query('SELECT * FROM research.agent_messages WHERE run_id=$1',[runId]),
      pool.query('SELECT c.*,s.agent,s.stage_id,s.attempt_id FROM research.agent_tool_calls c JOIN research.agent_sessions s ON s.id=c.session_id WHERE s.run_id=$1',[runId]),pool.query('SELECT * FROM research.reviews WHERE run_id=$1',[runId]),pool.query('SELECT * FROM research.evidence WHERE run_id=$1',[runId]),pool.query('SELECT * FROM research.experiment_assessments WHERE run_id=$1',[runId])]);
    for(const a of attempts.rows){add(`attempt:${a.id}:input`,'input_prepared',a.started_at,{agent:a.agent,stage_id:a.stage_id,attempt_id:a.id,payload:{number:a.number},_ref:a.input});if(a.finished_at)add(`attempt:${a.id}:output`,a.status==='failed'?'attempt_failed':'artifact_produced',a.finished_at,{agent:a.agent,stage_id:a.stage_id,attempt_id:a.id,payload:{number:a.number,error:a.error},_ref:a.output});}
    for(const m of messages.rows){add(`message:${m.id}:request`,'message_request',m.created_at,{actor:'agent',agent:m.sender,recipient:m.recipient,message_id:m.id,correlation_id:m.id,_ref:m.request});if(m.answered_at){let unavailable=false,unknown=false;try{unavailable=(await store.json(m.response)).status==='unavailable';}catch{unknown=true;}add(`message:${m.id}:response`,unavailable?'message_unavailable':unknown?'message_record':'message_response',m.answered_at,{actor:unavailable||unknown?'system':'agent',agent:m.recipient,recipient:m.sender,message_id:m.id,correlation_id:m.id,_ref:m.response});}}
    for(const c of calls.rows){add(`call:${c.id}:requested`,'tool_requested',c.started_at,{actor:'agent',agent:c.agent,session_id:c.session_id,attempt_id:c.attempt_id,payload:{name:c.name},_ref:c.arguments});if(c.finished_at)add(`call:${c.id}:observed`,c.status==='rejected'?'tool_rejected':'tool_observed',c.finished_at,{actor:'agent',agent:c.agent,session_id:c.session_id,attempt_id:c.attempt_id,payload:{name:c.name},_ref:c.observation});}
    for(const r of reviews.rows)add(`review:${r.id}`,'human_review',r.created_at,{actor:r.actor==='admin'?'human':'system',payload:{decision:r.decision,entity_type:r.entity_type,justification:r.justification},_data:{before:r.before_value,after:r.after_value}});
    for(const e of evidence.rows)add(`evidence:${e.id}`,'artifact_produced',e.created_at,{actor:'executor',agent:'execution',job_id:e.job_id,_ref:e.artifact});
    for(const a of assessments.rows)add(`assessment:${a.id}`,'human_assessment',a.created_at,{actor:'human',payload:{verdict:a.verdict,target_snapshot_id:a.snapshot_id},_ref:a.artifact});
    result.sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at)||a.id.localeCompare(b.id));return result.map((e,i)=>({...e,sequence:String(i+1)}));
  }
  async function summary(runId) {
    const messages=(await pool.query('SELECT sender,recipient,status,response FROM research.agent_messages WHERE run_id=$1',[runId])).rows,byPair=new Map();let cycles=0,unavailable=0,unknown=0;
    for(const m of messages){const key=`${m.sender}:${m.recipient}`,pair=byPair.get(key)||{sender:m.sender,recipient:m.recipient,requests:0,responses:0,cycles:0};pair.requests++;
      if(m.status==='answered'){pair.responses++;try{if((await store.json(m.response)).status==='unavailable')unavailable++;else{cycles++;pair.cycles++;}}catch{unknown++;}}
      byPair.set(key,pair);}
    const attempts=(await pool.query('SELECT a.stage_id,a.requirement_part_id,a.test_part_id,a.automation_part_id,a.execution_job_id,s.execution_phase FROM research.attempts a JOIN research.stages t ON t.id=a.stage_id LEFT JOIN research.agent_sessions s ON s.attempt_id=a.id AND s.message_id IS NULL WHERE t.run_id=$1',[runId])).rows,units=new Map();
    for(const a of attempts){const key=`${a.stage_id}:${a.requirement_part_id||a.test_part_id||a.automation_part_id||a.execution_job_id||a.execution_phase||'whole'}`;units.set(key,(units.get(key)||0)+1);}
    return {requests:messages.length,responses:messages.filter(m=>m.status==='answered').length,completed_cycles:cycles,pending_requests:messages.filter(m=>m.status!=='answered').length,unavailable_responses:unavailable,unknown_responses:unknown,by_pair:[...byPair.values()],technical_retries:[...units.values()].reduce((n,count)=>n+Math.max(0,count-1),0)};
  }
  const service={
    async list(runId,query={}) {
      const current=await run(runId),after=cursor(query.after),limit=Number(query.limit??100);assert(Number.isSafeInteger(limit)&&limit>0&&limit<=200,'Limite de eventos inválido.',422);
      const recorded=await durable(runId),rows=recorded?(await pool.query('SELECT * FROM research.run_events WHERE run_id=$1 AND sequence>$2::bigint ORDER BY sequence LIMIT $3',[runId,after,limit+1])).rows:(await legacy(runId)).filter(e=>BigInt(e.sequence)>BigInt(after)).slice(0,limit+1);
      return {events:rows.slice(0,limit).map(({_ref,_data,...e})=>e),cursor:rows.length?rows.slice(0,limit).at(-1).sequence:after,has_more:rows.length>limit,status:current.status,workflow_mode:current.workflow_mode,history_mode:recorded?'recorded':'legacy',summary:await summary(runId)};
    },
    async detail(runId,eventId) {
      await run(runId);const recorded=await durable(runId),event=recorded?(await pool.query('SELECT * FROM research.run_events WHERE run_id=$1 AND id=$2',[runId,eventId])).rows[0]:(await legacy(runId)).find(e=>e.id===eventId);assert(event,'Evento não encontrado nesta análise.',404);
      let snapshot=null,data=event._data || event.payload;
      if(event.snapshot_id){snapshot=(await pool.query('SELECT * FROM research.artifact_snapshots WHERE run_id=$1 AND id=$2',[runId,event.snapshot_id])).rows[0];assert(snapshot,'Snapshot não encontrado.',404);data=await store.json(snapshot.artifact);}
      else if(event._ref)data=await store.json(event._ref);
      else if(event.kind==='model_turn_requested'){const request=await store.json(event.payload.request);data={model:request.model,instruction_version:request.instruction_version,parameters:request.parameters,tools:(request.tools||[]).map(t=>t.name)};}
      else if(['model_turn_completed','model_response_late'].includes(event.kind)){const response=await store.json(event.payload.response);data={calls:response.calls,metadata:response.metadata};}
      else for(const key of ['arguments','observation','manifest','snapshot'])if(event.payload[key]?.key){data=await store.json(event.payload[key]);break;}
      const {_ref,_data,...visible}=event;return {event:visible,snapshot,data,history_mode:recorded?'recorded':'legacy'};
    },
    async export(runId) {
      const page=await service.list(runId),events=page.history_mode==='recorded'?(await pool.query('SELECT * FROM research.run_events WHERE run_id=$1 ORDER BY sequence',[runId])).rows:await legacy(runId);
      const snapshots=(await pool.query('SELECT * FROM research.artifact_snapshots WHERE run_id=$1 ORDER BY created_at,id',[runId])).rows;
      for(const snapshot of snapshots)snapshot.data=await store.json(snapshot.artifact);
      const records=[];for(const event of events)records.push({...event,detail:(await service.detail(runId,event.id)).data});
      return {run_events:records,artifact_snapshots:snapshots,timeline_summary:page.summary,history_mode:page.history_mode};
    },
    async stream(req,res,runId) {
      await run(runId);let after=cursor(req.get('Last-Event-ID')||req.query.after||'0');
      res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
      let stopped=false,timer=null;req.on('close',()=>{stopped=true;clearTimeout(timer);});
      const send=(name,data,id)=>res.write(`${id?`id: ${id}\n`:''}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      async function poll(){if(stopped)return;try{const page=await service.list(runId,{after,limit:100});for(const event of page.events){if(stopped)return;send('run_event',event,event.sequence);after=event.sequence;}send('state',{status:page.status,workflow_mode:page.workflow_mode,history_mode:page.history_mode,summary:page.summary,cursor:after});
        if(page.has_more){timer=setTimeout(poll,0);return;}if(page.history_mode==='legacy'||['completed','failed','cancelled'].includes(page.status)){send('settled',{status:page.status,cursor:after});stopped=true;res.end();return;}res.write(': heartbeat\n\n');timer=setTimeout(poll,1500);
      }catch{if(!stopped){send('stream_error',{message:'Conexão interrompida; reconecte pelo último evento.'});stopped=true;res.end();}}}
      await poll();
    },
  };return service;
}
