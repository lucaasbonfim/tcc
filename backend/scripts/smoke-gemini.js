// Validação manual e paga do transporte/contratos. Não faz parte da suíte e não gera resultados da pesquisa.
import 'dotenv/config';
import { AGENTS, validateOutput } from '../src/research/agents.js';
import { createModelGateway, GENERATION_PARAMETERS } from '../src/research/model.js';
import { getGeminiModel, getGeminiApiKey } from '../src/config/gemini.js';

const model = getGeminiModel();
const key = getGeminiApiKey();
const generate = createModelGateway();
const input = {project_name:'Validação técnica sintética (não experimental)',documents:[{
  id:'technical-smoke-document',name:'Entrada sintética',version:1,warnings:[],pages:[{page:1,
    text:'O sistema deve permitir que o pesquisador consulte os projetos cadastrados. Quando não houver projetos cadastrados, deve exibir uma lista vazia.'}],
}]};
try {
  const first = AGENTS[0];
  const result = await generate({model,parameters:GENERATION_PARAMETERS,instruction:first.instruction,schema:first.schema,input});
  const requirements = validateOutput('requirements',JSON.parse(result.raw),input).requirements;
  const second = AGENTS[1];
  const secondInput = {project_name:input.project_name,requirements};
  const tests = await generate({model,parameters:GENERATION_PARAMETERS,instruction:second.instruction,schema:second.schema,input:secondInput});
  const output = validateOutput('tests',JSON.parse(tests.raw),secondInput);
  console.log(JSON.stringify({purpose:'Validação técnica somente. Sem persistência ou revisão experimental.',status:'ok',requirements:requirements.length,
    test_cases:output.test_cases.length,agents:[result.metadata,tests.metadata]},null,2));
} catch(error) {
  let reason = error.statusCode === 422 ? error.message : 'Falha no provedor ou resposta inválida.';
  try { reason = JSON.parse(error.message).error?.message || reason; } catch { /* erro local */ }
  console.error(JSON.stringify({status:'failed',status_code:error.status || error.statusCode || null,reason:reason.replaceAll(key,'[REDACTED]').slice(0,600)}));
  process.exitCode=1;
}
