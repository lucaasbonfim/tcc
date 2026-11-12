import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planAutomationParts,automationCoverage} from '../src/research/agents/tests/scripts/parts.js';

test('104 cenários mantêm identidade e todos os caminhos em lotes pequenos com requisitos pertinentes',()=>{
  const cases=Array.from({length:104},(_,i)=>({id:randomUUID(),content:{code:`CT-${i+1}`,requirement_codes:[`RF-${i%3}`]}}));
  const input={scope:{files:[{content:'Fonte preservada.'}]},test_cases:cases,requirements:Array.from({length:4},(_,i)=>({code:`RF-${i}`})),generated_paths:cases.map(row=>({test_case_id:row.id,path:row.id}))};
  const parts=planAutomationParts(input);assert.equal(parts.length,52);assert.deepEqual(parts.flatMap(p=>p.test_cases),cases);assert(parts.every(p=>p.test_cases.length===2));assert(parts.every(p=>!p.requirements.some(r=>r.code==='RF-3')));assert.deepEqual(parts.flatMap(p=>p.generated_paths),input.generated_paths);assert(parts.every(p=>p.scope===input.scope));
  assert.throws(()=>planAutomationParts({...input,requirements:[]}),/sem requisito/);
  assert.throws(()=>planAutomationParts({...input,scope:{content:'a'.repeat(170001)}}),/contexto individual/);
});

test('resumo de automação distingue script, impossibilidade justificada e cenário faltante',()=>{
  const coverage=automationCoverage(['a','b','c'],[{status:'completed',dispositions:[{test_case_id:'a',status:'generated'},{test_case_id:'b',status:'unsupported',reason:'Escopo sem operação requerida.'}]},{status:'failed',dispositions:[]}]);
  assert.equal(coverage.generated,1);assert.equal(coverage.unsupported.length,1);assert.deepEqual(coverage.missing,['c']);
});
