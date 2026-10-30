import { assert, fail, text } from './errors.js';

export function parseRepository(value) {
  const input = text(value, 'Repositório', 300, true);
  let url;
  try { url = new URL(input); } catch { fail(400, 'Informe uma URL HTTPS pública do GitHub.'); }
  assert(url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash,
    'Use https://github.com/proprietario/repositorio, sem credenciais ou parâmetros.');
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  assert(match && !['.', '..'].includes(match[1]) && !['.', '..'].includes(match[2]), 'Caminho de repositório inválido.');
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  assert(repo && !['.', '..'].includes(repo), 'Nome de repositório inválido.');
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

export async function githubJson(path, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.github.com/repos/${path}`, {
    redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tcc-research-platform', 'X-GitHub-Api-Version': '2022-11-28' },
  }).catch(() => fail(502, 'Não foi possível acessar o GitHub no prazo.'));
  if (response.status === 404) fail(422, 'Repositório público ou referência não encontrado no GitHub.');
  if ([403,429].includes(response.status)) fail(503, 'GitHub recusou o acesso ou atingiu o limite público. Tente mais tarde.');
  assert(response.ok, 'Falha ao consultar o GitHub.', 502);
  let size = 0;
  const parts = [];
  for await (const part of response.body) {
    size += part.length;
    if (size > 512000) { await response.body.cancel().catch(() => {}); fail(422, 'Resposta do GitHub excede o limite.'); }
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(502, 'Resposta inválida do GitHub.'); }
}

export async function resolveRepository(repositoryUrl, requestedRef, fetchImpl = fetch) {
  const repository = parseRepository(repositoryUrl);
  const prefix = `${repository.owner}/${repository.repo}`;
  const metadata = await githubJson(prefix, fetchImpl);
  assert(metadata.private === false && !metadata.disabled, 'Somente repositórios públicos acessíveis são aceitos.', 422);
  const ref = text(requestedRef, 'Branch, tag ou commit', 255) || metadata.default_branch;
  assert(typeof ref === 'string' && ref.length > 0 && !/[\x00-\x20\x7f]/.test(ref), 'Referência de código inválida.');
  const commit = await githubJson(`${prefix}/commits/${encodeURIComponent(ref)}`, fetchImpl);
  assert(typeof commit.sha === 'string' && /^[a-f0-9]{40}$/.test(commit.sha), 'GitHub não retornou um SHA válido.', 502);
  return { repository_url: repository.url, requested_ref: ref, commit_sha: commit.sha,
    inspection: { status: 'not_inspected', execution_enabled: false, reason: 'Código não clonado nem executado. Inspeção técnica disponível por adaptador.' } };
}
