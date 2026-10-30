import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../../src/research/migrate.js';
import { createArtifactStore } from '../../src/research/artifacts.js';
import { createProjectService } from '../../src/research/projects.js';

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith('/tcc_test_')) throw new Error('Utilize banco separado tcc_test_.');
test('projeto mantém versões de código/documentos e metadados íntegros', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString:url });
  const directory = await mkdtemp(join(tmpdir(),'tcc-project-'));
  const store = createArtifactStore(directory);
  const resolveCode = async (repository_url,requested_ref) => ({ repository_url,requested_ref,commit_sha:'a'.repeat(40),inspection:{} });
  const service = createProjectService({ pool,store,resolveCode });
  try {
    await migrate(pool);
    const input = { name:'Projeto de integração',repository_url:'https://github.com/example/repo',requested_ref:'main' };
    const project = await service.create(input);
    const first = await service.addDocument(project.id,Buffer.from('Autenticar pesquisador.'),'requisitos.txt','text/plain');
    const second = await service.addDocument(project.id,Buffer.from('Autenticar com senha.'),'requisitos.txt','text/plain');
    assert.equal(first.version,1);
    assert.equal(second.version,2);
    await service.update(project.id,{ ...input,requested_ref:'v2' });
    const detail = await service.detail(project.id);
    assert.equal(detail.versions.length,2);
    assert.equal(detail.documents.length,2);
    assert.equal((await service.document(project.id,first.id)).pages[0].text,'Autenticar pesquisador.');
    await assert.rejects(service.create({ ...input,name:'' }), /Nome/);
  } finally { await pool.end(); await rm(directory,{recursive:true,force:true}); }
});
