// Manual, paid Gemini contract check. Real public source; synthetic oracle. Never executes generated code.
import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {resolveRepository} from '../src/research/github.js';
import {inspectRepository} from '../src/research/inspection.js';
import {AUTOMATION,buildScope,generatedPath,validateAutomation} from '../src/research/automation-contract.js';
import {createModelGateway,GENERATION_PARAMETERS} from '../src/research/model.js';
import {getGeminiModel,getGeminiApiKey} from '../src/config/gemini.js';

const key=getGeminiApiKey();
try {
  const version=await resolveRepository('https://github.com/jonschlinkert/is-number','');
  const inspected=await inspectRepository(version);
  const scope=buildScope(inspected,'',['index.js']);
  const id=randomUUID();
  const requirement={code:'RF-SMOKE',title:'Oráculo sintético de verificação numérica',description:'A função de verificação numérica deve retornar true para o número 2 e false para NaN.',
    kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],
    sources:[{document_id:'synthetic-technical-smoke',page:1,quote:'retornar true para o número 2 e false para NaN'}]};
  const testCase={id,content:{code:'CT-SMOKE',title:'Número finito e NaN',objective:'Validar contrato técnico da geração, sem experimento.',requirement_codes:[requirement.code],
    preconditions:[],input_data:['2','NaN'],steps:['Chamar a função exportada para 2 e NaN.'],expected_result:'isNumber(2) retorna true e isNumber(NaN) retorna false.',scenario:'boundary',automation:{feasibility:'needs_inspection',rationale:'Fonte pública inspecionada no SHA.'}}};
  const input={scope,requirements:[requirement],test_cases:[testCase],generated_paths:[{test_case_id:id,...generatedPath(id,scope.module.adapter)}]};
  const result=await createModelGateway()({model:getGeminiModel(),parameters:GENERATION_PARAMETERS,instruction:AUTOMATION.instruction,schema:AUTOMATION.schema,input});
  const parsed=validateAutomation(JSON.parse(result.raw),input);
  console.log(JSON.stringify({purpose:'Validação técnica sintética, sem aprovação/execução ou gravação na pesquisa.',status:'ok',repository:version.repository_url,commit_sha:version.commit_sha,
    generated:parsed.artifacts.length,unsupported:parsed.unsupported_cases,warnings:parsed.warnings,execution_performed:false,metadata:result.metadata},null,2));
} catch(error) {
  let reason=error.statusCode===422 ? error.message : 'Falha na integração de inspeção/Gemini.';
  try{reason=JSON.parse(error.message).error?.message || reason;}catch{}
  console.error(JSON.stringify({status:'failed',reason:reason.replaceAll(key,'[REDACTED]').slice(0,600)}));process.exitCode=1;
}
