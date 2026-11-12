import {validateExecutionDiagnostics} from './contracts.js';
import {assert} from '../../../shared/errors.js';
import {validateShape} from '../../../shared/validation.js';
import {createAgentToolRegistry} from '../../../runtime/tool-registry.js';
import {createRecordReader} from '../../../runtime/record-reader.js';
import {EXECUTION_DIAGNOSIS_AGENT} from './definition.js';

export function executionEvidenceContexts(input) {
  return input.results.map(result=>{const test_case=input.test_cases.find(t=>t.id===result.test_case_id),script=input.automated_tests.find(s=>s.id===result.automated_test_id),environment=input.environments.find(e=>e.evidence_id===result.evidence_id);assert(test_case && script && environment,'Contexto de diagnóstico incompleto.',422);
    return {id:result.id,data:{result,test_case,script,environment,requirements:input.requirements.filter(r=>test_case.content.requirement_codes.includes(r.code)),original_sources:input.original_source_excerpts.filter(s=>test_case.content.requirement_codes.includes(s.requirement_code))}};});
}
export function createExecutionDiagnosisTools({input,definition=EXECUTION_DIAGNOSIS_AGENT,maxObservationChars=12000,requestScriptReview}) {
  const reader=createRecordReader({records:executionEvidenceContexts(input),maxObservationChars,idField:'result_id'}),declarations=structuredClone(definition.tools);
  const handlers={request_script_review:async(args,context)=>{assert(input.results.some(r=>r.id===args.result_id),'Resultado fora da tarefa.',403);assert(reader.complete(args.result_id),'Investigue integralmente o resultado antes de consultar A2.',422);assert(requestScriptReview,'Consulta ao A2 indisponível nesta tarefa.',422);return {observation:await requestScriptReview(args,context)};},
    list_execution_results:async({offset,limit})=>({observation:{results:input.results.slice(offset,offset+limit).map(r=>({id:r.id,status:r.status,script_id:r.automated_test_id,test_case_id:r.test_case_id,characters:reader.characters(r.id),read_complete:Boolean(reader.complete(r.id))})),total:input.results.length,next_offset:offset+limit<input.results.length?offset+limit:null}}),
    read_execution_evidence:async({result_id,offset,length})=>reader.read(result_id,offset,length),
    submit_execution_diagnostics:async({output})=>{reader.assertComplete();validateExecutionDiagnostics(output,input);return {observation:{accepted:true,requires_human_review:true},terminal:{output,input}};}};
  const validateCall=call=>{assert(typeof call?.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);const tool=declarations.find(t=>t.name===call.name);assert(tool,'Ferramenta não permitida ao diagnóstico A3.',403);validateShape(call.args,tool.parameters,'argumentos');};
  return {declarations,task:{result_ids:input.results.map(r=>r.id)},execute:createAgentToolRegistry({task:{},handlers,maxObservationChars,validateCall}),restore:reader.restore};
}
