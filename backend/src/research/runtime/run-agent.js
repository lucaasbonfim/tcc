import {createHash} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {assert} from '../errors.js';
import {providerRetryAfterMs,MAX_PROVIDER_WAIT_MS} from './provider-retry.js';

export const taskFingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function abortable(action,signal) {
  signal.throwIfAborted();const operation=action();let listener;
  try{return await Promise.race([operation,new Promise((_,reject)=>{
    listener=()=>reject(signal.reason ?? new DOMException('Cancelado.','AbortError'));
    signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener();
  })]);}finally{if(listener)signal.removeEventListener('abort',listener);}
}

export async function runAgentTask({sessions,store,generateTurn,tools,task,policy,initialContents,model,parameters,signal,instruction,instruction_version,toolDefinitions,terminalTool}) {
  assert(typeof instruction==='string' && typeof instruction_version==='string' && Array.isArray(toolDefinitions) && toolDefinitions.length>0 && typeof terminalTool==='string','Perfil de agente explícito obrigatório.',422);
  const started=Date.now(),controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason);
  let session=await sessions.find(),checkpoint;
  if(session?.status==='completed'){signal?.removeEventListener('abort',abort);return store.json(session.output);}
  if(session) {assert(session.status==='running','Sessão encerrada; solicite nova tentativa.',409);checkpoint=await store.json(session.context);}
  else {
    const previous=await sessions.previous();
    checkpoint=previous?.task.fingerprint===task.fingerprint ? await store.json(previous.context) : {contents:initialContents,pending:null,elapsed_ms:0,repetitions:{}};
    if(previous?.task.fingerprint===task.fingerprint)checkpoint.elapsed_ms=(checkpoint.elapsed_ms || 0)+Math.max(0,(previous.elapsed_ms || 0)-(checkpoint.attempt_elapsed_ms || 0));
    checkpoint.attempt_elapsed_ms=0;
    session=await sessions.create({task,policy,context:await store.put(checkpoint)});
  }
  const inherited=checkpoint.elapsed_ms || 0,elapsed=()=>inherited+Date.now()-started;
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const remaining=()=>Math.max(0,policy.limits.max_duration_ms-elapsed());
  const timer=setTimeout(()=>controller.abort(new DOMException('Orçamento de tempo esgotado.','TimeoutError')),Math.max(1,remaining()));
  let checking=false;
  const heartbeat=setInterval(async()=>{
    if(checking)return;checking=true;
    try{if(!await sessions.heartbeat())controller.abort(new DOMException('Posse da tarefa perdida.','AbortError'));}
    catch{controller.abort(new DOMException('Falha ao verificar posse da tarefa.','AbortError'));}
    finally{checking=false;}
  },20000);
  const activeElapsed=()=>Date.now()-started;
  const save=async()=>{checkpoint.elapsed_ms=elapsed();checkpoint.attempt_elapsed_ms=activeElapsed();return store.put(checkpoint);};
  let phase='checkpoint';
  try {
    for(const state of checkpoint.tool_states || [])await tools.restore(state);
    while(true) {
      controller.signal.throwIfAborted();assert(remaining()>0,'Orçamento de tempo esgotado.',422);
      if(checkpoint.pending) {
        const pending=checkpoint.pending;pending.step_id=await sessions.adoptStep(session.id,pending);
        await sessions.checkpoint(session.id,await save(),activeElapsed());
        for(const done of pending.done) {
          const observation=await store.json(done.observation_ref);
          if(!done.rejected)await tools.restoreCompletedCall?.(done,observation);
          if(done.terminal_ref) {
            await sessions.finish(session.id,'completed','submitted',done.terminal_ref,activeElapsed());
            return store.json(done.terminal_ref);
          }
        }
        for(const call of pending.calls) {
          controller.signal.throwIfAborted();
          if(pending.done.some(done=>done.id===call.id))continue;
          const before=Date.now(),argsRef=await store.put(call.args ?? null);
          const record=await sessions.beginCall(session.id,pending.step_id,call,argsRef);
          let result,rejected=false,fatal=false;
          try {
            assert(call.name!==terminalTool || pending.calls.length===1,'Submissão terminal exige turno separado.',422);
            controller.signal.throwIfAborted();
            result=await abortable(()=>tools.execute(call,{signal:controller.signal}),controller.signal);
          }catch(error) {
            if(controller.signal.aborted)throw error;
            rejected=true;fatal=error.statusCode===403;
            result={observation:{error:true,message:[403,409,422].includes(error.statusCode)?error.message.slice(0,1000):'Falha interna da ferramenta.'}};
          }
          const observationRef=await store.put(result.observation),terminalRef=result.terminal ? await store.put(result.terminal) : null;
          if(result.state){checkpoint.tool_states ??=[];checkpoint.tool_states.push(result.state);}
          const signature=taskFingerprint({name:call.name,args:call.args,observation:result.observation});
          checkpoint.repetitions[signature]=(checkpoint.repetitions[signature] || 0)+1;
          pending.done.push({id:call.id,name:call.name,observation_ref:observationRef,rejected,...(terminalRef?{terminal_ref:terminalRef}:{})});
          await sessions.completeCall(session.id,record.id,observationRef,{rejected,duration_ms:Date.now()-before,checkpoint:await save(),elapsed:activeElapsed()});
          assert(!fatal,'Ferramenta recusada por violação de escopo.',403);
          assert(checkpoint.repetitions[signature]<3,'Agente repetiu ação sem progresso.',422);
          if(terminalRef) {
            await sessions.finish(session.id,'completed','submitted',terminalRef,activeElapsed());return store.json(terminalRef);
          }
        }
        checkpoint.contents.push(pending.content,{role:'user',parts:pending.done.map(done=>({functionResponse:{id:done.id,name:done.name,response:null}}))});
        const parts=checkpoint.contents.at(-1).parts;
        for(let i=0;i<parts.length;i++)parts[i].functionResponse.response=await store.json(pending.done[i].observation_ref);
        checkpoint.pending=null;await sessions.checkpoint(session.id,await save(),activeElapsed());
      }
      const request={model,parameters,instruction,instruction_version,contents:checkpoint.contents,tools:toolDefinitions};
      assert(JSON.stringify(request).length<=policy.limits.max_context_chars,'Contexto do agente excede o limite.',422);
      const requestRef=await store.put(request);
      const retry=checkpoint.model_retry;
      if(retry){
        assert(retry.request_sha256===requestRef.sha256,'Contexto da retentativa mudou.',409);
        assert(retry.retry_number<(policy.model_retry?.max_attempts ?? 1),'Retentativas do modelo esgotadas.',422);
        phase='model_retry_wait';
        const delay=Math.max(0,retry.not_before-Date.now());
        if(delay)try{await wait(delay,undefined,{signal:controller.signal});}catch(error){throw controller.signal.aborted?controller.signal.reason:error;}
      }
      controller.signal.throwIfAborted();assert(remaining()>0,'Orçamento de tempo esgotado.',422);
      const step=await sessions.beginStep(session.id,requestRef,retry?.step_id ?? null);
      controller.signal.throwIfAborted();
      phase='model_turn';
      let response;
      try{response=await abortable(()=>generateTurn({...request,signal:controller.signal,timeout_ms:Math.min(90000,remaining()),max_context_chars:policy.limits.max_context_chars}),controller.signal);}
      catch(error){
        if(controller.signal.aborted)throw error;
        const status=Number(error.status ?? error.statusCode),http_status=Number.isInteger(status)&&status>=400&&status<=599?status:null;
        const retry_number=(retry?.retry_number ?? 0)+1,retryPolicy=policy.model_retry;
        const serverDelay=retryPolicy?.respect_retry_after?providerRetryAfterMs(error):null;
        const clientDelay=retryPolicy?Math.min(retryPolicy.max_delay_ms,retryPolicy.initial_delay_ms*2**(retry_number-1)):0;
        const delay=Math.max(clientDelay,serverDelay ?? 0);
        const canRetry=[429,502,503,504].includes(http_status) && retry_number<(retryPolicy?.max_attempts ?? 1) && (serverDelay===null||(serverDelay<=MAX_PROVIDER_WAIT_MS && delay<remaining()));
        if(canRetry)checkpoint.model_retry={request_sha256:requestRef.sha256,step_id:step.id,retry_number,not_before:Date.now()+delay};
        else delete checkpoint.model_retry;
        await sessions.failStep(session.id,step.id,{http_status,usage_unknown:true,...(serverDelay!==null?{provider_retry_after_ms:serverDelay}:{})},canRetry?{retry_number,delay_ms:delay,delay_reason:serverDelay!==null&&serverDelay>=clientDelay?'provider_retry_after':'exponential_backoff',not_before:checkpoint.model_retry.not_before}:null,await save(),activeElapsed());
        if(!canRetry)throw error;
        continue;
      }
      phase='checkpoint';
      delete checkpoint.model_retry;
      const responseRef=await store.put(response);
      const complete=Array.isArray(response.calls) && response.calls.length>0 && new Set(response.calls.map(call=>call.id)).size===response.calls.length && !response.metadata?.finish_reasons?.includes('MAX_TOKENS');
      checkpoint.pending=complete ? {step_id:step.id,request_ref:requestRef,response_ref:responseRef,content:response.content,calls:response.calls,done:[]} : null;
      try{await sessions.completeStep(session.id,step.id,responseRef,response.metadata,await save(),activeElapsed());}
      catch(error){await sessions.recordLateResponse(session.id,step.id,responseRef,response.metadata).catch(()=>{});throw error;}
      assert(!response.metadata?.finish_reasons?.includes('MAX_TOKENS'),'Resposta interrompida pelo limite de saída.',422);
      assert(Array.isArray(response.calls) && response.calls.length>0,'Modelo não solicitou ferramenta nem submeteu resultado.',422);
      assert(new Set(response.calls.map(call=>call.id)).size===response.calls.length,'IDs duplicados nas chamadas do modelo.',422);
    }
  }catch(error) {
    const exhausted=/Orçamento/.test(error.message || '') || error.name==='TimeoutError';
    const reason=exhausted?'budget_exhausted':controller.signal.aborted?'interrupted':error.statusCode===403?'scope_violation':'processing_error';
    let diagnostic=null;
    const status=Number(error.status ?? error.statusCode),httpStatus=Number.isInteger(status)&&status>=400&&status<=599?status:null;
    if(reason==='processing_error')diagnostic=await store.put({kind:'agent_diagnostic',phase,
      error_name:/^[A-Za-z]{1,50}$/.test(error.name || '')?error.name:'Error',http_status:httpStatus,
      error_code:['ECONNRESET','ETIMEDOUT','ENOTFOUND','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UND_ERR_CONNECT_TIMEOUT'].includes(error.code)?error.code:null,
      message:'Falha do turno ou processamento; detalhes de transporte e credenciais não são armazenados.'}).catch(()=>null);
    try{await sessions.finish(session.id,exhausted?'exhausted':controller.signal.aborted?'interrupted':'failed',reason,diagnostic,activeElapsed());}
    catch{await sessions.lostLease(session.id).catch(()=>{});}
    if(phase==='model_turn' && reason==='processing_error') {
      const safe=new Error(`Falha no turno do modelo${httpStatus?` (HTTP ${httpStatus})`:''}. Consulte o diagnóstico da sessão; a tentativa e o consumo foram preservados.`);safe.statusCode=422;throw safe;
    }
    throw error;
  }finally{clearTimeout(timer);clearInterval(heartbeat);signal?.removeEventListener('abort',abort);}
}
