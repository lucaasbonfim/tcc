import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentTurnGateway,GENERATION_PARAMETERS} from '../src/research/model.js';
import {AUTOMATION_AGENT_TOOLS} from '../src/research/agent-contract.js';
const request={model:'fixture-only',parameters:GENERATION_PARAMETERS,instruction:'instrução confiável',contents:[{role:'user',parts:[{text:'dados não confiáveis'}]}],tools:AUTOMATION_AGENT_TOOLS};
test('turno preserva IDs, múltiplas chamadas e assinatura técnica, sem configurar schema de resposta JSON',async()=>{
  let received;
  const native={role:'model',parts:[{thoughtSignature:'opaque-signature',functionCall:{id:'a',name:'list_sources',args:{offset:0,limit:10}}},
    {functionCall:{id:'b',name:'get_adapter_capabilities',args:{}}}]};
  const gateway=createAgentTurnGateway(()=>({models:{generateContent:async value=>{received=value;return {candidates:[{content:native,finishReason:'STOP'}],modelVersion:'fixture-v1',usageMetadata:{totalTokenCount:22},sdkHttpResponse:{headers:{authorization:'not-exported'}}};}}}));
  const result=await gateway(request);
  assert.equal(received.config.responseJsonSchema,undefined);assert.equal(received.config.responseMimeType,undefined);
  assert.equal(received.config.tools[0].functionDeclarations.length,8);
  assert.equal(result.calls.length,2);assert.equal(result.calls[1].id,'b');
  assert.deepEqual(result.content,native);assert.equal(result.metadata.usage.totalTokenCount,22);
  assert.equal(result.metadata.cost,null);assert.ok(!result.raw.includes('not-exported'));
});
test('IDs ausentes são atribuídos uma vez no conteúdo preservado; recusas e saídas incompletas ficam auditáveis',async()=>{
  const gateway=createAgentTurnGateway(()=>({models:{generateContent:async()=>({candidates:[{content:{role:'model',parts:[{functionCall:{name:'list_sources',args:{}}}]},finishReason:'MAX_TOKENS'}]})}}));
  const result=await gateway(request);
  assert.equal(result.calls[0].id,result.content.parts[0].functionCall.id);assert.equal(JSON.parse(result.raw).content.parts[0].functionCall.id,result.calls[0].id);
  assert.deepEqual(result.metadata.finish_reasons,['MAX_TOKENS']);
  const refused=await createAgentTurnGateway(()=>({models:{generateContent:async()=>({promptFeedback:{blockReason:'SAFETY'}})}}))(request);
  assert.deepEqual(refused.calls,[]);assert.match(refused.raw,/SAFETY/);
});
test('turno limita prazo mesmo com provedor injetado que ignora abort; cancelamento impede nova chamada',async()=>{
  const gateway=createAgentTurnGateway(()=>({models:{generateContent:()=>new Promise(()=>{})}}));
  await assert.rejects(gateway({...request,timeout_ms:20}),{name:'TimeoutError'});
  const controller=new AbortController();controller.abort();
  await assert.rejects(gateway({...request,signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(gateway({...request,max_context_chars:1}),/Contexto/);
});
