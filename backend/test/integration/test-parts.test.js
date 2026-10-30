import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
const items=rows=>rows.map(({id,revision})=>({id,revision}));
const bulk={approve_pending:true,justification:'Aprovação técnica da fixture de cobertura.'};

test('geração em lotes rejeita omissões/MAX_TOKENS, retoma checkpoints e completa vínculos após rejeição humana',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-test-parts-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const base=scenarioServices(pool,store),calls=new Map();let failures=0;
    const services=scenarioServices(pool,store,{generate:async request=>{
      const response=await base.generate(request),output=JSON.parse(response.raw);
      if(output.requirements)output.requirements=Array.from({length:12},(_,i)=>({...output.requirements[0],code:`RF-${String(i+1).padStart(3,'0')}`,title:`Regra ${i+1}`}));
      else {
        const seq=request.input.batch.sequence;calls.set(seq,(calls.get(seq)||0)+1);
        assert.equal(request.input.code_version.inspection,undefined);
        output.test_cases=request.input.requirements.flatMap((requirement,i)=>['positive','negative'].map((scenario,j)=>({...output.test_cases[0],code:`CT-${i*2+j+1}`,scenario,requirement_codes:[requirement.code]})));
        if(seq===2 && failures++===0)output.test_cases=output.test_cases.slice(0,-2);
        else if(seq===2 && failures===2)return {raw:'{"test_cases":[',metadata:{finish_reasons:['MAX_TOKENS'],usage:{candidatesTokenCount:8192}}};
      }
      return {...response,raw:JSON.stringify(output)};
    }});
    const {projects,runs,processor}=services;
    const project=await projects.create({name:'Casos extensos',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
    const run=await runs.create(project.id);await processor.processOne();let detail=await runs.detail(run.id);
    await runs.approveStage(run.id,'requirements',{...bulk,items:items(detail.requirements)});
    detail=await runs.detail(run.id);assert.equal(detail.test_parts.length,3);
    await processor.processOne();await processor.processOne();detail=await runs.detail(run.id);
    assert.equal(detail.status,'failed');assert.match(detail.test_parts[1].error,/sem caso/);assert.equal(detail.test_cases.length,8);assert.equal(detail.test_coverage.linked,4);
    const omitted=detail.attempts.at(-1);assert.equal(JSON.parse((await runs.artifact(run.id,omitted.id,'output')).raw).test_cases.length,6);
    await runs.retry(run.id,{justification:'Repetir lote omitido, preservando o primeiro.'});await processor.processOne();detail=await runs.detail(run.id);
    assert.match(detail.test_parts[1].error,/limite de saída/);assert.equal((await runs.artifact(run.id,detail.attempts.at(-1).id,'output')).raw,'{"test_cases":[');
    await runs.retry(run.id,{justification:'Última sessão explícita da fixture.'});await processor.processOne();await processor.processOne();detail=await runs.detail(run.id);
    assert.equal(detail.status,'awaiting_review');assert.equal(detail.test_coverage.linked,12);assert.equal(detail.test_cases.length,24);assert.equal(calls.get(1),1);assert.equal(calls.get(2),3);assert.equal(new Set(detail.test_cases.map(row=>row.code)).size,24);
    assert(detail.test_parts.every(part=>part.mapping.length===8));const preserved=detail.attempts.map(a=>({id:a.id,output:a.output}));
    for(const row of detail.test_cases.filter(row=>row.content.requirement_codes.includes('RF-012')))await runs.reviewItem(run.id,'tests',row.id,{decision:'rejected',revision:0,justification:'Cenário precisa ser refeito na fixture.'});
    detail=await runs.detail(run.id);await assert.rejects(runs.approveStage(run.id,'tests',{...bulk,items:items(detail.test_cases)}),/sem caso aprovado/);
    assert.equal((await runs.detail(run.id)).test_cases.filter(row=>row.review_status==='approved').length,0);
    const queued=await runs.completeTests(run.id,{justification:'Completar somente RF-012 sem apagar casos rejeitados.'});assert.equal(queued.requirements,1);
    await assert.rejects(runs.completeTests(run.id,{justification:'Não duplicar fila ativa.'}),/Aguarde/);
    await processor.processOne();detail=await runs.detail(run.id);assert.equal(detail.test_coverage.linked,12);assert.equal(detail.test_cases.length,26);assert.equal(detail.test_parts.length,4);assert.equal(calls.get(1),1);
    assert.deepEqual(detail.attempts.slice(0,preserved.length).map(a=>({id:a.id,output:a.output})),preserved);
    await runs.approveStage(run.id,'tests',{...bulk,items:items(detail.test_cases)});
    const exported=await runs.export(run.id);assert.equal(exported.test_coverage.approved_linked,12);assert.equal(exported.status,'completed');assert(exported.test_parts.every(part=>part.input_data && part.output_data));assert.equal(exported.test_cases.filter(row=>row.review_status==='rejected').length,2);
    await assert.rejects(runs.completeTests(run.id,{justification:'Nada restante.'}),/já possuem/);
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});

test('legado incompleto é bloqueado e complementado sem apagar respostas; cancelamento preserva saída tardia',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-legacy-tests-')),store=createArtifactStore(directory);
  try{
    await migrate(pool);const base=scenarioServices(pool,store),{projects,runs}=base;
    const project=await projects.create({name:'Legado com omissões',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
    const run=await runs.create(project.id);await base.processor.processOne();let detail=await runs.detail(run.id);
    await runs.approveStage(run.id,'requirements',{...bulk,items:items(detail.requirements)});await base.processor.processOne();detail=await runs.detail(run.id);
    const original=detail.test_cases[0],attempts=detail.attempts.map(a=>a.id),requirement=detail.requirements[0];
    // Reproduz em banco de teste o legado que aceitava resposta parcial como concluída.
    await pool.query("INSERT INTO research.requirements(id,run_id,code,content,review_status) VALUES($1,$2,'RF-002',$3,'approved')",[randomUUID(),run.id,JSON.stringify({...requirement.content,code:'RF-002'})]);
    detail=await runs.detail(run.id);await assert.rejects(runs.approveStage(run.id,'tests',{...bulk,items:items(detail.test_cases)}),/sem caso aprovado/);
    await runs.completeTests(run.id,{justification:'Complementar legado sem cenário.'});
    let release,started;const ready=new Promise(resolve=>{started=resolve;});
    const delayed=scenarioServices(pool,store,{generate:async request=>{started();await new Promise(resolve=>{release=resolve;});const response=await base.generate(request),out=JSON.parse(response.raw);out.test_cases[0].requirement_codes=request.input.requirements.map(r=>r.code);return {...response,raw:JSON.stringify(out)};}});
    const processing=delayed.processor.processOne();await ready;await runs.cancel(run.id,{justification:'Cancelar chamada em andamento da fixture.'});release();await processing;
    detail=await runs.detail(run.id);assert.equal(detail.status,'cancelled');assert.equal(detail.test_cases.length,1);assert.deepEqual(detail.test_cases[0],original);assert(detail.attempts.at(-1).output);assert.equal(detail.attempts.at(-1).status,'interrupted');assert(detail.test_parts.some(part=>part.status==='cancelled'));assert.deepEqual(detail.attempts.slice(0,attempts.length).map(a=>a.id),attempts);
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});
