import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {autonomousFixtureTurn} from '../../test-support/autonomous-fixture.js';
import {fixtureResult} from '../../../shared/execution-fixture.js';
const url=process.env.TEST_DATABASE_URL;if(url&&!new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function env(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'autonomous-run-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(pool,store,{native=false,generateTurn=autonomousFixtureTurn,status='passed'}={}) {
  const receipt={ready:true,deployment_id:'autonomous-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}},sent=[];
  const executorClient={health:async()=>receipt,execute:async bundle=>{sent.push(bundle.id);const result=fixtureResult(bundle,status);result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
  const services=scenarioServices(pool,store,{executorClient,generateTurn}),project=await services.projects.create({name:'Fluxo autônomo de controle',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'}),version=(await services.projects.detail(project.id)).versions[0],inspection=await services.projects.inspect(project.id,version.id);
  const run=await services.runs.create(project.id,{workflow_mode:'autonomous/v1',...(native?{}:{agent_policy:{}}),autonomy:{authorize_execution:true,inspection_id:inspection.inspection_id,module_root:'',justification:'Autorização inicial da fixture, não julgamento científico.'}});return {services,run,receipt,sent};
}
async function complete(services,run){let detail;for(let i=0;i<18;i++){await services.processor.processOne();detail=await services.runs.detail(run.id);if(['completed','failed','cancelled'].includes(detail.status))break;}return detail;}
test('fluxo autônomo fixo chega à avaliação sem aprovações intermediárias ou autoria humana fictícia',{skip:!url},async()=>env(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store),detail=await complete(services,run);assert.equal(detail.status,'completed',detail.workflow_error||detail.stages.find(s=>s.status==='failed')?.message);assert.equal(sent.length,1);assert.equal(detail.findings.length,1);assert.equal(detail.reviews.length,0);
  for(const row of [...detail.requirements,...detail.test_cases,...detail.automated_tests]){assert.equal(row.review_status,'pending');assert.equal(row.processing_status,'eligible');}
  assert.equal(detail.execution_plans[0].authorization_source,'initial_grant');assert.ok(detail.execution_plans[0].grant_id);
}));
test('todos os agentes e consultas avançam autonomamente e preservam candidatos para avaliação posterior',{skip:!url},async()=>env(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store,{native:true,status:'failed'}),detail=await complete(services,run);assert.equal(detail.status,'completed',detail.workflow_error||detail.stages.find(s=>s.status==='failed')?.message);assert.equal(detail.findings.length,1);assert.equal(sent.length,1);assert.equal(detail.reviews.length,0);assert.equal(detail.agent_messages.length,2);assert.ok(detail.agent_messages.every(m=>m.review_status==='pending'));assert.equal(detail.automated_tests[0].version,1);assert.ok(detail.agent_summary.sessions>=7);
  assert.ok(detail.execution_proposals.every(p=>p.review_status==='pending'));await services.runs.reviewMessage(run.id,detail.agent_messages[0].id,{decision:'acknowledged',justification:'Julgamento posterior da fixture.'});assert.equal((await services.runs.detail(run.id)).status,'completed');
  const history=await services.runs.export(run.id);
  assert.equal(history.history_mode,'recorded');assert.equal(history.timeline_summary.requests,2);assert.equal(history.timeline_summary.completed_cycles,2);assert.equal(history.timeline_summary.technical_retries,0);
  for(const message of detail.agent_messages){const events=history.run_events.filter(e=>e.message_id===message.id && ['message_request','message_response'].includes(e.kind));assert.equal(events.length,2);assert.ok(events.every(e=>e.snapshot_id));assert.equal(events[0].correlation_id,events[1].correlation_id);assert.equal(events[0].agent,events[1].recipient);}
  assert.ok(history.artifact_snapshots.some(s=>s.data.artifacts?.some(a=>a.files_data)));
  const originalSnapshot=history.artifact_snapshots.find(s=>s.data.artifacts?.some(a=>a.files_data)),before=JSON.stringify(detail.automated_tests);
  const judgment=await services.runs.assess(run.id,{snapshot_id:originalSnapshot.id,verdict:'partial',justification:'Julgamento de controle sobre a saída original.',reference_note:'Fixture; não é referência científica.'});assert.equal(judgment.actor,'admin');assert.equal(judgment.snapshot_id,originalSnapshot.id);
  assert.equal((await services.runs.assessments(run.id)).length,1);assert.equal(JSON.stringify((await services.runs.detail(run.id)).automated_tests),before);assert.equal((await services.runs.detail(run.id)).status,'completed');assert.ok((await services.runs.events(run.id,{limit:200})).events.some(e=>e.kind==='human_assessment'));
}));
test('mudança do ambiente após autorização inicial encerra a condição sem enviar código',{skip:!url},async()=>env(async({pool,store})=>{
  const {services,run,receipt,sent}=await prepare(pool,store);receipt.policy_sha256='c'.repeat(64);const detail=await complete(services,run);assert.equal(detail.status,'failed');assert.match(detail.workflow_error,/autorização inicial/);assert.equal(sent.length,0);assert.equal(detail.reviews.length,0);
}));
test('cancelar antes do início preserva autorização e não aciona o executor',{skip:!url},async()=>env(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store);await services.runs.cancel(run.id,{justification:'Cancelamento de controle.'});await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'cancelled');assert.equal(sent.length,0);
  await assert.rejects(services.runs.assess(run.id,{snapshot_id:'00000000-0000-4000-8000-000000000001',verdict:'correct',justification:'Snapshot não pertence.'}),e=>e.statusCode===404);
}));
