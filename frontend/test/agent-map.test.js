import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAgentMap} from '../src/utils/agent-map.js';
const event=(kind,agent,extra={})=>({kind,agent,payload:{},...extra}),run={status:'running',stages:[]};
test('falhar no A1 não apresenta etapas não iniciadas como concluídas',()=>{
  const map=projectAgentMap({status:'failed',stages:[{agent:'requirements',status:'failed'},{agent:'tests',status:'blocked'}]},[event('attempt_started','requirements',{attempt_id:'a'}),event('attempt_failed','requirements',{attempt_id:'a'})]);
  assert.deepEqual(map.nodes.map(n=>n.state),['failed','idle','idle','idle']);assert.equal(map.terminal,true);
});
test('A1 pode trabalhar em consulta após sua etapa e pedido/resposta preservam direção',()=>{
  const events=[event('attempt_finished','requirements'),event('attempt_started','tests',{attempt_id:'t',stage_id:'tests'}),event('session_started','tests',{session_id:'parent',attempt_id:'t'}),event('message_request','tests',{recipient:'requirements',message_id:'m'}),event('session_started','requirements',{session_id:'child',attempt_id:'t',message_id:'m',payload:{parent_session_id:'parent'}}),event('tool_requested','requirements',{session_id:'child',payload:{name:'read_clarification_sources'}})];
  let map=projectAgentMap(run,events);assert.equal(map.nodes[0].state,'active');assert.equal(map.nodes[0].activity,'Conferindo fontes para responder');assert.equal(map.nodes[1].state,'waiting');assert.equal(map.messages[0].sender,'tests');assert.equal(map.messages[0].recipient,'requirements');
  map=projectAgentMap(run,[...events,event('session_finished','requirements',{session_id:'child'}),event('message_response','requirements',{recipient:'tests',message_id:'m'})]);assert.equal(map.nodes[0].state,'completed');assert.equal(map.nodes[1].state,'active');assert.equal(map.messages[0].response.agent,'requirements');
});
test('cancelar encerra atividade e mantém pergunta sem resposta',()=>{
  const map=projectAgentMap({...run,status:'cancelled'},[event('attempt_started','tests',{attempt_id:'t'}),event('session_started','tests',{session_id:'s'}),event('message_request','tests',{recipient:'requirements',message_id:'m'}),event('run_cancelled',null)]);
  assert.equal(map.nodes[1].state,'cancelled');assert.equal(map.messages[0].response,null);assert.equal(map.terminal,true);
});
test('retomada remove sessão da tentativa antiga, inclusive agente consultado',()=>{
  const events=[event('attempt_started','tests',{attempt_id:'old',stage_id:'tests'}),event('session_started','requirements',{session_id:'child',attempt_id:'old',stage_id:'tests'}),event('attempt_started','tests',{attempt_id:'new',stage_id:'tests'})],map=projectAgentMap(run,events);
  assert.equal(map.nodes[0].state,'idle');assert.equal(map.nodes[1].state,'active');
});
test('momento histórico não herda o resultado final e subetapa de scripts pertence ao A2',()=>{
  const events=[event('attempt_started','automation',{attempt_id:'a'}),event('session_started','automation',{session_id:'s'}),event('model_turn_requested','automation',{session_id:'s'})],map=projectAgentMap({status:'completed',stages:[{agent:'tests',status:'completed'}]},events,{historical:true});
  assert.equal(map.nodes[1].state,'active');assert.equal(map.nodes[1].activity,'Consultando modelo');assert.equal(map.nodes[1].calls,1);assert.equal(map.nodes[3].state,'idle');assert.equal(map.terminal,false);
});
test('retomar após interrupção do worker volta a mostrar a atividade nova',()=>{
  const map=projectAgentMap(run,[event('attempt_started','requirements',{attempt_id:'a'}),event('worker_interrupted',null),event('attempt_started','requirements',{attempt_id:'b'}),event('session_started','requirements',{session_id:'s',attempt_id:'b'}),event('model_turn_requested','requirements',{session_id:'s'})]);assert.equal(map.terminal,false);assert.equal(map.nodes[0].state,'active');assert.equal(map.nodes[0].activity,'Consultando modelo');
});
