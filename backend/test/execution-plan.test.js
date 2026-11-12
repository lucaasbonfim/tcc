import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {buildExecutionBundles} from '../src/research/services/execution-plan.js';
import {sha256,validateBundle} from '../../shared/execution-protocol.js';
const source=(path='calc.js',content='export const sum=(a,b)=>a+b;')=>({path,content,sha256:sha256(content),git_sha:createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex')});
function sample(count,distinct=false){const scope={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40),module:{adapter:'node-test/v2'},files:[source()]};return {runId:randomUUID(),scope,entries:Array.from({length:count},(_,i)=>{const test_case_id=randomUUID();return {script:{id:randomUUID(),test_case_id,version:1},scope:{...scope,files:[source(distinct?`calc${i}.js`:'calc.js')]},files:[{path:`__research_generated__/ct_${test_case_id.replaceAll('-','')}.test.mjs`,code:'// control'}]};})};}
test('plano divide por scripts/fontes e preserva cada artefato uma única vez',()=>{
  for(const [count,distinct,expected] of [[21,false,[20,1]],[17,true,[16,1]],[81,false,[20,20,20,20,1]]]) {
    const input=sample(count,distinct),bundles=buildExecutionBundles(input);assert.deepEqual(bundles.map(b=>b.generated_tests.length),expected);
    bundles.forEach(validateBundle);assert.deepEqual(new Set(bundles.flatMap(b=>b.generated_tests.map(t=>t.id))),new Set(input.entries.map(e=>e.script.id)));
  }
});
test('agrupamento explícito deve cobrir todos os scripts e não permite versões/fontes conflitantes',()=>{
  const input=sample(3),ids=input.entries.map(e=>e.script.id);assert.equal(buildExecutionBundles({...input,groups:[[ids[0]],[ids[1],ids[2]]]}).length,2);
  for(const groups of [[[ids[0]]],[[...ids,ids[0]]],[['foreign',ids[1],ids[2]]],[]])assert.throws(()=>buildExecutionBundles({...input,groups}));
  input.entries[1].scope.files=[source('calc.js','outro conteúdo')];assert.throws(()=>buildExecutionBundles(input),/divergem/);
});
