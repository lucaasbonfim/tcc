import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateEvaluation,evaluationRequestSchema,EVALUATION_SCHEMA} from '../src/research/evaluation-contract.js';
import {validateShape} from '../src/research/agents.js';
function sample(status) {
  const test_case_id=randomUUID(),automated_test_id=randomUUID(),id=randomUUID();
  const input={results:[{id,test_case_id,automated_test_id,status,observed_excerpt:'Observação real do fixture executor.',omitted_characters:0}],test_cases:[{id:test_case_id,content:{requirement_codes:['RF-001'],expected_result:'Retorna 5.'}}]};
  const finding={test_result_id:id,test_case_id,automated_test_id,requirement_code:'RF-001',classification:'inconclusive',expected_behavior:'Retorna 5.',observed_behavior:input.results[0].observed_excerpt,evidence_quote:'Observação real',justification:'Evidência limitada.',limitations:[]};
  return {input,finding};
}
test('avaliação exige cobertura de resultados e evidências literais vinculadas',()=>{
  const {input,finding}=sample('failed');
  validateEvaluation({findings:[finding],warnings:[]},input);
  for(const change of [{evidence_quote:'inventada'},{test_result_id:randomUUID()},{observed_behavior:'inventado'},{expected_behavior:'Outro esperado'}])assert.throws(()=>validateEvaluation({findings:[{...finding,...change}],warnings:[]},input));
  assert.throws(()=>validateEvaluation({findings:[finding,finding],warnings:[]},input),/duplicada/);
});
test('falhas técnicas e testes aprovados não viram defeito funcional automaticamente',()=>{
  for(const status of ['passed','test_error','compilation_error','infrastructure_error','dependency_unavailable','timeout','cancelled','unsupported','skipped']) {
    const {input,finding}=sample(status);
    assert.throws(()=>validateEvaluation({findings:[{...finding,classification:'possible_functional_divergence'}],warnings:[]},input),/Classificação/);
  }
  const {input,finding}=sample('failed');
  validateEvaluation({findings:[{...finding,classification:'possible_functional_divergence'}],warnings:[]},input);
  input.results[0].omitted_characters=10;
  assert.throws(()=>validateEvaluation({findings:[{...finding,classification:'possible_functional_divergence'}],warnings:[]},input),/truncada/);
});

test('schema enviado ao modelo restringe esperado aos casos aprovados sem aceitar descrição semelhante do RF',()=>{
  const {input,finding}=sample('passed');
  const schema=evaluationRequestSchema(input);
  validateShape({findings:[finding],warnings:[]},schema);
  assert.throws(()=>validateShape({findings:[{...finding,expected_behavior:'A função deve retornar o valor cinco.'}],warnings:[]},schema),/fora do contrato/);
  assert.equal(EVALUATION_SCHEMA.properties.findings.items.properties.expected_behavior.enum,undefined);
});
