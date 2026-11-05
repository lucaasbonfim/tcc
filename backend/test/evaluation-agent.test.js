import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvaluationAgentTools} from '../src/research/evaluation-agent.js';
import {evaluationRequestSchema,validateEvaluation} from '../src/research/evaluation-contract.js';
function sample(status='passed') {
  const result={id:'result',test_case_id:'case',automated_test_id:'script',evidence_id:'evidence',status,observed_excerpt:'Observação preservada do executor.',omitted_characters:0};
  const input={results:[result],requirements:[{code:'RF-001',description:'Somar dois números.',sources:[{document_id:'doc',page:1,quote:'Somar dois números.'}]}],original_source_excerpts:[{requirement_code:'RF-001',document_id:'doc',page:1,quote:'Somar dois números.'}],
    test_cases:[{id:'case',content:{requirement_codes:['RF-001'],expected_result:'Retorna 5.'}}],automated_tests:[{id:'script',test_case_id:'case',files_data:[{path:'sum.test.js',code:'assert.equal(sum(2,3),5);'}]}],environments:[{evidence_id:'evidence',environment:{fixture_only:true}}]};
  const output={findings:[{test_result_id:'result',test_case_id:'case',automated_test_id:'script',requirement_code:'RF-001',classification:'inconclusive',expected_behavior:'Retorna 5.',observed_behavior:result.observed_excerpt,evidence_quote:'Observação preservada',justification:'Evidência de controle.',limitations:[]}],warnings:[]};return {input,output};
}
async function readAll(tools,section='context',offset=0){let response;do{response=await tools.execute({id:'read-'+section+'-'+offset,name:'read_evaluation_context',args:{result_id:'result',section,offset,length:10000}});offset=response.observation.end;}while(offset<response.observation.total_characters);return response;}
test('observado fica vinculado ao relatório e uma paráfrase recebe os literais corretos sem ser aceita',()=>{
  const {input,output}=sample(),schema=evaluationRequestSchema(input),fields=schema.properties.findings.items.properties;
  assert.deepEqual(fields.observed_behavior.enum,[input.results[0].observed_excerpt]);assert.deepEqual(fields.test_result_id.enum,['result']);assert.equal(fields.justification.enum,undefined);
  const wrong={...output,findings:[{...output.findings[0],observed_behavior:'O sistema retornou o valor esperado.'}]},before=JSON.stringify(wrong);
  assert.throws(()=>validateEvaluation(wrong,input),e=>e.statusCode===422&&e.message.includes(input.results[0].observed_excerpt)&&e.message.includes(input.test_cases[0].content.expected_result));
  assert.equal(JSON.stringify(wrong),before);validateEvaluation(output,input);
});
test('A4 exige investigação e mantém esperado, observado e classes sustentadas pela execução',async()=>{
  for(const status of ['passed','failed','test_error','compilation_error','infrastructure_error','timeout','cancelled']) {
    const {input,output}=sample(status),tools=createEvaluationAgentTools({input});
    const submit=value=>tools.execute({id:'submit',name:'submit_evaluation',args:{output:value}});
    await assert.rejects(submit(output),/integralmente/);await readAll(tools);
    for(const change of [{observed_behavior:'Inventado'},{evidence_quote:'Não consta do log'},{expected_behavior:'Retorna 6.'},{test_result_id:'foreign'}])await assert.rejects(submit({...output,findings:[{...output.findings[0],...change}]}));
    const divergent={...output,findings:[{...output.findings[0],classification:'possible_functional_divergence'}]};
    if(status==='failed')assert.equal((await submit(divergent)).observation.accepted,true);else await assert.rejects(submit(divergent),/Classificação/);
    assert.equal((await submit(output)).observation.requires_human_review,true);
  }
});
test('A4 permite leitura seletiva das seções, exige todos os vínculos e recusa ferramentas externas',async()=>{
  const {input,output}=sample(),tools=createEvaluationAgentTools({input});
  await assert.rejects(tools.execute({id:'foreign',name:'read_evaluation_context',args:{result_id:'foreign',section:'context',offset:0,length:1000}}),/fora da tarefa/);
  await assert.rejects(tools.execute({id:'shell',name:'execute',args:{}}),/não permitida/);
  for(const section of ['result','requirements','original_sources','test_case','script','environment'])await readAll(tools,section);
  assert.equal((await tools.execute({id:'done',name:'submit_evaluation',args:{output}})).observation.accepted,true);
  const other=structuredClone(input.results[0]);other.id='other';input.results.push(other);
  const two=createEvaluationAgentTools({input});await readAll(two);
  await assert.rejects(two.execute({id:'missing',name:'submit_evaluation',args:{output}}),/integralmente/);
  await two.execute({id:'other',name:'read_evaluation_context',args:{result_id:'other',section:'context',offset:0,length:10000}});
  await assert.rejects(two.execute({id:'missing',name:'submit_evaluation',args:{output}}),/omitiu pares/);
});
test('A4 restaura leitura parcial sem transformar observação truncada em conclusão funcional',async()=>{
  const {input,output}=sample('failed');input.results[0].omitted_characters=20;input.automated_tests[0].files_data[0].code='"linha\\\n'.repeat(800);
  const tools=createEvaluationAgentTools({input,maxObservationChars:1500});
  const first=await tools.execute({id:'first',name:'read_evaluation_context',args:{result_id:'result',section:'context',offset:0,length:10000}});
  assert.ok(first.observation.truncated);assert.ok(JSON.stringify(first.observation).length<=1500);
  const resumed=createEvaluationAgentTools({input,maxObservationChars:1500});await resumed.restore(first.state);
  await assert.rejects(resumed.execute({id:'early',name:'submit_evaluation',args:{output}}),/integralmente/);
  await readAll(resumed,'context',first.observation.end);
  await assert.rejects(resumed.execute({id:'bad',name:'submit_evaluation',args:{output:{...output,findings:[{...output.findings[0],classification:'possible_functional_divergence'}]}}}),/truncada/);
  assert.equal((await resumed.execute({id:'done',name:'submit_evaluation',args:{output}})).observation.accepted,true);
});
