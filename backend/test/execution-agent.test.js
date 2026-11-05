import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {sha256} from '../../shared/execution-protocol.js';
import {createExecutionPlanningTools} from '../src/research/execution-agent.js';
test('planejador exige capacidades/leitura, não executa e rejeita scripts externos ou omitidos',async()=>{
  const content='export const x=1;',source={path:'index.js',content,sha256:sha256(content),git_sha:createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex')};
  const id=randomUUID(),test_case_id=randomUUID(),scope={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40),module:{adapter:'node-test/v2'},files:[source]};
  const input={runId:randomUUID(),scope,receipt:{ready:true},entries:[{script:{id,test_case_id,version:1,revision:1,content:{}},scope,test_case:{content:{expected_result:'Retorna 1.'}},files:[{path:`__research_generated__/ct_${test_case_id.replaceAll('-','')}.test.mjs`,code:'// fixture'}]}]};
  const tools=createExecutionPlanningTools({input}),output={groups:[{script_ids:[id],rationale:'Escopo único.'}],rationale:'Plano técnico.',limitations:[]};
  await assert.rejects(tools.execute({id:'early',name:'submit_execution_plan',args:{output}}),/capacidades/);
  await assert.rejects(tools.execute({id:'exec',name:'execute',args:{}}),/não permitida/);
  await tools.execute({id:'caps',name:'get_execution_capabilities',args:{}});
  await assert.rejects(tools.execute({id:'early2',name:'submit_execution_plan',args:{output}}),/integralmente/);
  await assert.rejects(tools.execute({id:'foreign',name:'read_execution_script',args:{script_id:'foreign',offset:0,length:1000}}),/fora da tarefa/);
  const read=await tools.execute({id:'read',name:'read_execution_script',args:{script_id:id,offset:0,length:10000}}),restored=createExecutionPlanningTools({input});await restored.restore(read.state);await restored.restore({execution_capabilities_read:true});
  await assert.rejects(restored.execute({id:'missing',name:'validate_execution_groups',args:{groups:[]}}));
  const done=await restored.execute({id:'done',name:'submit_execution_plan',args:{output}});assert.equal(done.observation.authorized,false);assert.deepEqual(done.terminal.output,output);
});
