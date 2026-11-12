import {posix} from 'node:path';
import {assert} from '../shared/errors.js';
import {safePath} from './inspection.js';

export const BUILTINS=new Set(['node:path','node:url','node:util','node:events','node:buffer','node:crypto','node:assert','node:assert/strict']);
export function buildScope(inspection, moduleRoot, targetPaths) {
  const module=inspection.modules?.find(m=>m.root===moduleRoot);
  assert(module,'Módulo não encontrado na inspeção.',422);
  assert(['node-test/v2','java-junit/v1'].includes(module.adapter),'Adaptador não suportado.',422);
  assert(Array.isArray(targetPaths) && targetPaths.length>0 && targetPaths.length<=8 && new Set(targetPaths).size===targetPaths.length,'Selecione entre 1 e 8 fontes distintas.',422);
  const selected=new Map();
  const sources=inspection.files.filter(f=>f.role==='source' && (!module.root || f.path.startsWith(`${module.root}/`)));
  function add(path) {
    safePath(path);
    if(selected.has(path))return;
    const file=sources.find(f=>f.path===path);
    assert(file,'Dependência local não inspecionada ou teste antigo selecionado: '+path,422);
    assert(selected.size<12,'Fechamento de fontes excede 12 arquivos.',422);
    selected.set(path,file);
    if(module.adapter==='node-test/v2') {
      assert(file.symbols && !file.symbols.parse_error && /\.[cm]?js$/.test(path),'Fonte Node não compatível: '+path,422);
      for(const dependency of file.symbols.imports) {
        if(BUILTINS.has(dependency))continue;
        assert(dependency.startsWith('.'),'Dependência externa/dinâmica não provisionada: '+dependency,422);
        const resolved=posix.normalize(posix.join(posix.dirname(path),dependency));
        const found=[resolved,`${resolved}.js`,`${resolved}.mjs`,`${resolved}.cjs`,`${resolved}/index.js`].find(p=>sources.some(f=>f.path===p));
        assert(found,'Import local não inspecionado: '+dependency,422);add(found);
      }
    } else {
      assert(file.symbols?.classes?.length && !file.symbols.requires_gui && !file.symbols.requires_database,'Classe depende de GUI/banco: '+path,422);
      for(const dependency of file.symbols.imports) {
        if(/^java\.(?:lang|util|time|math)\./.test(dependency))continue;
        const found=sources.find(f=>f.symbols?.classes?.some(c=>`${f.symbols.package}.${c}`===dependency));
        assert(found,'Biblioteca Java não provisionada ou import não suportado: '+dependency,422);add(found.path);
      }
      // Resolve também tipos do mesmo pacote, sem acionar javac ou carregar classes.
      for(const other of sources.filter(f=>f.path!==path && f.symbols?.package===file.symbols.package)) {
        if(other.symbols.classes?.some(name=>new RegExp(`\\b${name}\\b`).test(file.content)))add(other.path);
      }
    }
  }
  for(const path of targetPaths) {assert(module.targets.includes(path),'Fonte não é candidata deste módulo: '+path,422);add(path);}
  const manifests=inspection.files.filter(f=>(f.path==='package.json' || f.path.endsWith('/package.json')) &&
    [...selected.values()].some(source=>f.path==='package.json' || source.path.startsWith(`${posix.dirname(f.path)}/`)));
  const files=[...selected.values(),...manifests.filter(f=>!selected.has(f.path))];
  assert(files.length<=16,'Escopo excede o limite de fontes/manifestos do executor.',422);
  assert(files.reduce((n,f)=>n+f.content.length,0)<=60000,'Contexto técnico excede 60 mil caracteres. Reduza o escopo.',422);
  return {inspection_version:inspection.inspection_version,commit_sha:inspection.commit_sha,repository_url:inspection.repository_url,module,
    target_paths:targetPaths,files,limitations:[...inspection.warnings,...module.restrictions,'Escopo selecionado, não representa cobertura integral do projeto.']};
}
