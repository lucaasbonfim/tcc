import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {testCasesFixtureTurn} from '../../test-support/tests-agent-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'a2-text-agent-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(services,pool,count=1) {
  const project=await services.projects.create({name:'A2 textual agentivo',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
  const run=await services.runs.create(project.id,{agent_policy:{modes:{tests:'agent/v1'}}});await services.processor.processOne();let detail=await services.runs.detail(run.id);
  for(let i=2;i<=count;i++){const code=`RF-${String(i).padStart(3,'0')}`,content={...detail.requirements[0].content,code};await pool.query('INSERT INTO research.requirements(id,run_id,code,content) VALUES($1,$2,$3,$4)',[randomUUID(),run.id,code,content]);}
  detail=await services.runs.detail(run.id);
  await services.runs.approveStage(run.id,'requirements',{approve_pending:true,items:detail.requirements.map(({id,revision})=>({id,revision})),justification:'Requisitos de controle da plataforma.'});return run;
}
test('A2 textual consulta requisitos em partes e preserva códigos globais e revisão',{skip:!url},async()=>environment(async({pool,store})=>{
  const services=scenarioServices(pool,store,{generateTurn:testCasesFixtureTurn}),run=await prepare(services,pool,6);let detail;
  for(let i=0;i<10;i++){await services.processor.processOne();detail=await services.runs.detail(run.id);if(detail.status!=='pending')break;}
  assert.equal(detail.status,'awaiting_review');assert.equal(detail.test_cases.length,6);assert.equal(new Set(detail.test_cases.map(c=>c.code)).size,6);
  assert.equal(detail.test_parts.length,2);assert.equal(detail.test_coverage.missing.length,0);assert.ok(detail.test_cases.every(c=>c.review_status==='pending'));
  const sessions=(await services.runs.agentSessions(run.id)).sessions;
  assert.equal(sessions.length,2);assert.ok(sessions.every(s=>s.agent==='tests' && s.test_part_id));
  await services.runs.approveStage(run.id,'tests',{approve_pending:true,items:detail.test_cases.map(({id,revision})=>({id,revision})),justification:'Controle técnico, não julgamento independente.'});
  assert.equal((await services.runs.detail(run.id)).status,'completed');
}));
test('A2 textual retoma depois da leitura sem repetir a consulta já concluída',{skip:!url},async()=>environment(async({pool,store})=>{
  let failed=false;
  const services=scenarioServices(pool,store,{generateTurn:async request=>{
    const read=request.contents.flatMap(c=>c.parts).some(p=>p.functionResponse?.name==='read_test_requirement');
    if(read && !failed){failed=true;throw new Error('Falha sintética depois da leitura.');}return testCasesFixtureTurn(request);
  }}),run=await prepare(services,pool);
  await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'failed');
  await services.runs.retry(run.id,{justification:'Conferir retomada A2 textual.'});await services.processor.processOne();
  const detail=await services.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.test_cases.length,1);
  const exported=await services.runs.export(run.id);assert.equal(exported.agent_tool_calls.filter(c=>c.name==='read_test_requirement').length,1);
  assert.equal(exported.agent_sessions.length,2);
}));
