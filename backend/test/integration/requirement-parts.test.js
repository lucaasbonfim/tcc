import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {createProcessor} from '../../src/research/processor.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
test('documento acima de 100 mil caracteres retoma partes sem repetir checkpoints concluídos', {skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-parts-')),store=createArtifactStore(directory);
  try {
    await migrate(pool);
    const services=scenarioServices(pool,store);
    const project=await services.projects.create({name:'Documento extenso',repository_url:'https://github.com/example/repo',requested_ref:'main'});
    const long='O sistema deve somar dois números. Informação complementar.\n'.repeat(2400);
    await services.projects.addDocument(project.id,Buffer.from(long),'longo.txt','text/plain');
    const run=await services.runs.create(project.id),calls=new Map();let fail=true;
    const generate=async request=>{
      const seq=request.input.part.sequence;calls.set(seq,(calls.get(seq)||0)+1);
      if(seq===2 && fail){fail=false;return {raw:'invalid-json',metadata:{fixture:true}};}
      return {raw:JSON.stringify({requirements:[{code:'RF-001',title:'Somar',description:'O sistema deve somar dois números.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{source_id:request.input.source_catalog[0].source_id}]}],alerts:[]}),metadata:{fixture:true}};
    };
    const processor=createProcessor({pool,store,generate});
    await processor.processOne();await processor.processOne();
    let detail=await services.runs.detail(run.id);
    assert.equal(detail.status,'failed');assert.equal(detail.requirement_parts[0].status,'completed');
    await services.runs.retry(run.id,{justification:'Retomar mantendo partes já processadas.'});
    for(let i=0;i<100;i++){detail=await services.runs.detail(run.id);if(detail.status!=='pending')break;await processor.processOne();}
    detail=await services.runs.detail(run.id);
    assert.equal(detail.status,'awaiting_review');
    assert.equal(calls.get(1),1);assert.equal(calls.get(2),2);
    assert.ok(detail.requirement_parts.length>3 && detail.requirement_parts.every(p=>p.status==='completed'));
    assert.ok(detail.requirements.length>=1 && detail.requirements.every(req=>req.content.description==='O sistema deve somar dois números.'));assert.equal(detail.requirements[0].code,'RF-0001');
    assert.equal(detail.consolidation_data.mapping.length,detail.requirement_parts.length);
    await services.runs.cancel(run.id,{justification:'Encerrar fixture de processamento extenso.'});
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});

test('continuação preserva snapshot e checkpoints após esgotar tentativas, sem duplicar chamadas', {skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-resume-')),store=createArtifactStore(directory);
  try {
    await migrate(pool);
    const services=scenarioServices(pool,store);
    const project=await services.projects.create({name:'Retomar PDF',repository_url:'https://github.com/example/repo',requested_ref:'main'});
    await services.projects.addDocument(project.id,Buffer.from('O sistema deve somar dois números. Texto de contexto.\n'.repeat(900)),'requisitos.txt','text/plain');
    const original=await services.runs.create(project.id);let failing=true,firstCalls=0;
    const processor=createProcessor({pool,store,generate:async request=>{
      if(request.input.part.sequence===1)firstCalls++;
      if(failing && request.input.part.sequence===2)return {raw:'{"requirements":',metadata:{finish_reasons:['MAX_TOKENS']}};
      return services.generate(request);
    }});
    await processor.processOne();await processor.processOne();
    for(let i=0;i<2;i++){await services.runs.retry(original.id,{justification:'Repetição técnica da fixture.'});await processor.processOne();}
    const before=await services.runs.detail(original.id);
    assert.equal(before.stages[0].attempt_count,3);assert.match(before.stages[0].message,/limite de saída/);
    await assert.rejects(services.runs.retry(original.id,{justification:'Quarta chamada no mesmo limite.'}),/três/);
    await services.projects.update(project.id,{name:'Alterado depois',repository_url:project.repository_url,requested_ref:'new-ref',complementary_text:'Texto posterior que não pode entrar na continuação.'});
    const next=await services.runs.resume(original.id,{justification:'Continuar das partes válidas após correção do contrato.'});
    assert.notEqual(next.id,original.id);assert.equal(next.resumed_from_run_id,original.id);assert.equal(next.code_version_id,original.code_version_id);assert.equal(next.reused_parts,1);
    await assert.rejects(services.runs.resume(original.id,{justification:'Duplicar continuação ativa.'}),/outra execução/);
    failing=false;
    for(let i=0;i<60;i++){const detail=await services.runs.detail(next.id);if(detail.status!=='pending')break;await processor.processOne();}
    const after=await services.runs.export(next.id);
    assert.equal(after.status,'awaiting_review');assert.equal(firstCalls,1);
    assert.equal(after.snapshot_data.project.name,'Retomar PDF');assert.equal(after.snapshot_data.project.complementary_text,'');
    assert.equal(after.requirement_parts[0].reused_from_part_id,before.requirement_parts[0].id);
    assert.ok(after.requirement_parts[0].reused_attempts[0].output_data.raw);
    assert.ok(after.requirement_parts.slice(1).every(p=>p.character_count<=8600));
    assert.equal((await services.runs.detail(original.id)).attempts.length,before.attempts.length);
    assert.equal((await services.runs.detail(original.id)).status,'failed');
    await services.runs.cancel(next.id,{justification:'Encerrar fixture.'});
  } finally {await pool.end();await rm(directory,{recursive:true,force:true});}
});
