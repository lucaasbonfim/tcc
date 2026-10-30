import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {executionFixture} from '../../shared/execution-fixture.js';
import {readBundle,sha256} from '../../shared/execution-protocol.js';

test('bundle por linha termina sem EOF e preserva UTF-8 dividido entre chunks',async()=>{
  const bundle=executionFixture();
  const file=bundle.generated_tests[0].files[0];file.code+='// verificação';file.sha256=sha256(file.code);
  const body=Buffer.from(JSON.stringify(bundle)+'\n'),split=body.indexOf(Buffer.from('ç'))+1;
  let closed=false;
  async function* chunks(){try{yield body.subarray(0,split);yield body.subarray(split);throw new Error('Não deve aguardar EOF');}finally{closed=true;}}
  assert.deepEqual(await readBundle(chunks()),bundle);assert.equal(closed,true);
});

test('entrada do contêiner recusa volume excessivo e bundle adulterado',async()=>{
  await assert.rejects(readBundle(Readable.from([Buffer.alloc(1048578,32)])),/Bundle too large/);
  const bundle=executionFixture();bundle.source_files[0].content='adulterado';
  await assert.rejects(readBundle(Readable.from([JSON.stringify(bundle)+'\n'])),/hash/);
});
