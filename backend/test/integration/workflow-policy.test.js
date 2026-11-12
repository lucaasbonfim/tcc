import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {admitProduced,assertEnvironmentGrant} from '../../src/research/orchestrator/workflow-policy.js';
import {transaction} from '../../src/research/errors.js';
const url=process.env.TEST_DATABASE_URL;
if(url&&!new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function env(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'workflow-policy-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
const receipt={ready:true,deployment_id:'workflow-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
async function project(services){const p=await services.projects.create({name:'Política experimental',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'}),v=(await services.projects.detail(p.id)).versions[0],inspection=await services.projects.inspect(p.id,v.id);return {project:p,version:v,inspection};}
test('autonomia exige consentimento, inspeção do SHA e recibo, sem atribuir aprovação humana às saídas',{skip:!url},async()=>env(async({pool,store})=>{
  const services=scenarioServices(pool,store,{executorClient:{health:async()=>receipt}}),p=await project(services);
  await assert.rejects(services.runs.create(p.project.id,{workflow_mode:'autonomous/v1'}),/Autorize/);
  const opts={workflow_mode:'autonomous/v1',agent_policy:{},autonomy:{authorize_execution:true,inspection_id:p.inspection.inspection_id,module_root:'',justification:'Autorização sintética da fixture.'}};
  await assert.rejects(services.runs.create(p.project.id,{...opts,autonomy:{...opts.autonomy,module_root:'foreign'}}),/Módulo/);
  const run=await services.runs.create(p.project.id,opts);await services.processor.processOne();let detail=await services.runs.detail(run.id);const stage=detail.stages.find(s=>s.agent==='requirements');
  await assert.rejects(services.runs.resume(run.id,{justification:'Não reutilizar autorização em continuação.'}),/autorização inicial/);
  assert.equal(run.workflow_mode,'autonomous/v1');assert.equal(detail.requirements[0].review_status,'pending');
  await transaction(pool,async db=>{await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[run.id]);await admitProduced(db,run,stage,'requirements',store);});
  detail=await services.runs.detail(run.id);assert.equal(detail.requirements[0].review_status,'pending');assert.equal(detail.requirements[0].processing_status,'eligible');assert.equal(detail.reviews.length,0);
  const allowed=(await pool.query('SELECT research.artifact_eligible(run_id,review_status,processing_status) AS eligible FROM research.requirements WHERE run_id=$1',[run.id])).rows[0];assert.equal(allowed.eligible,true);
  assertEnvironmentGrant(detail.snapshot_data.workflow_policy.grant,receipt,'node-test/v2');assert.throws(()=>assertEnvironmentGrant(detail.snapshot_data.workflow_policy.grant,{...receipt,policy_sha256:'c'.repeat(64)},'node-test/v2'));
  await pool.query("UPDATE research.requirements SET review_status='rejected' WHERE run_id=$1",[run.id]);assert.equal((await pool.query('SELECT research.artifact_eligible(run_id,review_status,processing_status) AS eligible FROM research.requirements WHERE run_id=$1',[run.id])).rows[0].eligible,false);
}));
test('modo assistido não usa admissão automática nem exige saúde do executor na criação',{skip:!url},async()=>env(async({pool,store})=>{
  const services=scenarioServices(pool,store,{executorClient:{health:async()=>{throw new Error('Não consultar para modo assistido.');}}}),p=await project(services),run=await services.runs.create(p.project.id);await services.processor.processOne();const detail=await services.runs.detail(run.id);
  assert.equal(run.workflow_mode,'assisted/v1');await assert.rejects(transaction(pool,db=>admitProduced(db,run,detail.stages[0],'requirements',store)),/autorização/);
  assert.equal((await pool.query("SELECT research.artifact_eligible($1,'pending','eligible') AS eligible",[run.id])).rows[0].eligible,false);
}));
