import test from 'node:test';
import assert from 'node:assert/strict';
import {planTestParts,assertTestCoverage,testCoverage} from '../src/research/test-parts.js';

test('lotes de testes preservam todos os requisitos sem cortar conteúdo e limitam contexto',()=>{
  const requirements=Array.from({length:78},(_,i)=>({code:`RF-${i+1}`,description:'Regra '.repeat(300)}));
  const parts=planTestParts(requirements);
  assert(parts.length>=20);assert(parts.every(part=>part.length<=4));assert.deepEqual(parts.flat(),requirements);
  assert(parts.every(part=>JSON.stringify(part).length<10100));
  const large={code:'RF-grande',description:'a'.repeat(20000)};
  assert.deepEqual(planTestParts([large])[0],[large]);
  assert.throws(()=>planTestParts([{code:'RF-excessivo',description:'a'.repeat(120001)}]),/contexto individual/);
});

test('rastreabilidade exige todos os códigos; rejeitar um caso retira seus vínculos aceitos',()=>{
  const requirements=['RF-1','RF-2'].map(code=>({code,content:{title:code},review_status:'approved'}));
  assert.throws(()=>assertTestCoverage([{requirement_codes:['RF-1']}],requirements),/RF-2/);
  assert.doesNotThrow(()=>assertTestCoverage([{requirement_codes:['RF-1','RF-2']}],requirements));
  const cases=[{code:'CT-1',content:{requirement_codes:['RF-1']},review_status:'approved'},{code:'CT-2',content:{requirement_codes:['RF-2']},review_status:'rejected'}];
  const coverage=testCoverage(requirements,cases);assert.equal(coverage.linked,1);assert.deepEqual(coverage.missing,['RF-2']);assert.equal(coverage.approved_linked,1);
});
