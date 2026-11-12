import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {createAgentSessionStore} from '../../src/research/agent-sessions.js';
import {createAgentPolicy} from '../../src/research/agent-policy.js';
import {createAutomationAgentTools} from '../../src/research/agents/tests/scripts/tools.js';
import {runAgentTask,taskFingerprint} from '../../src/research/agent-runtime.js';
import {claimedAutomationScenario,agentFixtureOutput,fixtureTurn} from '../../test-support/agent-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action) {
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'agent-runtime-')),store=createArtifactStore(directory);
  try{await migrate(pool);await action({pool,store,...await claimedAutomationScenario(pool,store)});}finally{await pool.end();await rm(directory,{recursive:true,force:true});}
}
function config(env,extra={}) {
  const policy=createAgentPolicy({modes:{automation:'agent/v1'}});
  return {sessions:createAgentSessionStore(env.pool,env.job),store:env.store,policy,
    task:{fingerprint:taskFingerprint(env.input),case_ids:env.input.test_cases.map(t=>t.id)},
    initialContents:[{role:'user',parts:[{text:'Controle técnico, não resultado de pesquisa.'}]}],
    tools:createAutomationAgentTools({...env,store:env.store}),model:'fixture',parameters:{temperature:0.2,maxOutputTokens:8192},...extra};
}
const read={id:'read',name:'read_source',args:{path:'src/calc.js',offset:0,length:1000}};
const prepare={id:'prepare',name:'prepare_automation_scope',args:{target_paths:['src/calc.js']}};
function finishTurn(contents,input) {
  const scope=contents.flatMap(c=>c.parts).find(p=>p.functionResponse?.name==='prepare_automation_scope').functionResponse.response.scope_id;
  return fixtureTurn([{id:'submit',name:'submit_automation',args:{scope_id:scope,output:agentFixtureOutput(input)}}]);
}
test('ciclo real de persistência usa observações, encerra para revisão e respeita orçamento',{skip:!url},async()=>environment(async env=>{
  let count=0;
  const result=await runAgentTask(config(env,{generateTurn:async({contents})=>++count===1?fixtureTurn([read,prepare]):finishTurn(contents,env.input)}));
  assert.equal(result.output.artifacts.length,1);assert.deepEqual(result.input.scope.target_paths,['src/calc.js']);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  assert.equal(session.status,'completed');assert.equal(session.model_turns,2);assert.equal(session.tool_calls,3);
  assert.equal((await env.pool.query('SELECT count(*)::int AS n FROM research.automated_tests WHERE run_id=$1',[env.job.run.id])).rows[0].n,0);
}));
test('interrupção após consulta retoma só a ferramenta pendente sem zerar histórico',{skip:!url},async()=>environment(async env=>{
  const controller=new AbortController(),tools=createAutomationAgentTools({...env,store:env.store});let reads=0;
  const wrapped={...tools,execute:async call=>{if(call.name==='read_source')reads++;if(call.name==='prepare_automation_scope'){controller.abort();return new Promise(()=>{});}return tools.execute(call);}};
  await assert.rejects(runAgentTask(config(env,{tools:wrapped,signal:controller.signal,generateTurn:async()=>fixtureTurn([read,prepare])})),{name:'AbortError'});
  const attemptId=randomUUID(),job={...env.job,attemptId};
  await env.pool.query("INSERT INTO research.attempts(id,stage_id,number,status,automation_part_id) VALUES($1,$2,2,'running',$3)",[attemptId,job.stage.id,job.automationPart.id]);
  const resumedTools=createAutomationAgentTools({...env,store:env.store});
  const result=await runAgentTask(config({...env,job},{tools:{...resumedTools,execute:call=>{if(call.name==='read_source')reads++;return resumedTools.execute(call);}},generateTurn:async({contents})=>finishTurn(contents,env.input)}));
  assert.equal(reads,1);assert.equal(result.output.artifacts.length,1);
  const sessions=(await env.pool.query('SELECT status,model_turns FROM research.agent_sessions WHERE run_id=$1 ORDER BY started_at',[job.run.id])).rows;
  assert.deepEqual(sessions.map(s=>s.status),['interrupted','completed']);assert.equal(sessions.reduce((n,s)=>n+s.model_turns,0),2);
}));
test('orçamento esgotado é falha incompleta, sem impossibilidade inventada',{skip:!url},async()=>environment(async env=>{
  const policy=createAgentPolicy({modes:{automation:'agent/v1'},limits:{max_model_turns:1}});
  await assert.rejects(runAgentTask(config(env,{policy,generateTurn:async()=>fixtureTurn([{id:'caps',name:'get_adapter_capabilities',args:{}}])})),/Orçamento/);
  const session=(await env.pool.query('SELECT status,output FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  assert.equal(session.status,'exhausted');assert.equal(session.output,null);
}));
test('escopo preparado sobrevive a interrupção no turno seguinte e resposta parcial nunca executa ferramentas',{skip:!url},async()=>environment(async env=>{
  const controller=new AbortController();let turns=0;
  await assert.rejects(runAgentTask(config(env,{signal:controller.signal,generateTurn:async()=>{
    if(++turns===1)return fixtureTurn([read,prepare]);controller.abort();return new Promise(()=>{});
  }})),{name:'AbortError'});
  const attemptId=randomUUID(),job={...env.job,attemptId};
  await env.pool.query("INSERT INTO research.attempts(id,stage_id,number,status,automation_part_id) VALUES($1,$2,2,'running',$3)",[attemptId,job.stage.id,job.automationPart.id]);
  const result=await runAgentTask(config({...env,job},{generateTurn:async({contents})=>finishTurn(contents,env.input)}));
  assert.equal(result.output.artifacts.length,1);
}));
test('resposta parcial é preservada sem executar chamadas, mesmo na repetição',{skip:!url},async()=>environment(async env=>{
  let called=0;const partial=fixtureTurn([read]);partial.metadata.finish_reasons=['MAX_TOKENS'];
  await assert.rejects(runAgentTask(config(env,{tools:{restore:async()=>{},execute:async()=>{called++;}},generateTurn:async()=>partial})),/interrompida/);
  assert.equal(called,0);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  assert.equal((await env.store.json(session.context)).pending,null);
}));
test('retorno tardio preserva resposta mas não conclui etapa de outro worker',{skip:!url},async()=>environment(async env=>{
  const newToken=randomUUID();
  await assert.rejects(runAgentTask(config(env,{generateTurn:async()=>{
    await env.pool.query('UPDATE research.stages SET lease_token=$2 WHERE id=$1',[env.job.stage.id,newToken]);return fixtureTurn([read]);
  }})),/Posse/);
  const stage=(await env.pool.query('SELECT status,lease_token FROM research.stages WHERE id=$1',[env.job.stage.id])).rows[0];
  assert.equal(stage.status,'running');assert.equal(stage.lease_token,newToken);
  const steps=(await env.pool.query('SELECT s.status,s.response,s.provider_metadata FROM research.agent_steps s JOIN research.agent_sessions a ON a.id=s.session_id WHERE a.attempt_id=$1',[env.job.attemptId])).rows;
  assert.equal(steps[0].status,'interrupted');assert.ok(steps[0].response);assert.equal(steps[0].provider_metadata.late_response,true);
}));
test('falha do provedor registra status sem vazar mensagem ou credenciais',{skip:!url},async()=>environment(async env=>{
  await assert.rejects(runAgentTask(config(env,{policy:createAgentPolicy({version:'1.0.0',modes:{automation:'agent/v1'}}),generateTurn:async()=>{throw Object.assign(new Error('sensitive-api-key-must-not-leak'),{name:'ApiError',status:429});}})),/HTTP 429/);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  const diagnostic=await env.store.json(session.output);
  assert.equal(diagnostic.http_status,429);assert.equal(diagnostic.phase,'model_turn');assert.equal(session.usage_unknown,true);
  assert.ok(!JSON.stringify(diagnostic).includes('sensitive-api-key'));
}));

const retryPolicy=(extra={})=>createAgentPolicy({modes:{automation:'agent/v1'},model_retry:{initial_delay_ms:1,max_delay_ms:4},...extra});
const unavailable=status=>Object.assign(new Error('private-transport'),{name:'ApiError',status});
test('espera RetryInfo do 429 é registrada e usa o mesmo contexto sem gastar tentativa de etapa',{skip:!url},async()=>environment(async env=>{
  let sends=0;
  const error=Object.assign(new Error(JSON.stringify({error:{message:'private-key',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'0.02s'}]}})),{status:429});
  const before=Date.now();await runAgentTask(config(env,{policy:retryPolicy(),generateTurn:async({contents})=>{if(++sends===1)throw error;return sends===2?fixtureTurn([read,prepare]):finishTurn(contents,env.input);}}));
  assert.equal(sends,3);assert.ok(Date.now()-before>=20);
  const rows=(await env.pool.query("SELECT payload FROM research.run_events WHERE run_id=$1 AND kind='model_retry_scheduled'",[env.job.run.id])).rows;
  assert.equal(rows[0].payload.delay_ms,20);assert.equal(rows[0].payload.delay_reason,'provider_retry_after');assert.ok(!JSON.stringify(rows).includes('private-key'));
}));
test('UUID sem hífens é rejeitado com identidade exata; agente corrige sem normalização silenciosa',{skip:!url},async()=>environment(async env=>{
  let turns=0,rawCompact;
  const tools=createAutomationAgentTools({...env,store:env.store});
  const result=await runAgentTask(config(env,{tools,toolDefinitions:tools.declarations,generateTurn:async({contents})=>{
    if(++turns===1)return fixtureTurn([read,prepare]);
    const response=finishTurn(contents,env.input);
    if(turns===2){const artifact=response.calls[0].args.output.artifacts[0];artifact.test_case_id=artifact.test_case_id.replaceAll('-','');rawCompact=artifact.test_case_id;}
    else{const rejected=contents.flatMap(c=>c.parts).find(p=>p.functionResponse?.response?.error);assert.match(rejected.functionResponse.response.message,/hífens/);assert.ok(rejected.functionResponse.response.message.includes(env.input.test_cases[0].id));}
    return response;
  }}));
  assert.equal(turns,3);assert.equal(result.output.artifacts[0].test_case_id,env.input.test_cases[0].id);
  const calls=(await env.pool.query("SELECT arguments,status FROM research.agent_tool_calls WHERE session_id=(SELECT id FROM research.agent_sessions WHERE attempt_id=$1) AND name='submit_automation' ORDER BY started_at",[env.job.attemptId])).rows;
  assert.deepEqual(calls.map(c=>c.status),['rejected','completed']);assert.equal((await env.store.json(calls[0].arguments)).output.artifacts[0].test_case_id,rawCompact);
}));
test('espera respeita prazo total e encerra como orçamento esgotado',{skip:!url},async()=>environment(async env=>{
  let sends=0;await assert.rejects(runAgentTask(config(env,{policy:retryPolicy({limits:{max_duration_ms:500},model_retry:{initial_delay_ms:1000,max_delay_ms:1000}}),generateTurn:async()=>{sends++;throw unavailable(502);}})),/Orçamento/);
  assert.ok(sends<=1);assert.equal((await env.pool.query('SELECT status FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0].status,'exhausted');
}));
test('503 recupera o mesmo contexto sem repetir ferramentas e conta cada envio real',{skip:!url},async()=>environment(async env=>{
  let sends=0,reads=0;const requests=[],tools=createAutomationAgentTools({...env,store:env.store});
  const result=await runAgentTask(config(env,{policy:retryPolicy(),tools:{...tools,execute:call=>{if(call.name==='read_source')reads++;return tools.execute(call);}},generateTurn:async({contents})=>{
    sends++;if(sends===1)return fixtureTurn([read,prepare]);requests.push(JSON.stringify(contents));if(sends===2)throw unavailable(503);return finishTurn(contents,env.input);
  }}));
  assert.equal(result.output.artifacts.length,1);assert.equal(sends,3);assert.equal(reads,1);assert.equal(requests[0],requests[1]);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  assert.equal(session.model_turns,3);assert.equal(session.usage_unknown,true);assert.equal(session.status,'completed');
  const steps=(await env.pool.query('SELECT * FROM research.agent_steps WHERE session_id=$1 ORDER BY sequence',[session.id])).rows;
  assert.deepEqual(steps.map(s=>s.status),['completed','interrupted','completed']);assert.equal(steps[1].provider_metadata.http_status,503);assert.equal(steps[1].request.sha256,steps[2].request.sha256);
  const events=(await env.pool.query("SELECT kind,payload FROM research.run_events WHERE run_id=$1 AND kind LIKE 'model_%' ORDER BY sequence",[env.job.run.id])).rows;
  assert.equal(events.filter(e=>e.kind==='model_retry_scheduled').length,1);assert.equal(events.filter(e=>e.payload.retry_of).length,1);assert.ok(!JSON.stringify(events).includes('private-transport'));
}));
test('retentativas são limitadas e falhas permanentes não repetem',{skip:!url},async()=>environment(async env=>{
  let sends=0;await assert.rejects(runAgentTask(config(env,{policy:retryPolicy(),generateTurn:async()=>{sends++;throw unavailable(503);}})),/HTTP 503/);assert.equal(sends,4);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];assert.equal(session.status,'failed');assert.equal(session.model_turns,4);assert.equal(session.usage_unknown,true);
}));
test('400 não repete e 429 respeita orçamento de chamadas',{skip:!url},async()=>environment(async env=>{
  let sends=0;await assert.rejects(runAgentTask(config(env,{policy:retryPolicy(),generateTurn:async()=>{sends++;throw unavailable(400);}})),/HTTP 400/);assert.equal(sends,1);
}));
test('retentativa não ultrapassa orçamento cumulativo',{skip:!url},async()=>environment(async env=>{
  let sends=0;await assert.rejects(runAgentTask(config(env,{policy:retryPolicy({limits:{max_model_turns:2}}),generateTurn:async()=>{sends++;throw unavailable(429);}})),/Orçamento/);assert.equal(sends,2);
}));
test('cancelamento durante espera não envia outra chamada e preserva checkpoint',{skip:!url},async()=>environment(async env=>{
  const controller=new AbortController(),sessions=createAgentSessionStore(env.pool,env.job);let sends=0;
  const wrapped={...sessions,failStep:async(...args)=>{await sessions.failStep(...args);controller.abort();}};
  await assert.rejects(runAgentTask(config(env,{sessions:wrapped,policy:retryPolicy(),signal:controller.signal,generateTurn:async()=>{sends++;throw unavailable(504);}})),{name:'AbortError'});
  assert.equal(sends,1);const session=(await sessions.find());assert.equal(session.status,'interrupted');assert.equal((await env.store.json(session.context)).model_retry.retry_number,1);
  const attemptId=randomUUID(),job={...env.job,attemptId};
  await env.pool.query("INSERT INTO research.attempts(id,stage_id,number,status,automation_part_id) VALUES($1,$2,2,'running',$3)",[attemptId,job.stage.id,job.automationPart.id]);
  let resumed=0;await runAgentTask(config({...env,job},{policy:retryPolicy(),generateTurn:async({contents})=>++resumed===1?fixtureTurn([read,prepare]):finishTurn(contents,env.input)}));
  assert.equal(resumed,2);assert.equal((await env.pool.query('SELECT sum(model_turns)::int AS n FROM research.agent_sessions WHERE run_id=$1',[job.run.id])).rows[0].n,3);
}));
