import {randomUUID} from 'node:crypto';
import {assert} from './errors.js';
import {sha256,validateBundle} from '../../../shared/execution-protocol.js';

export function buildExecutionBundles({runId,scope,entries,groups}) {
  assert(entries.length>0 && entries.length<=200,'Plano requer entre 1 e 200 scripts aprovados compatíveis.',422);
  assert(new Set(entries.map(e=>e.script.id)).size===entries.length && new Set(entries.map(e=>e.script.test_case_id)).size===entries.length,'Script/caso repetido no plano.',422);
  const allSources=new Map();for(const entry of entries)for(const file of entry.scope.files){const previous=allSources.get(file.path);assert(!previous || previous===file.sha256,'Fontes de scripts divergem no mesmo caminho.',422);allSources.set(file.path,file.sha256);}
  const make=items=>{
    const sources=new Map();
    for(const {scope:original} of items){assert(original.commit_sha===scope.commit_sha && original.module.adapter===scope.module.adapter,'Escopo do script diverge da autorização.',422);
      for(const file of original.files){const previous=sources.get(file.path);assert(!previous || previous.sha256===file.sha256,'Fontes de scripts divergem no mesmo caminho.',422);sources.set(file.path,file);}}
    return {protocol_version:1,job_id:randomUUID(),run_id:runId,repository_url:scope.repository_url,commit_sha:scope.commit_sha,adapter:scope.module.adapter,
      source_files:[...sources.values()].map(({path,content,git_sha,sha256})=>({path,content,git_sha,sha256})),
      generated_tests:items.map(({script,files})=>({id:script.id,test_case_id:script.test_case_id,version:script.version,files:files.map(file=>({...file,sha256:sha256(file.code)}))}))};
  };
  const validate=items=>{const bundle=make(items);try{validateBundle(bundle);}catch(error){assert(false,`Bundle inválido: ${error.message}`,422);}return bundle;};
  if(groups) {
    assert(Array.isArray(groups),'Agrupamentos devem ser uma lista.',422);const ids=groups.flat();assert(groups.length>0 && groups.length<=200 && groups.every(g=>Array.isArray(g)&&g.length>0) && ids.length===entries.length && new Set(ids).size===ids.length && entries.every(e=>ids.includes(e.script.id)),'Agrupamento deve conter cada script aprovado exatamente uma vez.',422);
    return groups.map(ids=>validate(ids.map(id=>entries.find(e=>e.script.id===id))));
  }
  const bundles=[];let current=[];
  for(const entry of entries){validate([entry]);const candidate=[...current,entry];try{validateBundle(make(candidate));current=candidate;}catch{assert(current.length,'Script não cabe em um bundle.',422);bundles.push(validate(current));current=[entry];}}
  if(current.length)bundles.push(validate(current));return bundles;
}
