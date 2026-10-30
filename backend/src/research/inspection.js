import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { posix } from 'node:path';
import { githubJson, parseRepository } from './github.js';
import { assert } from './errors.js';

export const INSPECTION_LIMITS = Object.freeze({ maxFiles:24, maxFileBytes:30000, maxTotalBytes:240000, maxDepth:8, maxTreeEntries:5000,maxDurationMs:30000 });
export function safePath(path) {
  assert(typeof path==='string' && path.length<=240 && /^[A-Za-z0-9_./@-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(p=>!p || p==='.' || p==='..'), 'Caminho de código inválido.',422);
  return path;
}
export function javascriptSymbols(content) {
  let ast;
  try { ast=parse(content,{ecmaVersion:'latest',sourceType:'module'}); }
  catch { try {ast=parse(content,{ecmaVersion:'latest',sourceType:'script'});} catch {return {parse_error:true,exports:[],imports:[]};} }
  const exports=[],imports=[];
  function walk(node) {
    if (!node || typeof node!=='object') return;
    if (node.type==='ImportDeclaration' || node.type==='ExportAllDeclaration') imports.push(node.source.value);
    if (node.type==='ImportExpression') imports.push(node.source?.type==='Literal' ? node.source.value : '<dynamic>');
    if (node.type==='CallExpression' && node.callee?.name==='require') imports.push(node.arguments[0]?.type==='Literal' ? node.arguments[0].value : '<dynamic>');
    if (node.type==='ExportDefaultDeclaration') exports.push('default');
    if (node.type==='ExportNamedDeclaration') {
      if(node.source) imports.push(node.source.value);
      if(node.declaration?.id) exports.push(node.declaration.id.name);
      for(const item of node.declaration?.declarations || []) if(item.id?.name)exports.push(item.id.name);
      for(const item of node.specifiers || [])exports.push(item.exported.name);
    }
    if(node.type==='AssignmentExpression') {
      const lhs=node.left;
      if(lhs?.object?.name==='exports' && lhs.property?.name)exports.push(lhs.property.name);
      if(lhs?.object?.object?.name==='module' && lhs.object.property?.name==='exports')exports.push(lhs.property?.name);
      if(lhs?.object?.name==='module' && lhs.property?.name==='exports') {
        exports.push('default');
        for(const prop of node.right?.properties || []) if(prop.key?.name)exports.push(prop.key.name);
      }
    }
    for(const [key,value] of Object.entries(node)) if(key!=='start' && key!=='end') {
      if(Array.isArray(value))value.forEach(walk);else if(value && typeof value==='object')walk(value);
    }
  }
  walk(ast);
  return {parse_error:false,exports:[...new Set(exports.filter(Boolean))],imports:[...new Set(imports)]};
}

export function javaSymbols(content) {
  return {package:content.match(/\bpackage\s+([\w.]+)\s*;/)?.[1] || '',
    classes:[...content.matchAll(/\b(?:class|enum|record|interface)\s+(\w+)/g)].map(m=>m[1]),
    methods:[...content.matchAll(/\bpublic\s+(?:static\s+)?(?:[\w<>\[\].?,]+\s+)?(\w+)\s*\(/g)].map(m=>m[1]),
    imports:[...content.matchAll(/\bimport\s+(?:static\s+)?([\w.*]+)\s*;/g)].map(m=>m[1]),
    requires_gui:/\b(?:javax\.swing|java\.awt|JFrame|JDialog|JOptionPane)\b/.test(content),
    requires_database:/\b(?:java\.sql|javax\.sql|jdbc:|DriverManager|EntityManager)\b/.test(content)};
}

export async function inspectRepository(version, fetchImpl=fetch, limits=INSPECTION_LIMITS) {
  const started=Date.now();
  const repo=parseRepository(version.repository_url);
  assert(/^[a-f0-9]{40}$/.test(version.commit_sha),'Commit inválido.');
  const prefix=`${repo.owner}/${repo.repo}`;
  const tree=await githubJson(`${prefix}/git/trees/${version.commit_sha}?recursive=1`,fetchImpl);
  assert(Array.isArray(tree.tree),'Árvore GitHub inválida.',502);
  const warnings=[],omitted=[];
  if(tree.truncated || tree.tree.length>limits.maxTreeEntries)warnings.push('Árvore parcial: limite do GitHub/inspeção atingido. Escopo não representa o repositório inteiro.');
  const candidates=tree.tree.slice(0,limits.maxTreeEntries).filter(item=>item.type==='blob' &&
    /(?:^|\/)(?:package\.json|pom\.xml|[^/]+\.(?:[cm]?js|ts|java))$/.test(item.path));
  function priority(item) {
    if(/(?:^|\/)(?:package\.json|pom\.xml)$/.test(item.path))return 0;
    if(/(?:test|spec|view|DAO|controller|config|dist|build|target|node_modules)/i.test(item.path))return 3;
    return 1;
  }
  candidates.sort((a,b)=>priority(a)-priority(b) || a.path.localeCompare(b.path));
  const files=[];
  let total=0;
  for(const entry of candidates) {
    if(Date.now()-started>limits.maxDurationMs){omitted.push({path:entry.path,reason:'Prazo total de inspeção atingido.'});continue;}
    if(!/^(100644|100755)$/.test(entry.mode || '') || entry.path.split('/').length>limits.maxDepth || !Number.isInteger(entry.size) || entry.size>limits.maxFileBytes || files.length>=limits.maxFiles || total+entry.size>limits.maxTotalBytes) {
      omitted.push({path:entry.path,reason:'Limite de arquivos/bytes/profundidade ou arquivo não regular.'});continue;
    }
    try{safePath(entry.path);}catch{omitted.push({path:entry.path,reason:'Caminho não suportado.'});continue;}
    if(/(?:^|\/)(?:node_modules|target|dist|build|\.git)\//.test(entry.path))continue;
    const blob=await githubJson(`${prefix}/git/blobs/${entry.sha}`,fetchImpl);
    assert(blob.encoding==='base64' && typeof blob.content==='string','Blob GitHub inválido.',502);
    const buffer=Buffer.from(blob.content,'base64');
    assert(buffer.length===entry.size && buffer.length<=limits.maxFileBytes && total+buffer.length<=limits.maxTotalBytes,'Tamanho do blob diverge da árvore.',422);
    assert(createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex')===entry.sha,'Integridade do blob Git comprometida.',422);
    const content=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    total+=buffer.length;
    const role=/(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\./i.test(entry.path) ? 'existing_test' : 'source';
    const symbols=/\.[cm]?js$/.test(entry.path) ? javascriptSymbols(content) : /\.java$/.test(entry.path) ? javaSymbols(content) : null;
    files.push({path:entry.path,git_sha:entry.sha,sha256:createHash('sha256').update(buffer).digest('hex'),byte_size:buffer.length,content,role,symbols});
  }
  if(omitted.length)warnings.push(`${omitted.length} arquivos candidatos não foram lidos. Consulte a lista de omissões.`);
  const modules=[];
  for(const manifest of files.filter(f=>/(?:^|\/)(package\.json|pom\.xml)$/.test(f.path))) {
    const root=posix.dirname(manifest.path)==='.' ? '' : posix.dirname(manifest.path);
    const manifestName=manifest.path.endsWith('package.json') ? 'package.json' : 'pom.xml';
    const roots=files.filter(f=>f.path===manifestName || f.path.endsWith(`/${manifestName}`)).map(f=>posix.dirname(f.path)==='.' ? '' : posix.dirname(f.path));
    const inside=files.filter(f=>{
      if(root && !f.path.startsWith(`${root}/`))return false;
      const nearest=roots.filter(candidate=>!candidate || f.path.startsWith(`${candidate}/`)).sort((a,b)=>b.length-a.length)[0];
      return nearest===root;
    });
    if(manifest.path.endsWith('package.json')) {
      let pkg;
      try{pkg=JSON.parse(manifest.content);}catch{warnings.push(`Manifesto inválido: ${manifest.path}`);continue;}
      const deps=Object.keys(pkg.dependencies || {});
      modules.push({root,stack:'node',adapter:'node-test/v2',framework:deps.find(d=>['express','fastify','react','next'].includes(d)) || 'node',
        dependency_names:deps,possible_service_dependencies:deps.filter(d=>/^(pg|mysql2?|mongoose|redis|ioredis|sqlite3|better-sqlite3)$/.test(d)),
        targets:inside.filter(f=>f.role==='source' && f.symbols?.exports?.length && !f.symbols.parse_error).map(f=>f.path),
        restrictions:deps.length ? ['Dependências npm não são instaladas pelo adaptador offline. Somente fechamento de fontes locais/builtins é elegível.'] : [],module_type:pkg.type || 'commonjs'});
    } else {
      const deps=[...manifest.content.matchAll(/<artifactId>\s*([^<]+)\s*<\/artifactId>/g)].map(m=>m[1].trim());
      modules.push({root,stack:'java-maven',adapter:'java-junit/v1',framework:'JUnit (imagem provisionada)',dependency_names:deps,
        possible_service_dependencies:deps.filter(d=>/postgres|mysql|h2|hibernate|jdbc/i.test(d)),
        targets:inside.filter(f=>f.role==='source' && f.symbols?.classes?.length && !f.symbols.requires_gui && !f.symbols.requires_database).map(f=>f.path),
        restrictions:['Compilação restrita a classes selecionadas e dependências locais/JDK. Plugins Maven não executados.','Swing e banco não suportados no adaptador headless.']});
    }
  }
  return {inspection_version:'2.0.0',inspected_at:new Date().toISOString(),repository_url:version.repository_url,commit_sha:version.commit_sha,
    stack:modules.map(m=>m.stack).join(', ') || 'unknown',adapter:modules.length===1 ? modules[0].adapter : 'select_module',
    execution_enabled:false,status:modules.some(m=>m.targets.length) ? 'inspection_ready' : 'not_supported',
    reason:'Inspeção estática no SHA. Escolha módulo/arquivos para geração; execução requer executor validado e aprovação.',
    limits,total_bytes:total,tree_truncated:Boolean(tree.truncated || tree.tree.length>limits.maxTreeEntries),
    tree:tree.tree.slice(0,limits.maxTreeEntries).map(({path,type,size,mode})=>({path,type,size,mode})),files,modules,omitted,warnings,
    possible_service_dependencies:[...new Set(modules.flatMap(m=>m.possible_service_dependencies))],
    limitations:['Sem comandos, downloads de dependências ou modificação de fontes.','Símbolos estáticos exigem revisão; reflexão, imports dinâmicos, TypeScript e builds complexos têm suporte limitado.','Testes existentes são contexto/diagnóstico e não fazem parte da execução dos testes gerados.']};
}
