import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {createAutomationService} from '../../src/research/automation.js';
import {generatedPath} from '../../src/research/automation-contract.js';
import {scenarioServices,textualScenario} from '../../test-support/research-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');

test('falha de um script mantém o outro; repetição envia somente o caso inválido e o erro anterior',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-auto-subset-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const base=scenarioServices(pool,store),{run,inspection}=await textualScenario(base);
    const original=(await base.runs.detail(run.id)).test_cases[0],secondId=randomUUID();
    await pool.query("INSERT INTO research.test_cases(id,run_id,code,content,review_status) VALUES($1,$2,'CT-002',$3,'approved')",[secondId,run.id,JSON.stringify({...original.content,code:'CT-002'})]);
    await createAutomationService({pool,store}).start(run.id,{inspection_id:inspection.inspection_id,module_root:'',justification:'Fixture com um script inválido.'});
    let calls=0;
    const services=scenarioServices(pool,store,{generate:async request=>{
      const result=await base.generate(request),output=JSON.parse(result.raw);calls++;
      output.artifacts=request.input.test_cases.map(row=>({...output.artifacts[0],test_case_id:row.id,files:[{...output.artifacts[0].files[0],path:generatedPath(row.id,'node-test/v2').path}]}));
      if(calls===1)output.artifacts.find(row=>row.test_case_id===secondId).expected_result='Esperado inventado.';
      else{assert.deepEqual(request.input.test_cases.map(row=>row.id),[secondId]);assert.match(request.input.previous_generation_error,/CT-002.*preservar/);}
      return {...result,raw:JSON.stringify(output)};
    }});
    await services.processor.processOne();let detail=await base.runs.detail(run.id);
    assert.equal(detail.status,'failed');assert.equal(detail.automated_tests.length,1);assert.equal(detail.automation_coverage.generated,1);
    const first=detail.automated_tests[0],failed=detail.attempts.at(-1),preserved=await store.json(failed.output);
    assert.match(preserved.raw,/Esperado inventado/);assert.equal(preserved.validated_output.artifacts.length,1);assert.equal(preserved.validation_errors.length,1);
    await base.runs.retry(run.id,{justification:'Corrigir apenas o artefato com erro.'});await services.processor.processOne();detail=await base.runs.detail(run.id);
    assert.equal(detail.status,'awaiting_review');assert.equal(detail.automated_tests.length,2);assert.equal(detail.automated_tests.find(row=>row.id===first.id).generation_attempt_id,first.generation_attempt_id);
    assert.deepEqual(detail.automation_coverage.missing,[]);assert.equal(detail.automation_parts[0].dispositions.length,2);
    assert.equal(detail.attempts.find(row=>row.id===failed.id).status,'failed');assert.equal(calls,2);
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});

