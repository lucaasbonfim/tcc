import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, exportCsv } from '../src/research/export.js';
import { inspectCodeVersion } from '../src/research/adapters.js';
import { repositoryFixture } from '../test-support/repository-fixture.js';

test('CSV escapa delimitadores e fórmulas e inclui todas as entidades', () => {
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  assert.equal(csvCell('=SUM(1)'), '"\'=SUM(1)"');
  const csv = exportCsv({id:'run',project_id:'project',status:'completed',model:'model',parameters:{},snapshot_data:{project:{},code_version:{},documents:[]},
    stages:[],attempts:[],requirements:[],test_cases:[],traceability:[],reviews:[]});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /payload_json/);
  assert.match(csv, /"run"/);
});

test('adaptador inspeciona árvore e blobs no SHA, sem habilitar execução', async () => {
  const fixture=repositoryFixture({'package.json':JSON.stringify({dependencies:{pg:'1'}}),'src/calc.js':'export const sum=(a,b)=>a+b;'});
  const inspection = await inspectCodeVersion({repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)},fixture.fetch);
  assert.equal(inspection.adapter,'node-test/v2');
  assert.equal(inspection.execution_enabled,false);
  assert.deepEqual(inspection.possible_service_dependencies,['pg']);
  assert.equal(fixture.requests.length,3);
  assert.match(fixture.requests[0].url,/a{40}\?recursive=1$/);
  assert.deepEqual(inspection.modules[0].targets,['src/calc.js']);
});
