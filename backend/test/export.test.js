import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, exportCsv } from '../src/research/export.js';
import { inspectCodeVersion } from '../src/research/adapters.js';

test('CSV escapa delimitadores e fórmulas e inclui todas as entidades', () => {
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  assert.equal(csvCell('=SUM(1)'), '"\'=SUM(1)"');
  const csv = exportCsv({id:'run',project_id:'project',status:'completed',model:'model',parameters:{},snapshot_data:{project:{},code_version:{},documents:[]},
    stages:[],attempts:[],requirements:[],test_cases:[],traceability:[],reviews:[]});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /payload_json/);
  assert.match(csv, /"run"/);
});

test('adaptador inspeciona somente manifestos permitidos no SHA, sem habilitar execução', async () => {
  const paths = [];
  const inspection = await inspectCodeVersion({repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)},async url => {
    paths.push(url);
    if (url.includes('/pom.xml')) return new Response('',{status:404});
    return new Response(JSON.stringify({type:'file',encoding:'base64',size:100,content:Buffer.from(JSON.stringify({scripts:{test:'node --test'},dependencies:{pg:'1'}})).toString('base64')}));
  });
  assert.equal(inspection.adapter,'node-built-in-test/v1');
  assert.equal(inspection.execution_enabled,false);
  assert.deepEqual(inspection.possible_service_dependencies,['pg']);
  assert.equal(paths.length,2);
  assert.ok(paths.every(path => path.endsWith('a'.repeat(40))));
});
