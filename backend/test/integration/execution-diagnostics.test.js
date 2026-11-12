import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/storage/artifacts.js';
import {createEvaluationService} from '../../src/research/services/evaluation.js';
import {executionAgentScenario} from '../../test-support/execution-agent-scenario.js';
import {executionAgentFixtureTurn} from '../../test-support/execution-agent-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'a3-diagnosis-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function execute(scenario) {const {services,run,execution}=scenario;await execution.startPlanning(run.id,{justification:'Planejar controle.'});await services.processor.processOne();const proposal=(await services.runs.detail(run.id)).execution_proposals[0];await execution.authorize(run.id,{proposal_id:proposal.id,justification:'Autorizar controle.'});await services.processor.processOne();}
test('diagnóstico consulta evidências, separa orçamento de planejamento e exige revisão antes de concluir A4',{skip:!url},async()=>environment(async({pool,store})=>{
  const scenario=await executionAgentScenario(pool,store,{limits:{max_model_turns:4}}),{services,run,execution}=scenario;await execute(scenario);let detail=await services.runs.detail(run.id);assert.equal(detail.evidence.length,1);assert.equal(detail.execution_plans[0].status,'completed');
  await services.processor.processOne();detail=await services.runs.detail(run.id);assert.equal(detail.findings.length,0);const diagnosis=detail.execution_proposals.find(p=>p.phase==='diagnosis');assert.equal(diagnosis.output_data.diagnostics[0].kind,'compatible');assert.equal(diagnosis.review_status,'pending');
  const sessions=(await services.runs.agentSessions(run.id)).sessions;assert.deepEqual(sessions.map(s=>s.execution_phase),['planning','diagnosis']);assert.ok(sessions.reduce((n,s)=>n+s.model_turns,0)>4);
  await services.processor.processOne();detail=await services.runs.detail(run.id);const evaluation=createEvaluationService({pool,store}),finding=detail.findings[0];await evaluation.review(run.id,finding.id,{revision:finding.revision,decision:'confirmed',justification:'Julgamento sintético A4.'});
  await assert.rejects(evaluation.approve(run.id,{justification:'Sem revisar A3.'}),/diagnóstico/);await execution.reviewDiagnosis(run.id,diagnosis.id,{decision:'accepted',justification:'Diagnóstico conferido na fixture.'});await evaluation.approve(run.id,{justification:'Controle concluído.'});assert.equal((await services.runs.detail(run.id)).status,'completed');
}));
test('falha/retomada do diagnóstico mantém evidência e não reexecuta bundle',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false;const generateTurn=async request=>{if(!failed && request.tools.some(t=>t.name==='submit_execution_diagnostics') && request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='read_execution_evidence')){failed=true;throw new Error('Falha sintética no diagnóstico.');}return executionAgentFixtureTurn(request);};
  const scenario=await executionAgentScenario(pool,store,{generateTurn,status:'failed'}),{services,run,sent}=scenario;await execute(scenario);await services.processor.processOne();let detail=await services.runs.detail(run.id);assert.equal(detail.status,'failed');assert.equal(detail.execution_plans[0].status,'completed');assert.equal(detail.evidence.length,1);
  await services.runs.retry(run.id,{justification:'Retomar só diagnóstico.'});await services.processor.processOne();await services.processor.processOne();detail=await services.runs.export(run.id);assert.equal(sent.length,1);assert.equal(detail.evidence.length,1);assert.equal(detail.agent_tool_calls.filter(c=>c.name==='read_execution_evidence').length,1);assert.equal(detail.execution_proposals.find(p=>p.phase==='diagnosis').output_data.diagnostics[0].kind,'assertion_failure');
}));
