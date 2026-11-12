import { createGeminiClient } from '../../config/gemini.js';
import { assert } from '../errors.js';
import { randomUUID } from 'node:crypto';

export const GENERATION_PARAMETERS = Object.freeze({ temperature:0.2, maxOutputTokens:8192 });

// Limites numéricos/coleções multiplicam a complexidade aceita pelo Gemini.
// O contrato completo permanece na entrada auditada e na validação local obrigatória.
export const TOOL_SCHEMA_PROJECTION='bounds-description/v1';
export function providerSchema(value,{describeBounds=false}={}) {
  if (Array.isArray(value)) return value.map(item=>providerSchema(item,{describeBounds}));
  if (value && typeof value === 'object') {
    const projected=Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['maxItems','minItems','minimum','maximum','additionalProperties'].includes(key))
      .map(([key,item]) => [key,providerSchema(item,{describeBounds})]));
    if(describeBounds && ['integer','number','array'].includes(value.type)){
      const notes=[];
      if(value.minimum!==undefined)notes.push(`valor mínimo: ${value.minimum}`);
      if(value.maximum!==undefined)notes.push(`valor máximo: ${value.maximum}`);
      if(value.minItems!==undefined)notes.push(`mínimo de itens: ${value.minItems}`);
      if(value.maxItems!==undefined)notes.push(`máximo de itens: ${value.maxItems}`);
      if(notes.length)projected.description=[value.description,`Limites obrigatórios (${notes.join('; ')}).`].filter(Boolean).join(' ');
    }
    return projected;
  }
  return value;
}

export function createModelGateway(clientFactory = createGeminiClient) {
  return async ({ model, parameters, instruction, schema, input, signal }) => {
    const contents = JSON.stringify({ untrusted_research_data:input });
    assert(contents.length <= 180000, 'Entrada excede o limite da análise.', 422);
    const client = clientFactory();
    const response = await client.models.generateContent({ model, contents,
      config: { ...parameters, systemInstruction:instruction, responseMimeType:'application/json', responseJsonSchema:providerSchema(schema),
        abortSignal:signal || AbortSignal.timeout(90000), httpOptions:{ timeout:90000, retryOptions:{ attempts:1 } } } });
    const raw = response.text;
    assert(typeof raw === 'string' && raw.length <= 1000000, 'Modelo não retornou texto utilizável dentro do limite.', 422);
    // A resposta bruta é preservada pelo worker antes da validação estrutural.
    return { raw, metadata:{ requested_model:model, model_version:response.modelVersion ?? null,
      response_id:response.responseId ?? null, usage:response.usageMetadata ?? null,
      finish_reasons:response.candidates?.map(item => item.finishReason) ?? [], cost:null } };
  };
}

// One model turn only. Tool execution and conversation ownership belong to the runtime.
export function createAgentTurnGateway(clientFactory=createGeminiClient) {
  return async ({model,parameters,instruction,contents,tools,signal,timeout_ms=90000,max_context_chars=180000})=>{
    assert(Array.isArray(contents) && Array.isArray(tools) && tools.length>0,'Conversa/ferramentas inválidas.',422);
    assert(Number.isSafeInteger(timeout_ms) && timeout_ms>0 && timeout_ms<=90000,'Prazo do turno inválido.',422);
    assert(JSON.stringify({instruction,contents,tools}).length<=max_context_chars,'Contexto do agente excede o limite.',422);
    const controller=new AbortController();
    const abort=()=>controller.abort(signal?.reason);
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>controller.abort(new DOMException('Prazo do turno excedido.','TimeoutError')),timeout_ms);
    let onAbort;
    try {
      controller.signal.throwIfAborted();
      const client=clientFactory();
      const operation=client.models.generateContent({model,contents,config:{
        temperature:parameters.temperature,maxOutputTokens:parameters.maxOutputTokens,systemInstruction:instruction,
        tools:[{functionDeclarations:tools.map(tool=>({name:tool.name,description:tool.description,parametersJsonSchema:providerSchema(tool.parameters,{describeBounds:true})}))}],
        toolConfig:{functionCallingConfig:{mode:'ANY',allowedFunctionNames:tools.map(tool=>tool.name)}},
        abortSignal:controller.signal,httpOptions:{timeout:timeout_ms,retryOptions:{attempts:1}},
      }});
      const response=await Promise.race([operation,new Promise((_,reject)=>{
        onAbort=()=>reject(controller.signal.reason ?? new DOMException('Operação cancelada.','AbortError'));
        controller.signal.addEventListener('abort',onAbort,{once:true});
        if(controller.signal.aborted)onAbort();
      })]);
      const content=structuredClone(response.candidates?.[0]?.content ?? {role:'model',parts:[]});
      const calls=[];
      for(const part of content.parts || [])if(part.functionCall) {
        part.functionCall.id ||= randomUUID();
        calls.push({id:part.functionCall.id,name:part.functionCall.name,args:part.functionCall.args});
      }
      // Keep native parts/signatures and diagnostic fields, never SDK transport/headers.
      const raw=JSON.stringify({content,prompt_feedback:response.promptFeedback ?? null,
        finish_reasons:response.candidates?.map(item=>item.finishReason) ?? []});
      assert(raw.length<=1000000,'Resposta agentiva excede o limite.',422);
      return {raw,content,calls,metadata:{tool_schema_projection:TOOL_SCHEMA_PROJECTION,requested_model:model,model_version:response.modelVersion ?? null,
        response_id:response.responseId ?? null,usage:response.usageMetadata ?? null,
        finish_reasons:response.candidates?.map(item=>item.finishReason) ?? [],cost:null}};
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(onAbort)controller.signal.removeEventListener('abort',onAbort);
    }
  };
}
