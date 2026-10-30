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
      return {raw:JSON.stringify({requirements:[{code:'RF-001',title:'Somar',description:'O sistema deve somar dois números.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:request.input.documents[0].id,page:1,quote:'somar dois números'}]}],alerts:[]}),metadata:{fixture:true}};
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
    assert.equal(detail.requirements.length,1);assert.equal(detail.requirements[0].code,'RF-0001');
    assert.equal(detail.consolidation_data.mapping.length,detail.requirement_parts.length);
    await services.runs.cancel(run.id,{justification:'Encerrar fixture de processamento extenso.'});
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});
