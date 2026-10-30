import { createGeminiClient } from '../config/gemini.js';
import { assert } from './errors.js';

export const GENERATION_PARAMETERS = Object.freeze({ temperature:0.2, maxOutputTokens:8192 });

// Limites numéricos/coleções multiplicam a complexidade aceita pelo Gemini.
// O contrato completo permanece na entrada auditada e na validação local obrigatória.
export function providerSchema(value) {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['maxItems','minItems','minimum','maximum','additionalProperties'].includes(key))
    .map(([key,item]) => [key,providerSchema(item)]));
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
