import {buildScope} from './automation-contract.js';
import {assert} from './errors.js';

export function planModuleScopes(inspection,root,targetPaths) {
  const module=inspection.modules.find(item=>item.root===root);
  assert(module,'Módulo não encontrado na inspeção.',422);
  const targets=targetPaths ?? module.targets;
  assert(Array.isArray(targets) && targets.length<=512 && new Set(targets).size===targets.length && targets.every(path=>module.targets.includes(path)),'Seleção de fontes inválida para este módulo.',422);
  const scopes=[],excluded=[],eligible=[];let group=[];
  const belongs=file=>{
    const owner=inspection.modules.filter(item=>item.adapter===module.adapter && (!item.root || file.path.startsWith(item.root+'/'))).sort((a,b)=>b.root.length-a.root.length)[0];
    return owner?.root===module.root;
  };
  const sources=inspection.files.filter(file=>file.role==='source' && file.symbols && belongs(file));
  if(targetPaths===undefined)for(const file of sources.filter(file=>!module.targets.includes(file.path)))excluded.push({path:file.path,
    reason:file.symbols.requires_gui ? 'Interface gráfica Swing/AWT: leitura disponível, execução não suportada pelo adaptador headless.' : file.symbols.requires_database ? 'Dependência de banco de dados: leitura disponível, ambiente não provisionado pelo adaptador.' : 'Fonte sem API compatível com este adaptador.'});
  for(const path of targets) {
    try{buildScope(inspection,root,[path]);}
    catch(error){if(error.statusCode!==422)throw error;excluded.push({path,reason:error.message});continue;}
    eligible.push(path);
    if(group.length) {
      try{buildScope(inspection,root,[...group,path]);}
      catch(error){if(error.statusCode!==422)throw error;scopes.push(buildScope(inspection,root,group));group=[];}
    }
    group.push(path);
  }
  if(group.length)scopes.push(buildScope(inspection,root,group));
  return {scopes,summary:{mode:targetPaths===undefined ? 'module' : 'selected',module_root:root,scope_count:scopes.length,
    source_count:sources.length,eligible_target_paths:eligible,excluded,
    scope_targets:scopes.map((scope,index)=>({index,target_paths:scope.target_paths,source_paths:scope.files.map(file=>file.path)})),
    inspection_omissions:inspection.omitted,
    limitation:'Todos os arquivos inspecionados do módulo são considerados no planejamento. Somente fechamentos compatíveis podem gerar testes executáveis; isso não garante cobertura completa do projeto.'}};
}
