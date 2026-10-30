// Controlled fixtures, never academic evidence or generated VVV scenarios.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {containerArguments,docker,executeContainer} from '../src/docker.js';
import {sha256} from '../../shared/execution-protocol.js';

const image=process.env.EXECUTOR_SMOKE_IMAGE;
assert.match(image || '',/^sha256:[a-f0-9]{64}$/,'Set EXECUTOR_SMOKE_IMAGE to the Java image ID.');
const name=`research-${randomUUID()}`;let probe;
try {
  assert.equal((await docker(containerArguments(name,image,'/opt/research/probe.mjs'))).code,0);
  const result=await docker(['start','-a',name],{timeout:20000});assert.equal(result.code,0,result.stderr);
  probe=JSON.parse(result.stdout);assert(Object.values(probe.checks).every(Boolean));assert(probe.javac_version && probe.junit_version);
}finally{assert.equal((await docker(['rm','-f',name])).code,0);}
const scenarios=[
  {name:'passed',body:'@Test void sum(){assertEquals(5,new Calculator().sum(2,3));}',expected:'passed'},
  {name:'assertion_failure',body:'@Test void sum(){assertEquals(6,new Calculator().sum(2,3));}',expected:'failed'},
  {name:'compilation_error',body:'@Test void sum(){assertEquals(5,new Calculator().missing());}',expected:'compilation_error'},
  {name:'test_error',body:'@Test void sum(){throw new IllegalStateException("controlled fixture");}',expected:'test_error'},
  {name:'disabled',body:'@Disabled @Test void sum(){assertEquals(5,new Calculator().sum(2,3));}',expected:'skipped'},
  {name:'no_test',body:'void sum(){assertEquals(5,new Calculator().sum(2,3));}',expected:'inconclusive'},
  {name:'exit_zero_is_not_pass',body:'@Test void sum(){System.exit(0);}',expected:'inconclusive'},
];
const content='package sample; public class Calculator {public int sum(int a,int b){return a+b;}}';
const bundle={protocol_version:1,job_id:randomUUID(),run_id:randomUUID(),repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40),adapter:'java-junit/v1',
  source_files:[{path:'src/main/java/sample/Calculator.java',content,sha256:sha256(content),git_sha:createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex')}],
  generated_tests:scenarios.map(scenario=>{
    const id=randomUUID(),test_case_id=randomUUID(),className='Research'+test_case_id.replaceAll('-','');
    const code=`import org.junit.jupiter.api.Test;import org.junit.jupiter.api.Disabled;import static org.junit.jupiter.api.Assertions.*;import sample.Calculator;public class ${className}{${scenario.body}}`;
    return {id,test_case_id,version:1,files:[{path:`__research_generated__/${className}.java`,code,sha256:sha256(code)}]};
  })};
const result=await executeContainer(bundle,image);
assert.equal(result.status,'reported');
for(let index=0;index<scenarios.length;index++) {
  const scenario=scenarios[index],rows=result.report.tests.filter(row=>row.artifact_id===bundle.generated_tests[index].id);
  assert(rows.length && rows.every(row=>row.status===scenario.expected),JSON.stringify({scenario:scenario.name,rows}));
  console.log(JSON.stringify({scenario:scenario.name,status:'ok',expected:scenario.expected}));
}
assert.notEqual((await docker(['container','inspect',`research-${bundle.job_id}`])).code,0);
const report={purpose:'Controlled Java Docker fixtures; not VVV coverage or academic evidence',probe,image,scenarios,result,container_removed:true};
if(process.env.EXECUTOR_SMOKE_REPORT){const path=resolve(process.env.EXECUTOR_SMOKE_REPORT);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:Object.keys(probe.checks).length,scenarios:scenarios.length,status:'ok'}));
