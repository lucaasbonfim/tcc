import test from 'node:test';
import assert from 'node:assert/strict';
import {citationRequest} from '../src/research/agents/requirements/citations.js';
import {requirementsOutputSchema} from '../src/research/agents/requirements/contracts.js';
import {createRequirementsAgentTools} from '../src/research/agents/requirements/tools.js';
function requirementFixture(source_id){return {code:'RF-001',title:'Somar',description:'O sistema deve somar dois números.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{source_id}]};}
test('A1 exige consulta de todas as fontes e mantém referências literais resolvíveis',async()=>{
  const prepared=citationRequest({documents:[{id:'doc',name:'Regras',pages:[{page:1,text:'O sistema deve somar dois números. '.repeat(50)}]}]},requirementsOutputSchema);
  const tools=createRequirementsAgentTools(prepared),ids=prepared.input.source_catalog.map(s=>s.source_id);
  let n=0;const call=(name,args)=>tools.execute({id:String(++n),name,args});
  const output={requirements:[requirementFixture(ids[0])],alerts:[]};
  await assert.rejects(call('submit_requirements',{output}),/Consulte todos/);
  await assert.rejects(call('read_document_sources',{source_ids:['foreign']}),/fora da tarefa/);
  await assert.rejects(call('shell',{}),/não permitida/);
  const first=await call('read_document_sources',{source_ids:[ids[0]]});
  const resumed=createRequirementsAgentTools(prepared);await resumed.restore(first.state);
  const remaining=ids.slice(1);
  if(remaining.length)await resumed.execute({id:'rest',name:'read_document_sources',args:{source_ids:remaining}});
  const result=await resumed.execute({id:'submit',name:'submit_requirements',args:{output}});
  assert.equal(result.observation.requires_human_review,true);assert.deepEqual(result.terminal.output,output);
  assert.ok(result.terminal.output.requirements[0].sources[0].source_id);
});
test('lotes de consulta devolvem pendências explícitas sem contar fonte truncada como lida',async()=>{
  const prepared=citationRequest({documents:[{id:'doc',name:'Regras',pages:[{page:1,text:'O sistema deve somar dois números. '.repeat(100)}]}]},requirementsOutputSchema);
  const tools=createRequirementsAgentTools({...prepared,maxObservationChars:1000}),ids=prepared.input.source_catalog.map(s=>s.source_id);
  const response=await tools.execute({id:'read',name:'read_document_sources',args:{source_ids:ids.slice(0,5)}});
  assert.ok(response.observation.remaining_source_ids.length>0);
  assert.equal(response.state.read_source_ids.length,response.observation.sources.length);
  assert.ok(JSON.stringify(response.observation).length<=1000);
});
