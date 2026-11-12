import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/storage/artifacts.js';
import {createProjectService} from '../../src/research/services/projects.js';
import {inspectRepository} from '../../src/research/sources/inspection.js';
import {repositoryFixture} from '../../test-support/repository-fixture.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
import {createAutomationService} from '../../src/research/services/automation.js';
import {generatedPath} from '../../src/research/agents/tests/scripts/contracts.js';
import {createExecutionService} from '../../src/research/services/execution.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
const bulk={approve_pending:true,justification:'Fixture de módulo inteiro.'};
const items=rows=>rows.map(({id,revision})=>({id,revision}));

test('módulo inteiro considera próximos escopos antes da impossibilidade e mantém origem para revisão/execução',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-module-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const sources=Object.fromEntries(Array.from({length:9},(_,i)=>[`src/f${i}.js`,`export function f${i}(){return ${i};}`]));
    const repository=repositoryFixture({'package.json':'{"type":"module"}',...sources}),version={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)};
    const projects=createProjectService({pool,store,resolveCode:async(repository_url,requested_ref)=>({...version,repository_url,requested_ref,inspection:{}}),inspectCode:version=>inspectRepository(version,repository.fetch)});
    const base=scenarioServices(pool,store),project=await projects.create({name:'Módulo inteiro',repository_url:version.repository_url,requested_ref:'main',complementary_text:'O sistema deve somar dois números.'}),run=await base.runs.create(project.id);
    await base.processor.processOne();let detail=await base.runs.detail(run.id);await base.runs.approveStage(run.id,'requirements',{...bulk,items:items(detail.requirements)});await base.processor.processOne();detail=await base.runs.detail(run.id);await base.runs.approveStage(run.id,'tests',{...bulk,items:items(detail.test_cases)});
    const inspection=await projects.inspect(project.id,run.code_version_id);assert.equal(inspection.modules[0].automation_plan.scope_count,2);
    const automation=createAutomationService({pool,store}),queued=await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',justification:'Usar o módulo inteiro, sem seleção de arquivos.'});assert.equal(queued.source_scopes,2);
    const seen=[];const services=scenarioServices(pool,store,{generate:async request=>{
      seen.push(request.input.scope_route.index);const row=request.input.test_cases[0],scope=request.input.scope;
      if(request.input.scope_route.index===0)return {raw:JSON.stringify({artifacts:[],unsupported_cases:[{test_case_id:row.id,reason:'Operação não está neste primeiro escopo.'}],warnings:[]}),metadata:{fixture:true}};
      const path=scope.target_paths[0],symbol=scope.files.find(file=>file.path===path).symbols.exports[0];
      return {raw:JSON.stringify({artifacts:[{test_case_id:row.id,requirement_codes:['RF-001'],adapter:'node-test/v2',commit_sha:version.commit_sha,files:[{path:generatedPath(row.id,'node-test/v2').path,code:`import test from 'node:test';import assert from 'node:assert/strict';import {${symbol}} from '../${path}';test('real',()=>assert.equal(${symbol}(),8));`}],targets:[{path,symbols:[symbol]}],rationale:'Confere alvo real do segundo escopo.',expected_result:row.content.expected_result,expected_sources:[{requirement_code:'RF-001',quote:'somar dois números'}],limitations:['Fixture técnica.']}],unsupported_cases:[],warnings:[]}),metadata:{fixture:true}};
    }});
    await services.processor.processOne();detail=await base.runs.detail(run.id);assert.equal(detail.status,'pending');assert.equal(detail.automation_parts[0].dispositions[0].status,'deferred');assert.equal(detail.automation_coverage.unsupported.length,0);assert.equal(detail.automation_coverage.missing.length,1);
    await services.processor.processOne();detail=await base.runs.detail(run.id);assert.deepEqual(seen,[0,1]);assert.equal(detail.status,'awaiting_review');assert.equal(detail.automated_tests.length,1);assert.equal(detail.automation_coverage.missing.length,0);
    const script=detail.automated_tests[0];await automation.review(run.id,script.id,{decision:'edited',revision:0,files:script.files_data,justification:'Validar contra fontes do segundo escopo.'});
    await automation.approve(run.id,{...bulk,revisions:{[script.id]:1}});
    const receipt={ready:true,deployment_id:'module-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
    await createExecutionService({pool,store,client:{health:async()=>receipt}}).authorize(run.id,{justification:'Conferir bundle sem executar código.'});detail=await base.runs.detail(run.id);const bundle=await store.json(detail.execution_jobs[0].bundle);assert(bundle.source_files.some(file=>file.path==='src/f8.js'));assert.equal(bundle.source_files.length,2);
    const exported=await base.runs.export(run.id),stage=exported.stages.find(stage=>stage.agent==='automation');assert.equal(stage.scope_data.length,2);assert.equal(stage.inspection_data.files.length,10);assert.equal(exported.automation_parts.length,2);
    await base.runs.cancel(run.id,{justification:'Encerrar fixture sem execução real.'});
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});
