import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {createAutomationService} from '../../src/research/automation.js';
import {createExecutionService} from '../../src/research/execution.js';
import {scenarioServices,textualScenario} from '../../test-support/research-scenario.js';
import {agentFixtureOutput,fixtureTurn} from '../../test-support/agent-scenario.js';
import {fixtureResult} from '../../../shared/execution-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'agent-integration-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
test('modo agentivo integra consultas, escopo escolhido, revisão e execução sem fallback',{skip:!url},async()=>environment(async({pool,store})=>{
  let turns=0,sent=false;
  const receipt={ready:true,deployment_id:'agent-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
  const executorClient={health:async()=>receipt,execute:async bundle=>{
    assert.ok(bundle.source_files.some(file=>file.path==='src/other.js'));assert.ok(!bundle.source_files.some(file=>file.path==='src/calc.js'));sent=true;
    const result=fixtureResult(bundle,'passed');result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;
  }};
  const generateTurn=async({contents})=>{
    turns++;const task=JSON.parse(contents[0].parts[0].text).untrusted_task;
    const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
    if(turns===1)return fixtureTurn([{id:'case',name:'get_approved_case',args:{case_id:task.case_catalog[0].id}},
      {id:'req',name:'get_approved_requirement',args:{requirement_code:task.requirement_codes[0]}},
      {id:'manifest',name:'list_sources',args:{offset:0,limit:20}}]);
    if(turns===2){assert.ok(responses.find(r=>r.name==='list_sources').response.files.some(f=>f.path==='src/other.js'));
      return fixtureTurn([{id:'read',name:'read_source',args:{path:'src/other.js',offset:0,length:1000}},{id:'scope',name:'prepare_automation_scope',args:{target_paths:['src/other.js']}}]);}
    const row=responses.find(r=>r.name==='get_approved_case').response;
    return fixtureTurn([{id:'submit',name:'submit_automation',args:{scope_id:responses.find(r=>r.name==='prepare_automation_scope').response.scope_id,
      output:agentFixtureOutput({scope:{commit_sha:task.commit_sha},test_cases:[row]},'src/other.js')}}]);
  };
  const services=scenarioServices(pool,store,{generateTurn,executorClient,repositoryFiles:{'package.json':'{"type":"module"}','src/calc.js':'export function sum(a,b){return a+b;}','src/other.js':'export function sum(a,b){return a+b;}'}});
  const {run,inspection}=await textualScenario(services,{agent_policy:{modes:{automation:'agent/v1'}}});
  const automation=createAutomationService({pool,store});
  await assert.rejects(automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',execution_mode:'fixed/v1',justification:'Troca indevida.'}),/snapshot/);
  await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',justification:'Controle agentivo.'});
  await services.processor.processOne();let detail=await services.runs.detail(run.id);
  assert.equal(detail.status,'awaiting_review');assert.equal(turns,3);
  const [script]=await automation.list(run.id);assert.equal(script.review_status,'pending');
  const request=await services.runs.artifact(run.id,script.generation_attempt_id,'input');
  assert.deepEqual(request.input.scope.target_paths,['src/other.js']);
  await automation.review(run.id,script.id,{revision:script.revision,decision:'approved',justification:'Revisão técnica da fixture.'});
  await automation.approve(run.id,{justification:'Fixture aprovada.'});
  await createExecutionService({pool,store,client:executorClient}).authorize(run.id,{justification:'Executor injetado, sem código real.'});
  await services.processor.processOne();assert.equal(sent,true);
  await services.processor.processOne();detail=await services.runs.detail(run.id);
  assert.equal(detail.findings[0].content.classification,'compatible');assert.equal(detail.test_results[0].status,'passed');
  const session=(await pool.query('SELECT * FROM research.agent_sessions WHERE run_id=$1',[run.id])).rows[0];assert.equal(session.status,'completed');
}));
test('repetição após esgotamento mantém orçamento e não recorre ao fluxo fixo',{skip:!url},async()=>environment(async({pool,store})=>{
  let turns=0;
  const services=scenarioServices(pool,store,{generateTurn:async()=>{turns++;return fixtureTurn([{id:'caps',name:'get_adapter_capabilities',args:{}}]);}});
  const {run,inspection}=await textualScenario(services,{agent_policy:{modes:{automation:'agent/v1'},limits:{max_model_turns:1}}});
  await createAutomationService({pool,store}).start(run.id,{inspection_id:inspection.inspection_id,module_root:'',justification:'Controle de orçamento.'});
  await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).status,'failed');
  await services.runs.retry(run.id,{justification:'Conferir consumo herdado.'});await services.processor.processOne();
  const detail=await services.runs.detail(run.id);assert.equal(detail.status,'failed');assert.equal(detail.automated_tests.length,0);assert.equal(turns,1);
  assert.match(detail.stages.find(s=>s.agent==='automation').message,/Orçamento/);
}));
