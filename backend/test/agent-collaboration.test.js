import test from 'node:test';
import assert from 'node:assert/strict';
import {createClarificationTools} from '../src/research/agents/requirements/subagents/clarification.js';
test('A1 consultado não delega, não altera requisitos e só cita fontes consultadas',async()=>{
  const catalog=[{source_id:'S0001',document_id:'doc',page:1,quote:'Somar dois números.'}],tools=createClarificationTools({catalog});
  const output={status:'ambiguous',answer:'A fonte não especifica entradas inválidas.',source_ids:['S0001']};
  await assert.rejects(tools.execute({id:'early',name:'respond_clarification',args:{output}}),/todas as fontes/);
  await assert.rejects(tools.execute({id:'delegate',name:'request_requirement_clarification',args:{}}),/não permitida/);
  await assert.rejects(tools.execute({id:'foreign',name:'read_clarification_sources',args:{source_ids:['foreign']}}),/fora da consulta/);
  const read=await tools.execute({id:'read',name:'read_clarification_sources',args:{source_ids:['S0001']}}),restored=createClarificationTools({catalog});await restored.restore(read.state);
  await assert.rejects(restored.execute({id:'invent',name:'respond_clarification',args:{output:{...output,source_ids:['foreign']}}}),/não consultada/);
  const result=await restored.execute({id:'done',name:'respond_clarification',args:{output}});assert.deepEqual(result.terminal.response.sources,catalog);assert.equal(result.terminal.response.requires_human_review,true);
});
