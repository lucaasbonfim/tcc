import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestsAgentTools} from '../src/research/agents/tests/cases/tools.js';
const requirement=code=>({code,title:'Somar',description:'O sistema deve somar dois números.',acceptance_criteria:[],sources:[]});
const scenario=code=>({code:`CT-${code.slice(3)}`,title:'Somar',objective:'Verificar soma.',requirement_codes:[code],preconditions:[],input_data:['2, 3'],steps:['Somar os valores.'],expected_result:'Retorna 5.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Necessário inspecionar.'}});
test('A2 textual exige leitura e todos os vínculos, sem ferramentas de código ou requisitos externos',async()=>{
  const input={requirements:[requirement('RF-001'),requirement('RF-002')]},tools=createTestsAgentTools({input});let n=0;
  const call=(name,args)=>tools.execute({id:String(++n),name,args});
  await assert.rejects(call('submit_test_cases',{output:{test_cases:[scenario('RF-001')],warnings:[]}}),/Consulte integralmente/);
  await assert.rejects(call('read_source',{path:'index.js'}),/não permitida/);
  await assert.rejects(call('read_test_requirement',{requirement_code:'foreign',offset:0,length:1000}),/fora da tarefa/);
  for(const row of input.requirements)await call('read_test_requirement',{requirement_code:row.code,offset:0,length:10000});
  await assert.rejects(call('submit_test_cases',{output:{test_cases:[scenario('RF-001')],warnings:[]}}),/sem caso/);
  const output={test_cases:input.requirements.map(r=>scenario(r.code)),warnings:[]};
  const result=await call('submit_test_cases',{output});assert.equal(result.observation.requires_human_review,true);assert.deepEqual(result.terminal.output,output);
});
test('leitura paginada restaura faixas e não confunde lacuna com requisito integralmente lido',async()=>{
  const input={requirements:[{...requirement('RF-001'),description:'"linha\\\n'.repeat(800)}]},tools=createTestsAgentTools({input,maxObservationChars:1500});
  const first=await tools.execute({id:'first',name:'read_test_requirement',args:{requirement_code:'RF-001',offset:0,length:10000}});
  assert.ok(first.observation.truncated);assert.ok(JSON.stringify(first.observation).length<=1500);
  const restored=createTestsAgentTools({input,maxObservationChars:1500});await restored.restore(first.state);
  await assert.rejects(restored.execute({id:'early',name:'submit_test_cases',args:{output:{test_cases:[scenario('RF-001')],warnings:[]}}}),/integralmente/);
  let offset=first.observation.end;
  while(offset<first.observation.total_characters){const next=await restored.execute({id:'read-'+offset,name:'read_test_requirement',args:{requirement_code:'RF-001',offset,length:10000}});offset=next.observation.end;}
  const result=await restored.execute({id:'done',name:'submit_test_cases',args:{output:{test_cases:[scenario('RF-001')],warnings:[]}}});assert.equal(result.observation.accepted,true);
});
