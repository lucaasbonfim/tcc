import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {requirementsFixtureTurn} from '../../test-support/requirements-agent-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'a1-agent-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
test('A1 agentivo preserva fontes e segue para revisão e casos fixos',{skip:!url},async()=>environment(async({pool,store})=>{
  const services=scenarioServices(pool,store,{generateTurn:requirementsFixtureTurn});
  const project=await services.projects.create({name:'A1 agentivo',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
  const run=await services.runs.create(project.id,{agent_policy:{modes:{requirements:'agent/v1'}}});
  await services.processor.processOne();let detail=await services.runs.detail(run.id);
  assert.equal(detail.status,'awaiting_review');assert.equal(detail.requirements[0].content.sources[0].quote,'O sistema deve somar dois números.');
  const [session]=(await services.runs.agentSessions(run.id)).sessions;assert.equal(session.agent,'requirements');assert.equal(session.status,'completed');
  await services.runs.approveStage(run.id,'requirements',{approve_pending:true,items:detail.requirements.map(({id,revision})=>({id,revision})),justification:'Controle técnico A1.'});
  await services.processor.processOne();detail=await services.runs.detail(run.id);assert.equal(detail.test_cases.length,1);
  const exported=await services.runs.export(run.id);assert.equal(exported.agent_steps.length,3);assert.equal(exported.agent_sessions[0].task.source_ids.length,1);
}));
test('A1 em partes lê cada catálogo, consolida e mantém sessões por parte',{skip:!url},async()=>environment(async({pool,store})=>{
  const services=scenarioServices(pool,store,{generateTurn:requirementsFixtureTurn});
  const project=await services.projects.create({name:'A1 documental extenso',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números. '.repeat(1000)});
  const run=await services.runs.create(project.id,{agent_policy:{modes:{requirements:'agent/v1'}}});let detail;
  for(let i=0;i<20;i++){await services.processor.processOne();detail=await services.runs.detail(run.id);if(detail.status!=='pending')break;}
  assert.equal(detail.status,'awaiting_review');assert.ok(detail.requirement_parts.length>1);
  assert.ok(detail.requirement_parts.every(part=>part.status==='completed'));assert.ok(detail.consolidation_data);
  const sessions=(await services.runs.agentSessions(run.id,{limit:100})).sessions;
  assert.equal(sessions.length,detail.requirement_parts.length);assert.ok(sessions.every(s=>s.requirement_part_id && !s.automation_part_id));
  for(const session of sessions){const state=await store.json(session.context);const read=new Set((state.tool_states || []).flatMap(s=>s.read_source_ids || []));assert.equal(read.size,session.task.source_ids.length);}
}));
test('continuação de A1 preserva definição e exporta trajetórias dos checkpoints reaproveitados',{skip:!url},async()=>environment(async({pool,store})=>{
  let failures=2;
  const services=scenarioServices(pool,store,{generateTurn:async request=>{
    const initial=JSON.parse(request.contents[0].parts[0].text).untrusted_task;
    if(initial.part?.sequence===2 && failures>0){failures--;throw new Error('Falha sintética de interrupção.');}
    return requirementsFixtureTurn(request);
  }});
  const project=await services.projects.create({name:'Continuidade A1 agentiva',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números. '.repeat(1000)});
  const run=await services.runs.create(project.id,{agent_policy:{modes:{requirements:'agent/v1'}}});let before;
  for(let i=0;i<10;i++){await services.processor.processOne();before=await services.runs.detail(run.id);if(before.status==='failed')break;}
  assert.equal(before.status,'failed');assert.equal(before.requirement_parts.filter(p=>p.status==='completed').length,1);
  const middle=await services.runs.resume(run.id,{justification:'Primeira continuação técnica.'});
  await services.processor.processOne();assert.equal((await services.runs.detail(middle.id)).status,'failed');
  const continuation=await services.runs.resume(middle.id,{justification:'Controle de continuação com fontes e definição preservadas.'});let after;
  for(let i=0;i<30;i++){await services.processor.processOne();after=await services.runs.detail(continuation.id);if(after.status!=='pending')break;}
  assert.equal(after.status,'awaiting_review');
  assert.deepEqual(after.snapshot_data.requirements_agent_definition,before.snapshot_data.requirements_agent_definition);
  assert.equal(after.stages.find(s=>s.agent==='requirements').context.execution_mode,'agent/v1');
  const reused=after.requirement_parts.filter(p=>p.reused_from_part_id);assert.equal(reused.length,1);
  const sessions=(await services.runs.agentSessions(continuation.id,{limit:100})).sessions;
  assert.equal(sessions.length,after.requirement_parts.length-reused.length);
  const exported=await services.runs.export(continuation.id);
  assert.ok(exported.reused_agent_histories[run.id].agent_steps.length>0);
  assert.ok(exported.reused_agent_histories[middle.id]);
  assert.equal(exported.requirement_parts.find(p=>p.reused_from_part_id).reused_lineage.length,2);
}));
