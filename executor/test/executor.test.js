import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {containerArguments,executeContainer} from '../src/docker.js';
import {createExecutionService,verifyRepositoryMembership} from '../src/service.js';
import {validateIsolation} from '../src/isolation.js';
import {validateBundle,validateExecutionResult,sha256} from '../../shared/execution-protocol.js';
import {executionFixture,fixtureResult} from '../../shared/execution-fixture.js';

test('contrato rejeita adulteração e comandos do usuário não entram no vetor Docker',()=>{
  const bundle=executionFixture();validateBundle(bundle);
  assert.throws(()=>validateBundle({...bundle,source_files:[{...bundle.source_files[0],content:'alterado'}]}),/hash/);
  const args=containerArguments(`research-${bundle.job_id}`,'sha256:'+'a'.repeat(64));
  for(const flag of ['--read-only','--cap-drop','--security-opt','--network','--pids-limit','--cpus','--memory','--memory-swap','--user','--tmpfs'])assert.ok(args.includes(flag));
  assert.equal(args.includes('--privileged'),false);assert.equal(args.some(arg=>arg.includes('docker.sock')),false);
  const result=fixtureResult(bundle);validateExecutionResult(result,bundle,sha256(bundle));
  assert.throws(()=>validateExecutionResult({...result,request_sha256:'x'},bundle,sha256(bundle)),/authorized/);
});
test('executor limpa container após timeout e nunca usa shell ou mount de host',async()=>{
  const calls=[],bundle=executionFixture();
  const result=await executeContainer(bundle,'sha256:'+'a'.repeat(64),{runDocker:async(args,options)=>{
    if(args[0]==='exec') {
      assert.deepEqual(args,['exec','--user','0:0','--workdir','/','-i',`research-${bundle.job_id}`,'/usr/local/bin/node','/opt/research/install.mjs']);
      assert.equal(options.input,JSON.stringify(bundle)+'\n');
    }
    calls.push(args);return args[0]==='attach' ? {code:null,terminated:true,stdout:'',stderr:''} : {code:0,terminated:false,stdout:'',stderr:''};
  }});
  assert.equal(result.status,'timeout');assert.deepEqual(calls.at(-1),['rm','-f',`research-${bundle.job_id}`]);
  assert.ok(calls.every(args=>!args.includes('sh') && !args.includes('-v') && !args.includes('--mount')));
  assert.equal(calls.some(args=>args[0]==='cp'),false);
});
test('isolamento recusa runtime sem rootless/cgroups e imagens não fixadas',async()=>{
  await assert.rejects(validateIsolation({dedicated_vm:true,deployment_id:'test-deployment',images:{}},{virtualization:'kvm',runDocker:async()=>({code:0,stdout:JSON.stringify({OSType:'linux',CgroupVersion:'1',SecurityOptions:[]})})}),/Rootless/);
  await assert.rejects(validateIsolation({dedicated_vm:false},{virtualization:'kvm'}),/Dedicated/);
});
test('origem Git é verificada independentemente pelo executor',async()=>{
  const bundle=executionFixture();
  await verifyRepositoryMembership(bundle,async()=>new Response(JSON.stringify({truncated:false,tree:bundle.source_files.map(f=>({path:f.path,sha:f.git_sha,type:'blob',mode:'100644'}))})));
  await assert.rejects(verifyRepositoryMembership(bundle,async()=>new Response(JSON.stringify({truncated:false,tree:[]}))),/not present/);
});
test('serviço autenticado: indisponibilidade, trabalho idempotente e evidência vinculada',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tcc-executor-')),token='test-token-for-executor-only-32-bytes';
  const status={ready:false,validated_at:new Date().toISOString(),deployment_id:'fixture-only',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{reference:'sha256:'+'b'.repeat(64),image_id:'sha256:'+'b'.repeat(64)}}};
  let calls=0;
  const service=createExecutionService({token,status,policy:{},root,verify:async()=>{},execute:async bundle=>{calls++;const report=fixtureResult(bundle);return {status:'reported',report};}});
  const server=createServer((req,res)=>service.handle(req,res));server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  try {
    assert.equal((await fetch(base+'/v1/health')).status,401);
    const bundle=executionFixture(),body=JSON.stringify({bundle,request_sha256:sha256(bundle)});
    assert.equal((await fetch(base+'/v1/jobs',{method:'POST',headers,body})).status,503);
    status.ready=true;
    assert.equal((await fetch(base+'/v1/jobs',{method:'POST',headers,body})).status,202);
    assert.equal((await fetch(base+'/v1/jobs',{method:'POST',headers,body})).status,202);
    let record;
    for(let i=0;i<50;i++){record=await (await fetch(base+`/v1/jobs/${bundle.job_id}`,{headers})).json();if(record.status==='finished')break;await new Promise(r=>setTimeout(r,5));}
    assert.equal(calls,1);validateExecutionResult(record.result,bundle,sha256(bundle));
  }finally{await service.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('falha de limpeza bloqueia trabalhos já enfileirados',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tcc-executor-stop-')),token='test-token-for-executor-only-32-bytes';
  const status={ready:true,validated_at:new Date().toISOString(),deployment_id:'fixture-only',images:{'node-test/v2':{reference:'sha256:'+'b'.repeat(64),image_id:'sha256:'+'b'.repeat(64)}}};
  let release,calls=0;
  const service=createExecutionService({token,status,policy:{},root,verify:async()=>{},execute:async()=>{calls++;await new Promise(resolve=>{release=resolve;});throw new Error('Container cleanup failed');}});
  const server=createServer((req,res)=>service.handle(req,res));server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const first=executionFixture(),second=executionFixture();
  const send=bundle=>fetch(base+'/v1/jobs',{method:'POST',headers,body:JSON.stringify({bundle,request_sha256:sha256(bundle)})});
  try {
    assert.equal((await send(first)).status,202);
    for(let i=0;!release && i<50;i++)await new Promise(r=>setTimeout(r,5));
    assert.equal((await send(second)).status,202);release();
    for(let i=0;status.ready && i<50;i++)await new Promise(r=>setTimeout(r,5));
    assert.equal(status.ready,false);assert.equal(calls,1);
    assert.equal((await (await fetch(base+`/v1/jobs/${second.job_id}`,{headers})).json()).status,'pending');
    assert.equal((await send(executionFixture())).status,503);
  }finally{await service.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
