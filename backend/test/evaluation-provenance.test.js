import test from 'node:test';
import assert from 'node:assert/strict';
import {executionFixture,fixtureResult} from '../../shared/execution-fixture.js';
import {sha256} from '../../shared/execution-protocol.js';
import {verifyEvaluationProvenance} from '../src/research/evaluation-provenance.js';

function sample() {
  const bundle=executionFixture(),executed=bundle.generated_tests[0],files_data=executed.files.map(({path,code})=>({path,code}));
  const script={...executed,revision:0,files:{sha256:sha256(files_data)},files_data};
  const job={id:bundle.job_id,run_id:bundle.run_id,plan_id:'plan',request_sha256:sha256(bundle)};
  return {runId:bundle.run_id,bundle,script,job,plan:{id:'plan',run_id:bundle.run_id,format_version:1},evidence:fixtureResult(bundle),
    result:{job_id:job.id,automated_test_id:script.id,test_case_id:script.test_case_id},
    manifest:{run_id:bundle.run_id,commit_sha:bundle.commit_sha,scripts:[{...script}],bundles:[{job_id:job.id,sha256:job.request_sha256,script_ids:[script.id]}]}};
}
test('A4 aceita somente o script exato vinculado ao bundle e manifesto executados',()=>{
  const input=sample();assert.equal(verifyEvaluationProvenance(input).request_sha256,input.job.request_sha256);
});
test('A4 recusa código posterior mesmo com a mesma versão e referência de arquivo',()=>{
  const input=sample();input.script.files_data[0].code+='\n// alteração posterior';
  assert.throws(()=>verifyEvaluationProvenance(input),/Código do script diverge/);
});
test('A4 recusa revisão alterada, troca de caso, evidência e manifesto divergentes',()=>{
  for(const change of [i=>i.script.revision++,i=>i.script.test_case_id='outro',i=>i.evidence.request_sha256='outro',i=>i.manifest.bundles[0].script_ids=[]]) {
    const input=sample();change(input);assert.throws(()=>verifyEvaluationProvenance(input));
  }
});
test('legado sem manifesto de revisão ainda exige código e versão do bundle',()=>{
  const input=sample();input.plan.format_version=0;input.manifest=input.bundle;
  verifyEvaluationProvenance(input);input.script.version++;assert.throws(()=>verifyEvaluationProvenance(input),/Versão do script diverge/);
});
