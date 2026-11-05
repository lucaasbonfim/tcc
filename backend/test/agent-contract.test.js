import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentPolicy,resolveAgentPolicy,agentMode} from '../src/research/agent-policy.js';
import {validateAgentCall,assertSessionTransition,stageStatusForSession,AUTOMATION_AGENT_TOOLS} from '../src/research/agent-contract.js';
const task={case_ids:['case-1'],requirement_codes:['RF-001']};
const call=(name,args)=>({id:'call-1',name,args});
test('snapshots antigos permanecem fixos; política agentiva é explícita, validada e imutável',()=>{
  const old={documents:[]},before=JSON.stringify(old);
  assert.equal(agentMode(old,'automation'),'fixed/v1');assert.equal(JSON.stringify(old),before);
  const policy=createAgentPolicy({modes:{automation:'agent/v1'}});
  const oldPolicy=createAgentPolicy({modes:{automation:'agent/v1'},limits:{max_model_turns:8}});
  assert.equal(resolveAgentPolicy({agent_policy:oldPolicy}).limits.max_model_turns,8);
  assert.equal(resolveAgentPolicy({agent_policy:policy}).modes.automation,'agent/v1');
  assert.throws(()=>{policy.modes.tests='agent/v1';},TypeError);
  assert.equal(createAgentPolicy({modes:{execution:'agent/v1'}}).modes.execution,'agent/v1');
  for(const input of [{modes:{execution:'invalid/v1'}},{modes:{unknown:'agent/v1'}},{limits:{max_model_turns:0}},{limits:{max_duration_ms:Infinity}},{limits:{unknown:1}},{run_limits:{max_model_turns:1}},{version:'99'}])assert.throws(()=>createAgentPolicy(input));
});
test('ferramentas validam limites e pertencimento antes de executar',()=>{
  validateAgentCall(call('get_approved_case',{case_id:'case-1'}),task);
  validateAgentCall(call('read_source',{path:'src/sum.js',offset:0,length:100}),task);
  for(const c of [call('shell',{command:'whoami'}),call('get_approved_case',{case_id:'foreign'}),call('get_approved_requirement',{requirement_code:'RF-999'}),call('read_source',{path:'x',offset:-1,length:100}),call('read_source',{path:'x',offset:0,length:12001}),call('get_adapter_capabilities',{run_id:'foreign'})])assert.throws(()=>validateAgentCall(c,task));
  assert.ok(Object.isFrozen(AUTOMATION_AGENT_TOOLS[0].parameters));
});
test('submissão terminal cobre todos os casos e não converte omissão em sucesso',()=>{
  const output={artifacts:[],unsupported_cases:[{test_case_id:'case-1',reason:'Adaptador não suporta a dependência documentada.'}],warnings:[]};
  validateAgentCall(call('submit_automation',{scope_id:'',output}),task);
  for(const unsupported_cases of [[],[...output.unsupported_cases,...output.unsupported_cases],[{test_case_id:'foreign',reason:'não suportado'}]])assert.throws(()=>validateAgentCall(call('submit_automation',{scope_id:'',output:{...output,unsupported_cases}}),task));
});
test('sessões terminadas não reabrem; esgotamento nunca vira conclusão aprovada',()=>{
  assertSessionTransition('pending','running');assertSessionTransition('running','interrupted');assertSessionTransition('interrupted','running');
  for(const status of ['completed','failed','cancelled','exhausted'])assert.throws(()=>assertSessionTransition(status,'running'));
  assert.equal(stageStatusForSession('completed'),'awaiting_review');assert.equal(stageStatusForSession('exhausted'),'failed');
});
