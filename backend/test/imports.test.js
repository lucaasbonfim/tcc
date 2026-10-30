import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRepository, resolveRepository } from '../src/research/github.js';
import { createArtifactStore } from '../src/research/artifacts.js';
import { extractDocument } from '../src/research/documents.js';

test('GitHub rejeita SSRF, credenciais, caminhos extras e normaliza .git', () => {
  for (const value of ['http://github.com/a/b','https://127.0.0.1/a/b','https://github.com.evil.test/a/b','https://user@github.com/a/b','https://github.com/a/b/tree/main','https://github.com/a/b?q=x','https://github.com:8080/a/b']) {
    assert.throws(() => parseRepository(value), value);
  }
  assert.equal(parseRepository('https://github.com/a/b.git/').url, 'https://github.com/a/b');
});

test('GitHub resolve SHA com timeout, sem redirecionar nem enviar credenciais', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url,options});
    return new Response(JSON.stringify(calls.length === 1 ? { private:false, default_branch:'main' } : { sha:'a'.repeat(40) }));
  };
  const version = await resolveRepository('https://github.com/a/b','feature/test',fetcher);
  assert.equal(version.commit_sha,'a'.repeat(40));
  assert.ok(calls[1].url.endsWith('feature%2Ftest'));
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await assert.rejects(resolveRepository('https://github.com/a/b','main',async () => new Response('', { status:404 })), /não encontrado/);
  await assert.rejects(resolveRepository('https://github.com/a/b','main',async () => new Response(JSON.stringify({private:true}))), /públicos/);
});

test('artefatos verificam hash e rejeitam travessia de diretórios', async () => {
  const root = await mkdtemp(join(tmpdir(),'tcc-artifacts-'));
  const store = createArtifactStore(root);
  try {
    const ref = await store.put({ hello:'pesquisa' });
    assert.deepEqual(await store.json(ref), { hello:'pesquisa' });
    await assert.rejects(store.read({ key:'../.env' }), /inválida/);
    await writeFile(join(root,ref.key),'alterado');
    await assert.rejects(store.read(ref), /Integridade/);
  } finally { await rm(root, { recursive:true, force:true }); }
});

export function samplePdf(content = 'O sistema deve autenticar o pesquisador.') {
  const stream = `BT /F1 12 Tf 30 100 Td (${content}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(body)); body += `${index+1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(body);
}

test('extrai PDF real com página e alerta de limitações; rejeita PDF inválido', async () => {
  const result = await extractDocument(samplePdf(),'requisitos.pdf','application/pdf');
  assert.equal(result.pages[0].page, 1);
  assert.match(result.pages[0].text, /autenticar o pesquisador/);
  assert.ok(result.warnings.some(w => w.includes('OCR')));
  const empty = await extractDocument(samplePdf(''),'scan.pdf','application/pdf');
  assert.ok(empty.warnings.some(w => w.includes('sem camada')));
  await assert.rejects(extractDocument(Buffer.from('invalid'),'bad.pdf','application/pdf'), /PDF inválido/);
  await assert.rejects(extractDocument(Buffer.from('%PDF-broken'),'broken.pdf','application/pdf'), /não pôde/);
});

test('texto UTF-8 e limites de importação', async () => {
  assert.equal((await extractDocument(Buffer.from('Regra de negócio'),'regra.md','text/markdown')).pages[0].text, 'Regra de negócio');
  await assert.rejects(extractDocument(Buffer.from([0xff]),'bad.txt','text/plain'), /UTF-8/);
  await assert.rejects(extractDocument(Buffer.from('oi'),'../bad.txt','text/plain'), /Nome/);
  await assert.rejects(extractDocument(Buffer.alloc(10485761),'large.txt','text/plain'), /10 MiB/);
});
