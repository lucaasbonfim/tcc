import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutorClient} from '../src/research/executor-client.js';
import {executionFixture,fixtureResult} from '../../shared/execution-fixture.js';

test('cliente mantém execução fechada sem configuração ou com política divergente',async()=>{
  assert.equal((await createExecutorClient({}).health()).ready,false);
  const config={url:'https://executor.example.test',token:'a'.repeat(32),deployment:'fixture-deployment',policy:'b'.repeat(64)};
  const client=createExecutorClient(config,async()=>new Response(JSON.stringify({ready:true,protocol_version:1,deployment_id:'wrong'})));
  assert.equal((await client.health()).ready,false);
});
test('cliente vincula recibo, imagem e SHA e nunca envia credenciais de banco/IA',async()=>{
  const bundle=executionFixture(),config={url:'https://executor.example.test',token:'a'.repeat(32),deployment:'fixture-deployment',policy:'b'.repeat(64)};
  const receipt={ready:true,protocol_version:1,deployment_id:config.deployment,policy_sha256:config.policy,validated_at:new Date().toISOString(),limits:{network:'none',cpu:1,memory_bytes:268435456,pids:64,timeout_ms:60000},images:{'node-test/v2':{image_id:'sha256:'+'c'.repeat(64)}}};
  const result=fixtureResult(bundle);result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};
  const calls=[];
  const client=createExecutorClient(config,async(url,options)=>{
    calls.push({url:String(url),options});
    return new Response(JSON.stringify(String(url).endsWith('/health') ? receipt : options.method==='POST' ? {status:'pending'} : {status:'finished',result}));
  });
  assert.equal((await client.execute(bundle,receipt)).tests[0].status,'passed');
  const request=JSON.parse(calls.find(c=>c.options.method==='POST').options.body);
  assert.equal(request.bundle.job_id,bundle.job_id);
  assert.equal(request.GEMINI_API_KEY,undefined);
  result.environment.image_id='sha256:'+'d'.repeat(64);
  await assert.rejects(client.execute(bundle,receipt),/Ambiente/);
});
