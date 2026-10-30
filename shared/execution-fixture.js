// Test fixtures only: never evidence from a real repository execution.
import {randomUUID,createHash} from 'node:crypto';
import {sha256} from './execution-protocol.js';
export function executionFixture() {
  const caseId=randomUUID(),content='export function sum(a,b){return a+b;}';
  const code="import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../src/calc.js';test('soma',()=>assert.equal(sum(2,3),5));";
  return {protocol_version:1,job_id:randomUUID(),run_id:randomUUID(),repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40),adapter:'node-test/v2',
    source_files:[{path:'src/calc.js',content,git_sha:createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'),sha256:sha256(content)}],
    generated_tests:[{id:randomUUID(),test_case_id:caseId,version:1,files:[{path:`__research_generated__/ct_${caseId.replaceAll('-','')}.test.mjs`,code,sha256:sha256(code)}]}]};
}
export function fixtureResult(bundle,status='passed') {
  return {protocol_version:1,job_id:bundle.job_id,request_sha256:sha256(bundle),commit_sha:bundle.commit_sha,adapter:bundle.adapter,status:'completed',
    environment:{deployment_id:'platform-test-fixture',image_id:'sha256:'+'b'.repeat(64)},started_at:'2026-10-30T12:00:00.000Z',finished_at:'2026-10-30T12:00:00.100Z',duration_ms:100,exit_code:status==='passed' ? 0 : 1,
    commands:[{argv:['node','--test',bundle.generated_tests[0].files[0].path],exit_code:status==='passed' ? 0 : 1}],
    tests:bundle.generated_tests.map(test=>({artifact_id:test.id,test_case_id:test.test_case_id,test_name:'soma',status,observed:status==='passed' ? 'Fixture: assert sem falha.' : 'Fixture: expected 5, observed 4.'})),
    stdout:'Fixture técnica, não execução real.',stderr:'',framework_reports:[],limitations:['Fixture técnica da plataforma; não é evidência experimental.']};
}
