import test from 'node:test';
import assert from 'node:assert/strict';
import {createScriptReviewTools} from '../src/research/agents/tests/subagents/script-review.js';
test('A2 consultado exige contexto, preserva esperado e não executa ou delega',async()=>{
  const context={script:{id:'s',version:1,revision:2,files:{sha256:'original'},content:{},files_data:[]},test_case:{id:'c',content:{expected_result:'Retorna 5.'}},requirements:[],scope:{}};
  const tools=createScriptReviewTools({context}),output={status:'no_change',answer:'Não há evidência suficiente para corrigir o teste.',expected_result:'Retorna 5.',files:[]};
  await assert.rejects(tools.execute({id:'early',name:'respond_script_review',args:{output}}),/integralmente/);await assert.rejects(tools.execute({id:'exec',name:'execute',args:{}}),/não permitida/);
  const read=await tools.execute({id:'read',name:'read_script_review_context',args:{offset:0,length:10000}}),resumed=createScriptReviewTools({context});await resumed.restore(read.state);
  await assert.rejects(resumed.execute({id:'expected',name:'respond_script_review',args:{output:{...output,expected_result:'Retorna 6.'}}}),/esperado/);
  await assert.rejects(resumed.execute({id:'files',name:'respond_script_review',args:{output:{...output,files:[{path:'x.js',code:'change'}]}}}),/não pode alterar/);
  assert.equal((await resumed.execute({id:'done',name:'respond_script_review',args:{output}})).terminal.response.script_changed,false);
});
