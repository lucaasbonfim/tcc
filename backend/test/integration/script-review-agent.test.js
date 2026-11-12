import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/storage/artifacts.js';
import {executionAgentScenario} from '../../test-support/execution-agent-scenario.js';
import {scriptReviewFixtureTurn} from '../../test-support/script-review-fixture.js';
import {createEvaluationService} from '../../src/research/services/evaluation.js';
import {fixtureTurn} from '../../test-support/agent-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'script-review-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(pool,store,generateTurn=scriptReviewFixtureTurn) {
  const scenario=await executionAgentScenario(pool,store,{generateTurn,status:'failed'}),{services,run,execution}=scenario;await execution.startPlanning(run.id,{justification:'Planejar fixture de revisão.'});await services.processor.processOne();const detail=await services.runs.detail(run.id);await execution.authorize(run.id,{proposal_id:detail.execution_proposals[0].id,justification:'Autorizar fixture.'});await services.processor.processOne();return scenario;
}
test('A3 consulta A2 e preserva script/evidência/aprovação com proposta versionada separada',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,execution,sent}=await prepare(pool,store);let detail=await services.runs.detail(run.id);const original=detail.automated_tests[0],evidence=detail.evidence[0];await services.processor.processOne();await services.processor.processOne();detail=await services.runs.detail(run.id);
  const message=detail.agent_messages.find(m=>m.kind==='script_review');assert.equal(message.sender,'execution');assert.equal(message.recipient,'automation');assert.equal(message.automated_test_id,original.id);assert.equal(message.script_revision,original.revision);assert.equal(message.response_data.proposed_version,original.version+1);assert.equal(message.response_data.script_changed,false);
  assert.deepEqual(detail.automated_tests[0],original);assert.deepEqual(detail.evidence[0],evidence);assert.equal(sent.length,1);assert.ok(detail.execution_proposals.find(p=>p.phase==='diagnosis').output_data.diagnostics[0].rationale.includes('Consulta ao A2'));
  const child=(await services.runs.agentSessions(run.id)).sessions.find(s=>s.parent_session_id);assert.equal(child.agent,'automation');assert.equal(child.execution_phase,null);
  const evaluation=createEvaluationService({pool,store}),finding=detail.findings[0];await evaluation.review(run.id,finding.id,{revision:finding.revision,decision:'confirmed',classification:'test_problem',justification:'Classificação humana sintética.'});await execution.reviewDiagnosis(run.id,detail.execution_proposals.find(p=>p.phase==='diagnosis').id,{decision:'accepted',justification:'Diagnóstico conferido.'});await assert.rejects(evaluation.approve(run.id,{justification:'Sem revisar resposta A2.'}),/respostas/);
  await services.runs.reviewMessage(run.id,message.id,{decision:'revision_requested',justification:'Proposta precisa de outra análise/revisão antes de executar.'});await evaluation.approve(run.id,{justification:'Encerrar controle preservando necessidade de revisão.'});
  await assert.rejects(execution.authorize(run.id,{justification:'Não reutilizar autorização para o rascunho.'}));const exported=await services.runs.export(run.id);assert.equal(exported.agent_messages[0].review_status,'revision_requested');assert.ok(exported.agent_messages[0].response_data.candidate_files.sha256);assert.equal(exported.automated_tests[0].version,original.version);
}));
test('retomada após resposta do A2 reutiliza mensagem, candidato e leituras, sem nova execução',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false;const generateTurn=async request=>{if(!failed && request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='request_script_review')){failed=true;throw new Error('Interrupção sintética depois da resposta.');}return scriptReviewFixtureTurn(request);};
  const {services,run,sent}=await prepare(pool,store,generateTurn);await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'failed');await services.runs.retry(run.id,{justification:'Retomar consulta sem duplicar.'});await services.processor.processOne();await services.processor.processOne();const exported=await services.runs.export(run.id);assert.equal(exported.agent_messages.length,1);assert.equal(exported.agent_sessions.filter(s=>s.parent_session_id).length,1);assert.equal(exported.agent_tool_calls.filter(c=>c.name==='read_script_review_context').length,1);assert.equal(sent.length,1);
}));
test('indisponibilidade do A2 preserva aprovado e não é reconhecida como revisão concluída',{skip:!url},async()=>environment(async({pool,store})=>{
  const generateTurn=request=>{if(request.tools.some(t=>t.name==='respond_script_review'))throw new Error('Consulta A2 indisponível na fixture.');return scriptReviewFixtureTurn(request);};
  const {services,run}=await prepare(pool,store,generateTurn);await services.processor.processOne();await services.processor.processOne();const detail=await services.runs.detail(run.id),message=detail.agent_messages[0];assert.equal(message.response_data.status,'unavailable');await assert.rejects(services.runs.reviewMessage(run.id,message.id,{decision:'acknowledged',justification:'Não assumir resposta válida.'}),/indisponível/);assert.equal(detail.automated_tests[0].version,1);
}));
test('A2 corrige proposta de arquivo fora do escopo sem modificar implementação',{skip:!url},async()=>environment(async({pool,store})=>{
  let invalid=false;const generateTurn=request=>{const next=scriptReviewFixtureTurn(request),reply=next.calls.find(c=>c.name==='respond_script_review');if(reply&&!invalid){invalid=true;const calls=structuredClone(next.calls);calls[0].args.output.files[0].path='src/calc.js';return fixtureTurn(calls);}return next;};
  const {services,run}=await prepare(pool,store,generateTurn);await services.processor.processOne();await services.processor.processOne();const exported=await services.runs.export(run.id);assert.ok(exported.agent_tool_calls.some(c=>c.name==='respond_script_review'&&c.status==='rejected'));assert.ok(exported.agent_messages[0].response_data.files[0].path.startsWith('__research_generated__/'));assert.equal(exported.automated_tests[0].version,1);
}));
test('cancelamento na sessão filha A2 preserva evidência anterior e pedido sem resposta inventada',{skip:!url},async()=>environment(async({pool,store})=>{
  let entered;const ready=new Promise(resolve=>{entered=resolve;});const generateTurn=async request=>{if(request.tools.some(t=>t.name==='respond_script_review')){entered();await new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true});if(request.signal.aborted)reject(request.signal.reason);});}return scriptReviewFixtureTurn(request);};
  const {services,run}=await prepare(pool,store,generateTurn),working=services.processor.processOne();await ready;await services.runs.cancel(run.id,{justification:'Cancelar consulta A3/A2 na fixture.'});await working;const exported=await services.runs.export(run.id);assert.equal(exported.status,'cancelled');assert.equal(exported.evidence.length,1);assert.equal(exported.agent_messages[0].response,null);assert.equal(exported.automated_tests[0].version,1);assert.ok(exported.agent_sessions.filter(s=>s.execution_phase==='diagnosis'||s.parent_session_id).every(s=>s.status==='cancelled'));
}));
