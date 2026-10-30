import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';

const url=process.env.TEST_DATABASE_URL;
if(url && !new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
const revisions=rows=>rows.map(({id,revision})=>({id,revision}));

test('aprovação em lote preserva correções/rejeições, é atômica e avança requisitos/casos uma única vez',{skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url}),directory=await mkdtemp(join(tmpdir(),'tcc-bulk-')),store=createArtifactStore(directory);
  try {
    await migrate(pool);
    const base=scenarioServices(pool,store);
    const services=scenarioServices(pool,store,{generate:async request=>{
      const response=await base.generate(request),output=JSON.parse(response.raw);
      if(output.requirements)output.requirements=Array.from({length:4},(_,i)=>({...output.requirements[0],code:`RF-00${i+1}`,title:`Requisito ${i+1}`}));
      else output.test_cases=request.input.requirements.map((requirement,i)=>({...output.test_cases[0],code:`CT-00${i+1}`,title:`Caso ${i+1}`,requirement_codes:[requirement.code]}));
      return {...response,raw:JSON.stringify(output)};
    }});
    const {projects,runs,processor}=services;
    const project=await projects.create({name:'Revisão em lote',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
    const run=await runs.create(project.id);await processor.processOne();
    let detail=await runs.detail(run.id),[first,second,third,last]=detail.requirements;
    const stale=revisions(detail.requirements);
    await runs.reviewItem(run.id,'requirements',first.id,{decision:'edited',revision:0,justification:'Correção sem aprovação.',content:{...first.content,title:'Título corrigido'}});
    detail=await runs.detail(run.id);assert.equal(detail.requirements[0].review_status,'pending');assert.equal(detail.reviews[0].decision,'edited');assert.equal(detail.stages[0].status,'awaiting_review');
    await runs.reviewItem(run.id,'requirements',second.id,{decision:'rejected',revision:0,justification:'Excluído da análise.'});
    await runs.reviewItem(run.id,'requirements',third.id,{decision:'approved',revision:0,justification:'Aprovação anterior preservada.'});
    const bulk={approve_pending:true,justification:'Aprovação em lote da fixture.'};
    await assert.rejects(runs.approveStage(run.id,'requirements',{...bulk,items:stale}),/outra revisão/);
    detail=await runs.detail(run.id);const items=revisions(detail.requirements);
    await assert.rejects(runs.approveStage(run.id,'requirements',{...bulk,items:items.slice(1)}),/Lista de itens/);
    await pool.query("UPDATE research.requirements SET content=jsonb_set(content,'{sources}','[]'::jsonb) WHERE id=$1",[last.id]);
    await assert.rejects(runs.approveStage(run.id,'requirements',{...bulk,items}));
    const unchanged=await runs.detail(run.id);assert.equal(unchanged.requirements[0].review_status,'pending');assert.equal(unchanged.reviews.length,3);assert.equal(unchanged.status,'awaiting_review');
    await pool.query('UPDATE research.requirements SET content=$2 WHERE id=$1',[last.id,JSON.stringify(last.content)]);
    const concurrent=await Promise.allSettled([runs.approveStage(run.id,'requirements',{...bulk,items}),runs.approveStage(run.id,'requirements',{...bulk,items})]);
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.filter(r=>r.status==='rejected')[0].reason.statusCode,409);
    detail=await runs.detail(run.id);assert.equal(detail.status,'pending');assert.equal(detail.requirements[0].content.title,'Título corrigido');assert.deepEqual(detail.requirements.map(r=>r.review_status),['approved','rejected','approved','approved']);assert.equal(detail.requirements[2].revision,1);
    assert.equal(detail.reviews.filter(r=>r.entity_type==='requirement' && r.decision==='approved').length,3);
    assert.equal(detail.reviews.find(r=>r.entity_type==='stage').after_value.approval_mode,'bulk');
    await processor.processOne();detail=await runs.detail(run.id);const [caseRow,rejectedCase]=detail.test_cases;
    await runs.reviewItem(run.id,'tests',caseRow.id,{decision:'edited',revision:0,justification:'Corrigir caso sem aprovar.',content:{...caseRow.content,title:'Caso corrigido',requirement_codes:['RF-001','RF-003']}});
    await runs.reviewItem(run.id,'tests',rejectedCase.id,{decision:'rejected',revision:0,justification:'Caso excluído.'});
    detail=await runs.detail(run.id);await runs.approveStage(run.id,'tests',{...bulk,items:revisions(detail.test_cases)});
    const exported=await runs.export(run.id);assert.equal(exported.status,'completed');assert.equal(exported.test_cases[0].content.title,'Caso corrigido');assert.deepEqual(exported.test_cases.map(r=>r.review_status),['approved','rejected','approved']);
    assert(exported.traceability.some(link=>link.test_case_id===caseRow.id && link.requirement_id===third.id));
    assert(exported.reviews.some(r=>r.decision==='edited' && r.before_value.content.title==='Caso 1' && r.after_value.content.title==='Caso corrigido'));
    await assert.rejects(runs.approveStage(run.id,'tests',{...bulk,items:revisions(exported.test_cases)}),/não aguarda/);
    const emptyRun=await runs.create(project.id);await processor.processOne();detail=await runs.detail(emptyRun.id);
    for(const row of detail.requirements)await runs.reviewItem(emptyRun.id,'requirements',row.id,{decision:'rejected',revision:0,justification:'Nenhum requisito aceito.'});
    detail=await runs.detail(emptyRun.id);await assert.rejects(runs.approveStage(emptyRun.id,'requirements',{...bulk,items:revisions(detail.requirements)}),/pelo menos um/);
    assert.equal((await runs.detail(emptyRun.id)).status,'awaiting_review');await runs.cancel(emptyRun.id,{justification:'Encerrar fixture.'});
  }finally{await pool.end();await rm(directory,{recursive:true,force:true});}
});
