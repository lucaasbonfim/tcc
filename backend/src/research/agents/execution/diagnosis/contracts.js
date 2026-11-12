import {assert} from '../../../shared/errors.js';
import {validateShape} from '../../../shared/validation.js';
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),string={type:'string'},list=(items,maxItems,minItems=0)=>({type:'array',items,maxItems,minItems});
export const EXECUTION_DIAGNOSIS_SCHEMA=obj({diagnostics:list(obj({result_id:string,script_id:string,script_version:{type:'integer',minimum:1,maximum:2147483647},kind:{type:'string',enum:['compatible','assertion_failure','test_issue','environment_issue','inconclusive']},action:{type:'string',enum:['no_change','review_script','check_environment','inconclusive']},expected_behavior:string,observed_behavior:string,evidence_quote:string,rationale:string,limitations:list(string,30)}),200,1),summary:string,limitations:list(string,30)});
const allowed={passed:['compatible','test_issue','inconclusive'],failed:['assertion_failure','test_issue','inconclusive'],test_error:['test_issue','environment_issue','inconclusive'],compilation_error:['test_issue','environment_issue','inconclusive'],infrastructure_error:['environment_issue','inconclusive'],dependency_unavailable:['environment_issue','inconclusive'],timeout:['environment_issue','inconclusive'],cancelled:['inconclusive'],unsupported:['inconclusive'],skipped:['inconclusive'],inconclusive:['inconclusive']};
const actions={compatible:['no_change'],assertion_failure:['review_script','inconclusive'],test_issue:['review_script'],environment_issue:['check_environment'],inconclusive:['inconclusive']};
export function validateExecutionDiagnostics(output,input) {
  validateShape(output,EXECUTION_DIAGNOSIS_SCHEMA);const seen=new Set();
  for(const row of output.diagnostics){const result=input.results.find(r=>r.id===row.result_id),script=input.automated_tests.find(s=>s.id===row.script_id),test=input.test_cases.find(c=>c.id===result?.test_case_id);
    assert(result && script && !seen.has(result.id) && result.automated_test_id===script.id && script.version===row.script_version,'Referência de diagnóstico ausente, duplicada ou fora da execução.',422);seen.add(result.id);
    assert(row.expected_behavior===test.content.expected_result && row.observed_behavior===result.observed_excerpt,'Diagnóstico alterou esperado/observado.',422);
    assert(result.observed_excerpt.replace(/\s+/g,' ').includes(row.evidence_quote.replace(/\s+/g,' ')),'Citação do diagnóstico não consta da observação.',422);
    assert(allowed[result.status]?.includes(row.kind) && actions[row.kind].includes(row.action),'Diagnóstico/ação não sustentados pelo estado de execução.',422);
    if(result.omitted_characters>0)assert(row.kind==='inconclusive','Observação truncada exige diagnóstico inconclusivo.',422);
  }
  assert(seen.size===input.results.length,'Diagnóstico omitiu resultados.',422);return output;
}
