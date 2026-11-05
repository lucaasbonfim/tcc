import {assert} from './errors.js';

function page(input={}) {
  const offset=Number(input.offset ?? 0),limit=Number(input.limit ?? 25);
  assert(Number.isSafeInteger(offset) && offset>=0 && Number.isSafeInteger(limit) && limit>=1 && limit<=100,'Paginação inválida.',422);
  return {offset,limit};
}
export function createAgentHistoryService({pool,store}) {
  async function runExists(runId) {assert((await pool.query('SELECT id FROM research.runs WHERE id=$1',[runId])).rowCount,'Análise não encontrada.',404);}
  async function session(runId,id) {const row=(await pool.query('SELECT * FROM research.agent_sessions WHERE run_id=$1 AND id=$2',[runId,id])).rows[0];assert(row,'Sessão não encontrada nesta análise.',404);return row;}
  const service={
    async summary(runId) {
      const row=(await pool.query(`SELECT count(*)::int AS sessions,COALESCE(sum(model_turns),0)::int AS model_turns,
        COALESCE(sum(tool_calls),0)::int AS tool_calls,COALESCE(sum(total_tokens),0)::bigint AS total_tokens_reported,
        COALESCE(bool_or(usage_unknown),false) AS usage_unknown,COALESCE(sum(elapsed_ms) FILTER(WHERE parent_session_id IS NULL),0)::bigint AS elapsed_ms,
        COALESCE(sum(elapsed_ms) FILTER(WHERE parent_session_id IS NOT NULL),0)::bigint AS child_elapsed_ms
        FROM research.agent_sessions WHERE run_id=$1`,[runId])).rows[0];
      return {...row,total_tokens_reported:Number(row.total_tokens_reported),elapsed_ms:Number(row.elapsed_ms),child_elapsed_ms:Number(row.child_elapsed_ms)};
    },
    async list(runId,query={}) {
      await runExists(runId);const {offset,limit}=page(query);
      const rows=(await pool.query('SELECT * FROM research.agent_sessions WHERE run_id=$1 ORDER BY started_at,id LIMIT $2 OFFSET $3',[runId,limit+1,offset])).rows;
      return {sessions:rows.slice(0,limit),offset,next_offset:rows.length>limit?offset+limit:null,summary:await service.summary(runId)};
    },
    async detail(runId,id,query={}) {
      const row=await session(runId,id),{offset,limit}=page(query);
      const steps=(await pool.query('SELECT * FROM research.agent_steps WHERE session_id=$1 ORDER BY sequence LIMIT $2 OFFSET $3',[id,limit+1,offset])).rows;
      const selected=steps.slice(0,limit);
      const calls=(await pool.query('SELECT * FROM research.agent_tool_calls WHERE session_id=$1 AND step_id=ANY($2::uuid[]) ORDER BY started_at,id',[id,selected.map(s=>s.id)])).rows;
      return {session:row,steps:selected,calls,offset,next_offset:steps.length>limit?offset+limit:null};
    },
    async artifact(runId,sessionId,kind,id,type) {
      await session(runId,sessionId);
      assert((kind==='step' && ['request','response'].includes(type)) || (kind==='call' && ['arguments','observation'].includes(type)),'Tipo de artefato inválido.',422);
      const table=kind==='step'?'agent_steps':'agent_tool_calls';
      const row=(await pool.query(`SELECT ${type} AS ref FROM research.${table} WHERE session_id=$1 AND id=$2`,[sessionId,id])).rows[0];
      assert(row?.ref,'Artefato não encontrado nesta sessão.',404);return store.json(row.ref);
    },
    async export(runId) {
      const result={agent_sessions:[],agent_steps:[],agent_tool_calls:[]};let offset=0;
      do {
        const batch=await service.list(runId,{offset,limit:100});
        for(const session of batch.sessions) {
          const item={...session,context_data:await store.json(session.context),output_data:session.output?await store.json(session.output):null};
          for(const state of item.context_data.tool_states || [])if(state.scope_ref)state.scope_data=await store.json(state.scope_ref);
          result.agent_sessions.push(item);let stepOffset=0;
          do {
            const data=await service.detail(runId,session.id,{offset:stepOffset,limit:100});
            for(const step of data.steps)result.agent_steps.push({...step,request_data:await store.json(step.request),response_data:step.response?await store.json(step.response):null});
            for(const call of data.calls)result.agent_tool_calls.push({...call,arguments_data:await store.json(call.arguments),observation_data:call.observation?await store.json(call.observation):null});
            stepOffset=data.next_offset;
          }while(stepOffset!==null);
        }
        offset=batch.next_offset;
      }while(offset!==null);
      return result;
    },
  };return service;
}
