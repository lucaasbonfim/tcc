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
import {createAutomationAgentTools} from '../../src/research/automation-agent-tools.js';
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
  await assert.rejects(runAgentTask(config(env,{generateTurn:async()=>{throw Object.assign(new Error('sensitive-api-key-must-not-leak'),{name:'ApiError',status:429});}})),/HTTP 429/);
  const session=(await env.pool.query('SELECT * FROM research.agent_sessions WHERE attempt_id=$1',[env.job.attemptId])).rows[0];
  const diagnostic=await env.store.json(session.output);
  assert.equal(diagnostic.http_status,429);assert.equal(diagnostic.phase,'model_turn');assert.equal(session.usage_unknown,true);
  assert.ok(!JSON.stringify(diagnostic).includes('sensitive-api-key'));
}));
