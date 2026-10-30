import { createHash } from 'node:crypto';
import { githubJson, parseRepository } from './github.js';
import { assert } from './errors.js';

// Inspeção declarativa: não clona, instala dependências, cria shell ou executa scripts.
export async function inspectCodeVersion(version, fetchImpl = fetch) {
  const repo = parseRepository(version.repository_url);
  assert(/^[a-f0-9]{40}$/.test(version.commit_sha),'Commit inválido.');
  const files = [];
  for (const name of ['package.json','pom.xml']) {
    try {
      const result = await githubJson(`${repo.owner}/${repo.repo}/contents/${name}?ref=${version.commit_sha}`,fetchImpl);
      assert(result.type === 'file' && result.encoding === 'base64' && result.size <= 100000,'Manifesto fora do limite de inspeção.',422);
      const content = Buffer.from(result.content,'base64');
      assert(content.length <= 100000,'Manifesto fora do limite.',422);
      files.push({name,content:content.toString('utf8'),sha256:createHash('sha256').update(content).digest('hex')});
    } catch (error) { if (error.statusCode !== 422 || !error.message.includes('não encontrado')) throw error; }
  }
  const node = files.find(file => file.name === 'package.json');
  let adapter = 'unsupported', stack = 'unknown', candidate = null, dependencies = [], reason = 'Nenhum manifesto raiz suportado foi encontrado. Monorepos e aplicações desktop exigem inspeção específica.';
  if (node) {
    let manifest;
    try { manifest = JSON.parse(node.content); } catch { assert(false,'package.json inválido.',422); }
    stack = 'node';
    dependencies = Object.keys(manifest.dependencies || {}).filter(name => /^(pg|mysql2?|mongoose|redis|ioredis|sqlite3|better-sqlite3)$/.test(name));
    if (manifest.scripts?.test === 'node --test') {
      adapter = 'node-built-in-test/v1';
      candidate = ['node','--test'];
      reason = 'Manifesto declara node --test. Candidato depende de revisão humana, imagem imutável, instalação controlada e executor isolado. Nada foi executado.';
    } else reason = 'Projeto Node identificado. Script test não corresponde ao adaptador limitado node --test; comandos declarados pelo projeto não são executados.';
  } else if (files.some(file => file.name === 'pom.xml')) {
    stack = 'java-maven';
    reason = 'Projeto Maven identificado. Adaptador Java/JUnit e requisitos gráficos/serviços ainda não suportados.';
  }
  return { inspected_at:new Date().toISOString(),commit_sha:version.commit_sha,stack,adapter,candidate_command:candidate,
    execution_enabled:false,status:'not_supported',reason,possible_service_dependencies:dependencies,
    manifests:files.map(({name,sha256}) => ({name,sha256})),limitations:['Inspeção limitada a manifestos na raiz, sem comprovar viabilidade.','Nenhum teste automatizado gerado ou executado.','Serviços externos e configuração precisam de revisão técnica.'] };
}
