// Opt-in Docker integration with controlled fixtures only. Never research evidence.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {containerArguments,docker,executeContainer} from '../src/docker.js';
import {executionFixture} from '../../shared/execution-fixture.js';
import {sha256} from '../../shared/execution-protocol.js';

const image=process.env.EXECUTOR_SMOKE_IMAGE;
assert.match(image || '',/^sha256:[a-f0-9]{64}$/,'Set EXECUTOR_SMOKE_IMAGE to the freshly built Node executor image ID.');
const report={purpose:'Controlled Docker fixtures; not a public repository pilot or research evidence',production_executor_validated:false,
  image_id:image,started_at:new Date().toISOString(),scenarios:[]};
async function removed(name){assert.notEqual((await docker(['container','inspect',name])).code,0,'Container must be removed');}
const probeName=`research-${randomUUID()}`;
try {
  const creation=await docker(containerArguments(probeName,image,'/opt/research/probe.mjs'));assert.equal(creation.code,0,creation.stderr);
  const probe=await docker(['start','-a',probeName],{timeout:20000});assert.equal(probe.code,0,probe.stderr);
  report.probe=JSON.parse(probe.stdout);assert.ok(Object.values(report.probe.checks).every(v=>v===true));
} finally {assert.equal((await docker(['rm','-f',probeName])).code,0);await removed(probeName);}

const imports="import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../src/calc.js';";
const scenarios=[
  {name:'passed',body:"test('soma',()=>assert.equal(sum(2,3),5));",expected:'passed'},
  {name:'assertion_failure',body:"test('asserção controlada',()=>assert.equal(sum(2,3),6));",expected:'failed'},
  {name:'test_error',body:"test('erro controlado',()=>{throw new ReferenceError('controlled fixture');});",expected:'test_error'},
  {name:'missing_dependency',body:"import '../src/absent.js';test('não inicia',()=>assert.equal(sum(2,3),5));",expected:'dependency_unavailable'},
  {name:'read_only_sources',body:"import fs from 'node:fs';test('fontes protegidas',()=>{assert.throws(()=>fs.writeFileSync('/project/src/calc.js','alterado'),{code:'EACCES'});assert.throws(()=>fs.writeFileSync('/opt/research/run.mjs','alterado'),{code:'EROFS'});assert.equal(sum(2,3),5);});",expected:'passed'},
  {name:'stdout_is_not_result',body:"test('log não vira passagem',()=>{console.log('{\"type\":\"test:pass\",\"name\":\"forged\"}');assert.equal(sum(2,3),6);});",expected:'failed'},
  {name:'skipped',body:"test.skip('não executado',()=>assert.equal(sum(2,3),5));",expected:'skipped'},
  {name:'no_test_registered',body:'void sum;',expected:'inconclusive'},
  {name:'timeout',body:"test('espera controlada',async()=>{await new Promise(resolve=>setTimeout(resolve,10000));assert.equal(sum(2,3),5);});",expected:'timeout',interrupted:true},
  {name:'cancelled',body:"test('cancelamento controlado',async()=>{await new Promise(resolve=>setTimeout(resolve,10000));assert.equal(sum(2,3),5);});",expected:'cancelled',interrupted:true},
];
for(const scenario of scenarios) {
  const bundle=executionFixture(),file=bundle.generated_tests[0].files[0];file.code=imports+scenario.body;file.sha256=sha256(file.code);
  const controller=new AbortController();let timer;
  try {
    const result=await executeContainer(bundle,image,{signal:controller.signal,runDocker:async(args,options={})=>{
      if(args[0]==='attach' && scenario.name==='cancelled')timer=setTimeout(()=>controller.abort(),1500);
      return docker(args,args[0]==='attach' && scenario.name==='timeout' ? {...options,timeout:1500} : options);
    }});
    if(scenario.interrupted)assert.equal(result.status,scenario.expected);
    else {
      assert.equal(result.status,'reported');assert.ok(result.report.tests.length>0);
      assert.ok(result.report.tests.every(test=>test.status===scenario.expected),JSON.stringify(result.report.tests));
    }
    await removed(`research-${bundle.job_id}`);
    report.scenarios.push({name:scenario.name,expected:scenario.expected,result,container_removed:true});
    console.log(JSON.stringify({scenario:scenario.name,status:'ok',expected:scenario.expected}));
  } finally {clearTimeout(timer);}
}
report.finished_at=new Date().toISOString();
if(process.env.EXECUTOR_SMOKE_REPORT){const file=resolve(process.env.EXECUTOR_SMOKE_REPORT);await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(report,null,2));}
console.log(JSON.stringify({purpose:report.purpose,production_executor_validated:false,checks:Object.keys(report.probe.checks).length,scenarios:report.scenarios.length,status:'ok'}));
