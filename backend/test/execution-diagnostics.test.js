import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExecutionDiagnostics} from '../src/research/agents/execution/diagnosis/contracts.js';
import {createExecutionDiagnosisTools} from '../src/research/agents/execution/diagnosis/tools.js';
function sample(status='passed') {
  const result={id:'r',test_case_id:'c',automated_test_id:'s',evidence_id:'e',status,observed_excerpt:'Observação preservada.',omitted_characters:0};
  return {input:{results:[result],test_cases:[{id:'c',content:{expected_result:'Retorna 5.',requirement_codes:['RF-001']}}],automated_tests:[{id:'s',version:1,files_data:[]}],requirements:[{code:'RF-001'}],original_source_excerpts:[],environments:[{evidence_id:'e'}]},output:{diagnostics:[{result_id:'r',script_id:'s',script_version:1,kind:'inconclusive',action:'inconclusive',expected_behavior:'Retorna 5.',observed_behavior:result.observed_excerpt,evidence_quote:result.observed_excerpt,rationale:'Evidência limitada.',limitations:[]}],summary:'Controle técnico.',limitations:[]}};
}
test('diagnóstico vincula versão/resultado e não inventa observado ou esperado',()=>{
  const {input,output}=sample();validateExecutionDiagnostics(output,input);
  for(const change of [{script_version:2},{result_id:'foreign'},{observed_behavior:'Inventado'},{expected_behavior:'Retorna 6.'},{evidence_quote:'Inventada'}])assert.throws(()=>validateExecutionDiagnostics({...output,diagnostics:[{...output.diagnostics[0],...change}]},input));
  assert.throws(()=>validateExecutionDiagnostics({...output,diagnostics:[output.diagnostics[0],output.diagnostics[0]]},input),/duplicada/);
});
test('falha técnica não vira falha de asserção e evidência truncada exige inconclusivo',()=>{
  for(const status of ['passed','compilation_error','test_error','infrastructure_error','timeout','cancelled']) {const {input,output}=sample(status);assert.throws(()=>validateExecutionDiagnostics({...output,diagnostics:[{...output.diagnostics[0],kind:'assertion_failure',action:'review_script'}]},input),/sustentados/);}
  const {input,output}=sample('failed'),row={...output.diagnostics[0],kind:'assertion_failure',action:'review_script'};validateExecutionDiagnostics({...output,diagnostics:[row]},input);input.results[0].omitted_characters=10;
  assert.throws(()=>validateExecutionDiagnostics({...output,diagnostics:[row]},input),/truncada/);validateExecutionDiagnostics(output,input);
});
test('diagnóstico exige contexto integral e restaura leituras parciais sem conceder execução',async()=>{
  const {input,output}=sample();input.automated_tests[0].files_data=[{code:'"linha\\\n'.repeat(700)}];const tools=createExecutionDiagnosisTools({input,maxObservationChars:1500});
  await assert.rejects(tools.execute({id:'early',name:'submit_execution_diagnostics',args:{output}}),/integralmente/);
  await assert.rejects(tools.execute({id:'shell',name:'execute',args:{}}),/não permitida/);
  const first=await tools.execute({id:'read',name:'read_execution_evidence',args:{result_id:'r',offset:0,length:10000}});assert.ok(first.observation.truncated);assert.ok(JSON.stringify(first.observation).length<=1500);
  const resumed=createExecutionDiagnosisTools({input,maxObservationChars:1500});await resumed.restore(first.state);let end=first.observation.end;
  while(end<first.observation.total_characters){const next=await resumed.execute({id:'read-'+end,name:'read_execution_evidence',args:{result_id:'r',offset:end,length:10000}});end=next.observation.end;}
  assert.equal((await resumed.execute({id:'done',name:'submit_execution_diagnostics',args:{output}})).observation.requires_human_review,true);
});
