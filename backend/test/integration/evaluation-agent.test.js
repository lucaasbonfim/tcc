import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/storage/artifacts.js';
import {createAutomationService} from '../../src/research/services/automation.js';
import {createExecutionService} from '../../src/research/services/execution.js';
import {createEvaluationService} from '../../src/research/services/evaluation.js';
import {scenarioServices,textualScenario} from '../../test-support/research-scenario.js';
import {evaluationFixtureTurn} from '../../test-support/evaluation-agent-fixture.js';
import {fixtureResult} from '../../../shared/execution-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'a4-agent-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(pool,store,generateTurn) {
  const receipt={ready:true,deployment_id:'a4-agent-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
  const executorClient={health:async()=>receipt,execute:async bundle=>{const result=fixtureResult(bundle,'failed');result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
  const services=scenarioServices(pool,store,{executorClient,generateTurn}),{run,inspection}=await textualScenario(services,{agent_policy:{modes:{evaluation:'agent/v1'}}});
  const automation=createAutomationService({pool,store});await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',target_paths:['src/calc.js'],justification:'Controle técnico A4.'});await services.processor.processOne();
  const [script]=await automation.list(run.id);await automation.review(run.id,script.id,{revision:script.revision,decision:'approved',justification:'Fixture de script.'});await automation.approve(run.id,{justification:'Fixture aprovada.'});
  await createExecutionService({pool,store,client:executorClient}).authorize(run.id,{justification:'Executor injetado, sem execução real.'});await services.processor.processOne();
  return {services,run};
}
test('A4 consulta evidências e referências, fixa perfil e exige revisão humana separada',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run}=await prepare(pool,store,evaluationFixtureTurn);await services.processor.processOne();
  const detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.findings.length,1);assert.equal(detail.findings[0].review_status,'pending');
  const stage=detail.stages.find(s=>s.agent==='evaluation');assert.deepEqual(stage.context.agent_definition,detail.snapshot_data.evaluation_agent_definition);
  assert.equal(detail.findings[0].content.observed_behavior,detail.test_results[0].content.observed.slice(0,8000));
  const sessions=(await services.runs.agentSessions(run.id)).sessions;assert.equal(sessions[0].agent,'evaluation');assert.equal(sessions[0].test_part_id,null);
  const evaluation=createEvaluationService({pool,store});await assert.rejects(evaluation.approve(run.id,{justification:'Antes da revisão.'}),/Revise/);
  await evaluation.review(run.id,detail.findings[0].id,{revision:0,decision:'confirmed',classification:'test_problem',justification:'Reclassificação humana sintética.'});await evaluation.approve(run.id,{justification:'Controle concluído.'});
  const exported=await services.runs.export(run.id);assert.equal(exported.findings[0].content.classification,'possible_functional_divergence');assert.equal(exported.findings[0].human_classification,'test_problem');
  assert.ok(exported.agent_tool_calls.some(c=>c.name==='read_evaluation_context'));assert.equal(exported.status,'completed');
}));
test('A4 retoma consulta confirmada sem repetir leitura nem criar conclusões antes da submissão',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false;const generateTurn=async request=>{if(!failed && request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='read_evaluation_context')){failed=true;throw new Error('Interrupção sintética A4.');}return evaluationFixtureTurn(request);};
  const {services,run}=await prepare(pool,store,generateTurn);await services.processor.processOne();let detail=await services.runs.detail(run.id);assert.equal(detail.status,'failed');assert.equal(detail.findings.length,0);
  await services.runs.retry(run.id,{justification:'Retomada técnica.'});await services.processor.processOne();detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');
  const exported=await services.runs.export(run.id);assert.equal(exported.agent_tool_calls.filter(c=>c.name==='read_evaluation_context').length,1);assert.equal(exported.agent_sessions.length,2);
}));
