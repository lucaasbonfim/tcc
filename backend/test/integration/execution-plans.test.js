import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/storage/artifacts.js';
import {createAutomationService} from '../../src/research/services/automation.js';
import {createExecutionService} from '../../src/research/services/execution.js';
import {scenarioServices,textualScenario} from '../../test-support/research-scenario.js';
import {generatedPath} from '../../src/research/agents/tests/scripts/contracts.js';
import {fixtureResult} from '../../../shared/execution-fixture.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function environment(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'execution-plans-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(pool,store,{count=21,failSecond=false}={}) {
  const sent=[],receipt={ready:true,deployment_id:'plan-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};let failed=false;
  const executorClient={health:async()=>receipt,execute:async bundle=>{sent.push(bundle.job_id);if(failSecond && sent.length===2 && !failed){failed=true;throw new Error('Falha sintética de transporte.');}const result=fixtureResult(bundle);result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
  const services=scenarioServices(pool,store,{executorClient}),{run,inspection}=await textualScenario(services),automation=createAutomationService({pool,store});
  await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',target_paths:['src/calc.js'],justification:'Controle de plano.'});await services.processor.processOne();const [script]=await automation.list(run.id);
  await automation.review(run.id,script.id,{revision:script.revision,decision:'approved',justification:'Script de controle aprovado.'});await automation.approve(run.id,{justification:'Fixture de aprovação.'});
  // Seeds exclusivos do banco de teste: simular uma suíte maior já revisada, sem gerar custo de LLM.
  const original=(await services.runs.detail(run.id)).test_cases[0];
  for(let i=1;i<count;i++){const caseId=randomUUID(),content={...original.content,code:'CT-'+String(i+1).padStart(3,'0')};await pool.query("INSERT INTO research.test_cases(id,run_id,code,content,review_status) VALUES($1,$2,$3,$4,'approved')",[caseId,run.id,content.code,content]);
    const files=await store.put(script.files_data.map(file=>({...file,path:generatedPath(caseId,'node-test/v2').path})));
    await pool.query("INSERT INTO research.automated_tests(id,run_id,test_case_id,generation_attempt_id,adapter,content,files,compatibility,review_status) VALUES($1,$2,$3,$4,$5,$6,$7,'compatible','approved')",[randomUUID(),run.id,caseId,script.generation_attempt_id,script.adapter,{...script.content,test_case_id:caseId},files]);}
  const execution=createExecutionService({pool,store,client:executorClient}),authorization=await execution.authorize(run.id,{justification:'Plano sintético; executor injetado.'});return {services,run,sent,execution,authorization};
}
test('suíte de 81 scripts usa cinco checkpoints, sem perder resultados ou limitar a três bundles',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,sent,authorization}=await prepare(pool,store,{count:81});assert.equal(authorization.bundles,5);
  for(let i=0;i<5;i++){await services.processor.processOne();const detail=await services.runs.detail(run.id);assert.equal(detail.test_results.length,Math.min((i+1)*20,81));assert.equal(detail.findings.length,0);}
  const detail=await services.runs.export(run.id);assert.equal(new Set(sent).size,5);assert.equal(detail.evidence.length,5);assert.equal(detail.execution_plans[0].status,'completed');assert.equal(detail.status,'pending');
  assert.ok(detail.attempts.filter(a=>a.execution_job_id).every(a=>a.status==='completed'));assert.equal(detail.execution_plans[0].manifest_data.scripts.length,81);
  await services.processor.processOne();assert.equal((await services.runs.detail(run.id)).findings.length,81);
}));
test('falha no segundo bundle preserva o primeiro e repetição usa o mesmo ID/hash do trabalho',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store,{failSecond:true});await services.processor.processOne();await services.processor.processOne();let detail=await services.runs.detail(run.id);assert.equal(detail.status,'failed');assert.equal(detail.evidence.length,1);assert.equal(detail.execution_plans[0].status,'failed');
  await services.runs.retry(run.id,{justification:'Repetir transporte, não ensaio novo.'});await services.processor.processOne();detail=await services.runs.detail(run.id);
  assert.equal(sent[1],sent[2]);assert.notEqual(sent[0],sent[1]);assert.equal(detail.evidence.length,2);assert.equal(detail.test_results.length,21);assert.equal(detail.execution_plans[0].status,'completed');
  await services.processor.processOne();
}));
test('cancelar após um bundle preserva evidência parcial e impede executar os restantes',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store);await services.processor.processOne();await services.runs.cancel(run.id,{justification:'Cancelar restante da suíte.'});assert.equal(await services.processor.processOne(),false);
  const detail=await services.runs.detail(run.id);assert.equal(sent.length,1);assert.equal(detail.execution_plans[0].status,'cancelled');assert.equal(detail.test_results.length,20);assert.deepEqual(detail.execution_jobs.map(j=>j.status),['completed','cancelled']);
}));
test('revisão posterior à autorização não reutiliza recibo nem envia script alterado',{skip:!url},async()=>environment(async({pool,store})=>{
  const {services,run,sent}=await prepare(pool,store,{count:1});await pool.query('UPDATE research.automated_tests SET revision=revision+1 WHERE run_id=$1',[run.id]);await services.processor.processOne();
  const detail=await services.runs.detail(run.id);assert.equal(detail.status,'failed');assert.equal(sent.length,0);assert.equal(detail.evidence.length,0);assert.match(detail.stages.find(s=>s.agent==='execution').message,/revisão mudou/);
}));