test('104 cenários geram lotes retomáveis, sem omissões e com revisão única atômica dos scripts',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-auto-parts-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const base=scenarioServices(pool,store),{run,inspection}=await textualScenario(base),automation=createAutomationService({pool,store});
    const original=(await base.runs.detail(run.id)).test_cases[0];
    for(let i=2;i<=104;i++){
      const id=randomUUID(),code=`CT-${String(i).padStart(3,'0')}`;
      await pool.query("INSERT INTO research.test_cases(id,run_id,code,content,review_status) VALUES($1,$2,$3,$4,'approved')",[id,run.id,code,JSON.stringify({...original.content,code})]);
      await pool.query('INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id) SELECT $1,$2,id FROM research.requirements WHERE run_id=$1',[run.id,id]);
    }
    const context={inspection_id:inspection.inspection_id,module_root:'',target_paths:['src/calc.js'],justification:'Todos os cenários da fixture.'};
    await assert.rejects(automation.start(run.id,{...context,test_case_ids:[randomUUID()]}),/não aprovado/);
    const queued=await automation.start(run.id,context);assert.equal(queued.selected_cases,104);assert.equal(queued.parts,52);
    let fail=true;const calls=new Map();
    const services=scenarioServices(pool,store,{generate:async request=>{
      const response=await base.generate(request),output=JSON.parse(response.raw),sequence=request.input.batch.sequence;calls.set(sequence,(calls.get(sequence)||0)+1);
      assert(request.input.test_cases.length<=2);assert.equal(request.input.requirements.length,1);
      output.artifacts=request.input.test_cases.map(row=>({...output.artifacts[0],test_case_id:row.id,expected_result:row.content.expected_result,files:output.artifacts[0].files.map(file=>({...file,path:generatedPath(row.id,'node-test/v2').path}))}));
      if(sequence===2 && fail){fail=false;output.artifacts.pop();}
      if(sequence===52){output.unsupported_cases=request.input.test_cases.map(row=>({test_case_id:row.id,reason:'Caso fora do escopo técnico desta fixture.'}));output.artifacts=[];}
      return {...response,raw:JSON.stringify(output)};
    }});
    await services.processor.processOne();await services.processor.processOne();let detail=await base.runs.detail(run.id);
    assert.equal(detail.status,'failed');assert.equal(detail.automated_tests.length,2);assert.match(detail.automation_parts[1].error,/Cada caso/);assert.equal(detail.automation_coverage.missing.length,102);
    await base.runs.retry(run.id,{justification:'Repetir somente lote falho.'});for(let i=0;i<51;i++)await services.processor.processOne();
    detail=await base.runs.detail(run.id);assert.equal(detail.status,'awaiting_review');assert.equal(detail.automated_tests.length,102);assert.equal(detail.automation_parts.filter(p=>p.status==='completed').length,52);assert.equal(calls.get(1),1);assert.equal(calls.get(2),2);assert.deepEqual(detail.automation_coverage.missing,[]);assert.equal(detail.agent_outputs.automation.unsupported_cases.length,2);assert.equal(detail.agent_outputs.automation.artifacts.length,102);
    const before=detail.automated_tests,first=before[0],last=before.at(-1),stale=Object.fromEntries(before.map(row=>[row.id,row.revision]));
    const files=first.files_data.map(file=>({...file,code:file.code.replace("test('soma'","test('soma revisada'")}));
    await automation.review(run.id,first.id,{decision:'edited',revision:0,files,justification:'Correção independente.'});
    assert.equal((await automation.list(run.id)).find(s=>s.id===first.id).review_status,'pending');
    await assert.rejects(automation.approve(run.id,{approve_pending:true,revisions:stale,justification:'Dados obsoletos.'}),/outra revisão/);
    await automation.review(run.id,last.id,{decision:'rejected',revision:0,justification:'Exclusão técnica da fixture.'});
    const updated=await automation.list(run.id),revisions=Object.fromEntries(updated.map(row=>[row.id,row.revision]));
    const bad=updated[1],invalid=await store.put(bad.files_data.map(file=>({...file,code:'invalid JavaScript {'})));
    await pool.query('UPDATE research.automated_tests SET files=$2 WHERE id=$1',[bad.id,invalid]);
    await assert.rejects(automation.approve(run.id,{approve_pending:true,revisions,justification:'Precisa reverter tudo.'}),/sintaxe/);assert.equal((await automation.list(run.id)).filter(row=>row.review_status==='approved').length,0);
    await pool.query('UPDATE research.automated_tests SET files=$2 WHERE id=$1',[bad.id,bad.files]);
    const results=await Promise.allSettled([automation.approve(run.id,{approve_pending:true,revisions,justification:'Aprovação em lote.'}),automation.approve(run.id,{approve_pending:true,revisions,justification:'Requisição simultânea.'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const exported=await base.runs.export(run.id);assert.equal(exported.status,'completed');assert.equal(exported.automated_tests.filter(row=>row.review_status==='approved').length,101);assert.equal(exported.automated_tests.filter(row=>row.review_status==='rejected').length,1);assert(exported.automation_parts.every(part=>part.input_data && part.output_data));assert(exported.reviews.some(row=>row.entity_type==='automated_test' && row.decision==='edited' && row.before_files_data && row.after_files_data));assert.equal(exported.execution_jobs.length,0);
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});

test('lote sem script não encerra a geração cedo; cancelamento mantém checkpoints e saída tardia',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-auto-cancel-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const base=scenarioServices(pool,store),{run,inspection}=await textualScenario(base),original=(await base.runs.detail(run.id)).test_cases[0];
    for(let i=2;i<=3;i++)await pool.query("INSERT INTO research.test_cases(id,run_id,code,content,review_status) VALUES($1,$2,$3,$4,'approved')",[randomUUID(),run.id,`CT-${i}`,JSON.stringify({...original.content,code:`CT-${i}`})]);
    const automation=createAutomationService({pool,store});await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',target_paths:['src/calc.js'],justification:'Fixture de cancelamento.'});
    const unsupported=async request=>({raw:JSON.stringify({artifacts:[],unsupported_cases:request.input.test_cases.map(row=>({test_case_id:row.id,reason:'Impossibilidade técnica na fixture.'})),warnings:[]}),metadata:{fixture:true}});
    await scenarioServices(pool,store,{generate:unsupported}).processor.processOne();assert.equal((await base.runs.detail(run.id)).status,'pending');
    let release,started;const ready=new Promise(resolve=>{started=resolve;});const delayed=scenarioServices(pool,store,{generate:async request=>{started();await new Promise(resolve=>{release=resolve;});return unsupported(request);}});
    const processing=delayed.processor.processOne();await ready;await base.runs.cancel(run.id,{justification:'Cancelar geração da fixture.'});release();await processing;
    const detail=await base.runs.detail(run.id);assert.equal(detail.status,'cancelled');assert.equal(detail.automation_parts[0].status,'completed');assert.equal(detail.automation_parts[1].status,'cancelled');assert(detail.attempts.at(-1).output);assert.equal(detail.automation_coverage.unsupported.length,2);assert.equal(detail.automation_coverage.missing.length,1);
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});
