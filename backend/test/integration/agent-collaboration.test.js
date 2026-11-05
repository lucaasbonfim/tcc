import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {collaborationFixtureTurn} from '../../test-support/collaboration-fixture.js';
import {exportCsv} from '../../src/research/export.js';
import {testCasesFixtureTurn} from '../../test-support/tests-agent-fixture.js';
import {fixtureTurn} from '../../test-support/agent-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'agent-messages-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(services) {
  const project=await services.projects.create({name:'Colaboração técnica',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
  const run=await services.runs.create(project.id,{agent_policy:{modes:{tests:'agent/v1'}}});await services.processor.processOne();let detail=await services.runs.detail(run.id);
  await services.runs.approveStage(run.id,'requirements',{approve_pending:true,items:detail.requirements.map(({id,revision})=>({id,revision})),justification:'Requisitos de controle.'});
  detail=await services.runs.detail(run.id);return {project,run,requirement:detail.requirements[0]};
}
test('A2 consulta A1 em sessão filha, preserva fontes/versões e exige revisão das mensagens',{skip:!url},async()=>environment(async({pool,store})=>{
  const services=scenarioServices(pool,store,{generateTurn:collaborationFixtureTurn}),{run,requirement}=await prepare(services);await services.processor.processOne();
  let detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.agent_messages.length,1);
  const message=detail.agent_messages[0];assert.equal(message.sender,'tests');assert.equal(message.recipient,'requirements');assert.equal(message.status,'answered');assert.equal(message.requirement_revision,requirement.revision);
  assert.equal(message.response_data.status,'ambiguous');assert.equal(message.response_data.sources[0].document_id,'complementary-text');assert.ok(detail.agent_outputs.tests.warnings[0].includes('Não inventar esperado'));
  assert.deepEqual(detail.requirements[0],requirement);
  await assert.rejects(services.runs.approveStage(run.id,'tests',{justification:'Sem revisar consulta.'}),/mensagens/);
  const sessions=(await services.runs.agentSessions(run.id)).sessions,child=sessions.find(s=>s.parent_session_id),parent=sessions.find(s=>!s.parent_session_id);
  assert.equal(child.agent,'requirements');assert.equal(child.message_id,message.id);assert.equal(child.parent_session_id,parent.id);assert.equal(child.test_part_id,null);assert.equal(child.model_turns,2);
  assert.equal(detail.agent_summary.model_turns,6);assert.equal(detail.agent_summary.elapsed_ms,parent.elapsed_ms);assert.equal(detail.agent_summary.child_elapsed_ms,child.elapsed_ms);
  await services.runs.reviewMessage(run.id,message.id,{decision:'acknowledged',justification:'Fonte e limitação conferidas na fixture.'});
  await assert.rejects(services.runs.reviewMessage(run.id,message.id,{decision:'rejected',justification:'Reescrever revisão.'}),/aberta/);
  detail=await services.runs.detail(run.id);await services.runs.approveStage(run.id,'tests',{approve_pending:true,items:detail.test_cases.map(({id,revision})=>({id,revision})),justification:'Casos conferidos, consulta revisada.'});
  const exported=await services.runs.export(run.id);assert.equal(exported.agent_messages[0].review_status,'acknowledged');assert.match(exportCsv(exported),/agent_message/);assert.equal(exported.status,'completed');
}));
test('resposta recebida é reaproveitada na retomada e mudança da regra exige nova análise sem aprovações',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false;const generateTurn=async request=>{const answered=request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='request_requirement_clarification');if(answered&&!failed){failed=true;throw new Error('Interrupção depois da consulta.');}return collaborationFixtureTurn(request);};
  const services=scenarioServices(pool,store,{generateTurn}),{project,run,requirement}=await prepare(services);await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'failed');
  await services.runs.retry(run.id,{justification:'Retomada da conversa.'});await services.processor.processOne();let detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.agent_messages.length,1);
  assert.equal((await services.runs.agentSessions(run.id)).sessions.filter(s=>s.parent_session_id).length,1);
  await services.runs.reviewMessage(run.id,detail.agent_messages[0].id,{decision:'revision_requested',justification:'Regra requer revisão humana antes de novos casos.'});
  await assert.rejects(services.runs.approveStage(run.id,'tests',{justification:'Tentar reutilizar aprovação.'}),/inicie outra/);assert.deepEqual(detail.requirements[0],requirement);
  await services.runs.cancel(run.id,{justification:'Preservar anterior e abrir nova análise da regra.'});
  const next=await services.runs.create(project.id,{agent_policy:{modes:{tests:'agent/v1'}}});detail=await services.runs.detail(next.id);assert.equal(detail.requirements.length,0);assert.equal(detail.test_cases.length,0);assert.equal(detail.reviews.length,0);
  await services.runs.cancel(next.id,{justification:'Encerrar fixture.'});
}));
test('falha do A1 consultado é explícita, sem resposta inventada e sem reconhecer consulta indisponível',{skip:!url},async()=>environment(async({pool,store})=>{
  const services=scenarioServices(pool,store,{generateTurn:request=>{if(request.tools.some(t=>t.name==='respond_clarification'))throw new Error('Provedor sintético indisponível.');return collaborationFixtureTurn(request);}}),{run}=await prepare(services);
  await services.processor.processOne();const detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');const message=detail.agent_messages[0];assert.equal(message.response_data.status,'unavailable');
  await assert.rejects(services.runs.reviewMessage(run.id,message.id,{decision:'acknowledged',justification:'Não pode assumir sucesso.'}),/indisponível/);
  await services.runs.reviewMessage(run.id,message.id,{decision:'rejected',justification:'Resposta indisponível; casos precisam ser julgados pelo humano.'});
}));
test('consultas entre agentes têm limite global e a terceira solicitação é recusada sem iniciar outra sessão filha',{skip:!url},async()=>environment(async({pool,store})=>{
  const generateTurn=request=>{
    if(request.tools.some(t=>t.name==='respond_clarification'))return collaborationFixtureTurn(request);
    const next=testCasesFixtureTurn(request);if(!next.calls.some(c=>c.name==='submit_test_cases'))return next;
    const count=request.contents.flatMap(c=>c.parts).filter(p=>p.functionResponse?.name==='request_requirement_clarification').length;
    if(count<3)return fixtureTurn([{id:'clarify-'+count,name:'request_requirement_clarification',args:{requirement_code:'RF-001',question:'Dúvida técnica '+count}}]);return next;
  };
  const services=scenarioServices(pool,store,{generateTurn}),{run}=await prepare(services);await services.processor.processOne();
  const exported=await services.runs.export(run.id);assert.equal(exported.agent_messages.length,2);assert.equal(exported.agent_sessions.filter(s=>s.parent_session_id).length,2);
  const rejected=exported.agent_tool_calls.find(c=>c.name==='request_requirement_clarification' && c.status==='rejected');assert.match(rejected.observation_data.message,/duas consultas/);
}));
test('cancelar durante a consulta encerra pai/filha e preserva pedido sem inventar resposta',{skip:!url},async()=>environment(async({pool,store})=>{
  let entered;const ready=new Promise(resolve=>{entered=resolve;});
  const generateTurn=async request=>{if(request.tools.some(t=>t.name==='respond_clarification')){entered();await new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true});if(request.signal.aborted)reject(request.signal.reason);});}return collaborationFixtureTurn(request);};
  const services=scenarioServices(pool,store,{generateTurn}),{run}=await prepare(services),working=services.processor.processOne();await ready;await services.runs.cancel(run.id,{justification:'Controle de cancelamento durante conversa.'});await working;
  const exported=await services.runs.export(run.id);assert.equal(exported.status,'cancelled');assert.equal(exported.test_cases.length,0);assert.equal(exported.agent_messages[0].response,null);assert.ok(exported.agent_sessions.every(s=>s.status==='cancelled'));
}));
test('lease expirada durante a resposta retoma a sessão filha sem repetir fontes nem reiniciar o orçamento',{skip:!url},async()=>environment(async({pool,store})=>{
  let interrupted=false,runId;
  const generateTurn=async request=>{
    if(!interrupted && request.tools.some(t=>t.name==='respond_clarification') && request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='read_clarification_sources')) {
      interrupted=true;await pool.query("UPDATE research.stages SET lease_until=now()-interval '1 second' WHERE run_id=$1 AND agent='tests'",[runId]);
    }
    return collaborationFixtureTurn(request);
  };
  const services=scenarioServices(pool,store,{generateTurn}),{run}=await prepare(services);runId=run.id;await services.processor.processOne();
  await services.processor.recoverExpired();assert.equal((await services.runs.detail(run.id)).status,'failed');
  await services.runs.retry(run.id,{justification:'Retomar resposta com posse renovada.'});await services.processor.processOne();
  const exported=await services.runs.export(run.id);assert.equal(exported.status,'awaiting_review');assert.equal(exported.agent_messages.length,1);assert.equal(exported.agent_messages[0].status,'answered');
  assert.equal(exported.agent_tool_calls.filter(c=>c.name==='read_clarification_sources').length,1);
  const children=exported.agent_sessions.filter(s=>s.parent_session_id);assert.equal(children.length,2);assert.ok(children.reduce((n,s)=>n+s.model_turns,0)<=4);
}));
