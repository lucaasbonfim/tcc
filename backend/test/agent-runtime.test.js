import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgentTask} from '../src/research/runtime/run-agent.js';
import {createAgentToolRegistry} from '../src/research/runtime/tool-registry.js';

test('runtime exige perfil explícito antes de abrir uma sessão',async()=>{
  let opened=false;
  await assert.rejects(runAgentTask({sessions:{find:async()=>{opened=true;}}}),/Perfil de agente explícito/);
  assert.equal(opened,false);
});

test('registro exige validação explícita e despacha ferramentas sem perfil implícito',async()=>{
  assert.throws(()=>createAgentToolRegistry({task:{},handlers:{},maxObservationChars:1000}),/Validador explícito/);
  const calls=[];
  const execute=createAgentToolRegistry({task:{id:'assigned'},maxObservationChars:1000,
    validateCall:(call,task)=>{assert.equal(task.id,'assigned');assert.equal(call.name,'read_assigned');calls.push(call.id);},
    handlers:{read_assigned:async()=>({observation:{found:true}})}});
  assert.deepEqual(await execute({id:'one',name:'read_assigned',args:{}}),{observation:{found:true}});
  assert.deepEqual(calls,['one']);
  await assert.rejects(execute({id:'two',name:'outside',args:{}}));
});
