import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import express from 'express';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrate} from '../../src/research/migrate.js';
import {createArtifactStore} from '../../src/research/artifacts.js';
import {scenarioServices} from '../../test-support/research-scenario.js';
const url=process.env.TEST_DATABASE_URL;if(url&&!new URL(url).pathname.startsWith('/tcc_test_'))throw new Error('Use banco tcc_test_.');
async function env(action){const pool=new pg.Pool({connectionString:url}),dir=await mkdtemp(join(tmpdir(),'timeline-')),store=createArtifactStore(dir);try{await migrate(pool);await action({pool,store});}finally{await pool.end();await rm(dir,{recursive:true,force:true});}}
async function prepare(pool,store,options={}){const services=scenarioServices(pool,store,options),project=await services.projects.create({name:'Histórico preservado',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'}),run=await services.runs.create(project.id);return {services,run};}
test('eventos paginados abrem versões preservadas após edição humana, com escopo e exportação',{skip:!url},()=>env(async({pool,store})=>{
  const {services,run}=await prepare(pool,store);await services.processor.processOne();
  await assert.rejects(services.runs.assess(run.id,{verdict:'correct',justification:'Ainda não terminou.'}),e=>e.statusCode===409);
  const detail=await services.runs.detail(run.id),req=detail.requirements[0],events=[];let after='0',page;
  do{page=await services.runs.events(run.id,{after,limit:2});events.push(...page.events);after=page.cursor;}while(page.has_more);
  assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.equal(page.history_mode,'recorded');
  const produced=events.find(e=>e.kind==='artifact_produced'),original=await services.runs.event(run.id,produced.id);
  assert.equal(original.data.artifacts[0].revision,0);assert.equal(original.data.artifacts[0].content.title,req.content.title);
  await services.runs.reviewItem(run.id,'requirements',req.id,{decision:'edited',revision:0,content:{...req.content,title:'Título humano posterior'},justification:'Teste da preservação histórica.'});
  assert.deepEqual(await services.runs.event(run.id,produced.id),original);
  const history=await services.runs.export(run.id),human=history.run_events.find(e=>e.kind==='human_review');assert.equal(human.detail.before.content.title,req.content.title);assert.equal(human.detail.after.content.title,'Título humano posterior');
  assert.ok(history.artifact_snapshots.some(s=>s.id===produced.snapshot_id));
  const other=await prepare(pool,store);await assert.rejects(services.runs.event(other.run.id,produced.id),e=>e.statusCode===404);await services.runs.cancel(other.run.id,{justification:'Finaliza fixture.'});
  await assert.rejects(services.runs.events(run.id,{after:'-1'}),e=>e.statusCode===422);await assert.rejects(services.runs.event(run.id,randomUUID()),e=>e.statusCode===404);
}));
test('histórico legado usa entradas e saídas originais, identificando ausência do ledger',{skip:!url},()=>env(async({pool,store})=>{
  const {services,run}=await prepare(pool,store);await services.processor.processOne();
  await pool.query('DELETE FROM research.run_events WHERE run_id=$1',[run.id]);
  const page=await services.runs.events(run.id);assert.equal(page.history_mode,'legacy');assert.ok(page.events.length>=2);assert.ok(page.events.every(e=>e.legacy));
  const output=page.events.find(e=>e.kind==='artifact_produced'),data=await services.runs.event(run.id,output.id);assert.ok(data.data.raw || data.data.output || data.data.requirements);
  assert.equal((await services.runs.events(run.id)).events[0].id,page.events[0].id);
}));
test('retentativa técnica conta uma repetição, sem criar conversa entre agentes',{skip:!url},()=>env(async({pool,store})=>{
  let shouldFail=true;const base=scenarioServices(pool,store),{services,run}=await prepare(pool,store,{generate:async request=>{if(shouldFail)throw new Error('Falha temporária da fixture');return base.generate(request);}});
  await services.processor.processOne();shouldFail=false;await services.runs.retry(run.id,{justification:'Repetição explícita de controle.'});await services.processor.processOne();
  const page=await services.runs.events(run.id);assert.equal(page.summary.technical_retries,1);assert.equal(page.summary.requests,0);assert.equal(page.summary.completed_cycles,0);assert.ok(page.events.some(e=>e.kind==='attempt_failed'));
}));
test('stream entrega eventos novos, retoma pelo cursor e encerra ao cancelar',{skip:!url},()=>env(async({pool,store})=>{
  const {services,run}=await prepare(pool,store),app=express();app.get('/events',(req,res,next)=>services.runs.streamEvents(req,res,run.id).catch(next));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const controllers=[];async function connect(after='0'){const controller=new AbortController();controllers.push(controller);const response=await fetch(`http://127.0.0.1:${server.address().port}/events?after=${after}`,{signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader();let pending='';return {controller,async until(kind){const events=[];const timer=setTimeout(()=>controller.abort(),8000);try{while(true){const {value,done}=await reader.read();if(done)return events;pending+=new TextDecoder().decode(value);let end;while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);const name=block.match(/^event: (.+)$/m)?.[1],text=block.match(/^data: (.+)$/m)?.[1];if(name&&text){events.push({name,data:JSON.parse(text)});if(name===kind)return events;}}}}finally{clearTimeout(timer);}}};}
  try{const first=await connect(),initial=await first.until('state'),cursor=initial.find(e=>e.name==='run_event').data.sequence;await services.processor.processOne();const live=await first.until('state');assert.ok(live.some(e=>e.name==='run_event'&&e.data.kind==='artifact_produced'));first.controller.abort();
    await services.runs.cancel(run.id,{justification:'Encerra o stream de controle.'});const second=await connect(cursor),remaining=await second.until('settled');assert.ok(remaining.some(e=>e.data.kind==='run_cancelled'));assert.ok(remaining.filter(e=>e.name==='run_event').every(e=>BigInt(e.data.sequence)>BigInt(cursor)));
  }finally{for(const controller of controllers)controller.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}));
