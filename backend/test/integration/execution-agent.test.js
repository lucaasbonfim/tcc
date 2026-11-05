import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {executionAgentScenario} from '../../test-support/execution-agent-scenario.js';
import {executionPlanningFixtureTurn} from '../../test-support/execution-agent-fixture.js';
import {fixtureTurn} from '../../test-support/agent-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'a3-agent-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
test('A3 consulta scripts, escolhe ordem/lotes e exige autorização antes do executor determinístico',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,execution,sent}=await executionAgentScenario(pool,store,{count:2});
  await assert.rejects(execution.authorize(run.id,{justification:'Sem plano.'}),/planejamento/);
  await execution.startPlanning(run.id,{justification:'Solicitar plano técnico.'});await services.processor.processOne();let detail=await services.runs.detail(run.id);
  assert.equal(detail.status,'awaiting_review');assert.equal(detail.execution_jobs.length,0);assert.equal(sent.length,0);
  const proposal=detail.execution_proposals[0];assert.equal(proposal.phase,'planning');assert.equal(proposal.review_status,'pending');
  const expected=proposal.output_data.groups.flatMap(g=>g.script_ids);assert.deepEqual(expected,detail.automated_tests.map(s=>s.id).sort().reverse());
  assert.equal((await services.runs.agentSessions(run.id)).sessions[0].execution_phase,'planning');
  await execution.authorize(run.id,{proposal_id:proposal.id,justification:'Plano conferido; autorizar dois lotes da fixture.'});await services.processor.processOne();await services.processor.processOne();
  assert.deepEqual(sent.map(b=>b.generated_tests[0].id),expected);await services.processor.processOne();detail=await services.runs.export(run.id);
  assert.equal(detail.execution_proposals[0].review_status,'accepted');assert.equal(detail.execution_plans[0].planner_mode,'agent/v1');assert.equal(detail.evidence.length,2);assert.equal(detail.findings.length,2);
}));
test('A3 retoma leitura confirmada, preserva orçamento e registra correção de agrupamento rejeitado',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false,invalid=false;
  const generateTurn=async request=>{const responses=request.contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
    if(!failed&&responses.some(r=>r.name==='read_execution_script')){failed=true;throw new Error('Interrupção sintética A3.');}
    if(!invalid&&responses.some(r=>r.name==='read_execution_script')){invalid=true;return fixtureTurn([{id:'invalid',name:'validate_execution_groups',args:{groups:[]}}]);}return executionPlanningFixtureTurn(request);};
  const {services,run,execution}=await executionAgentScenario(pool,store,{generateTurn});await execution.startPlanning(run.id,{justification:'Controle de retomada.'});await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'failed');
  await services.runs.retry(run.id,{justification:'Retomar orçamento e observações.'});await services.processor.processOne();
  const detail=await services.runs.export(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.agent_sessions.length,2);assert.equal(detail.agent_tool_calls.filter(c=>c.name==='read_execution_script').length,1);assert.ok(detail.agent_tool_calls.some(c=>c.name==='validate_execution_groups'&&c.status==='rejected'));
}));
test('autorização A3 recusa revisão/caso/ambiente diferentes dos consultados no plano',{skip:!url},async()=>environment(async({pool,store})=>{
  for(const change of ['script','case','environment']) {
    const {services,run,execution,receipt,sent}=await executionAgentScenario(pool,store);await execution.startPlanning(run.id,{justification:'Planejamento antes da mudança.'});await services.processor.processOne();const detail=await services.runs.detail(run.id);
    if(change==='script')await pool.query('UPDATE research.automated_tests SET revision=revision+1 WHERE run_id=$1',[run.id]);else if(change==='case')await pool.query('UPDATE research.test_cases SET revision=revision+1 WHERE run_id=$1',[run.id]);else receipt.policy_sha256='c'.repeat(64);
    await assert.rejects(execution.authorize(run.id,{proposal_id:detail.execution_proposals[0].id,justification:'Tentar autorização antiga.'}),/mudaram/);assert.equal(sent.length,0);assert.equal((await services.runs.detail(run.id)).execution_jobs.length,0);
  }
}));
