import {assert} from './errors.js';
import {safePath} from './inspection.js';
import {buildScope,validateAutomation} from './automation-contract.js';
import {createAgentToolRegistry} from './agent-tools.js';
import {AUTOMATION_AGENT} from './agent-contract.js';
import {automationDeclarations} from './automation-agent-bindings.js';

export function createAutomationAgentTools({input,inspection,store,maxObservationChars=12000,definition=AUTOMATION_AGENT}) {
  assert(inspection.commit_sha===input.scope.commit_sha && inspection.repository_url===input.scope.repository_url,'Inspeção diverge da versão da tarefa.',409);
  const root=input.scope.module.root;
  assert(inspection.modules.some(module=>module.root===root && module.adapter===input.scope.module.adapter),'Módulo fora da inspeção.',409);
  const files=inspection.files.filter(file=>{
    if(root && !file.path.startsWith(root+'/'))return false;
    const owner=inspection.modules.filter(module=>!module.root || file.path.startsWith(module.root+'/')).sort((a,b)=>b.root.length-a.root.length)[0];
    return owner?.root===root && (file.role==='source' || /(?:^|\/)(?:package\.json|pom\.xml)$/.test(file.path));
  });
  const task={case_ids:input.test_cases.map(row=>row.id),requirement_codes:input.requirements.map(row=>row.code),...(definition.case_binding?{case_binding:definition.case_binding}:{})};
  const scopes=new Map();
  const metadata=file=>({path:file.path,sha256:file.sha256,role:file.role,symbols:file.symbols ?? null,characters:file.content.length});
  async function prepare(target_paths) {
    assert(target_paths.every(path=>files.some(file=>file.path===path)),'Fonte fora do módulo autorizado.',403);
    const scope=buildScope(inspection,root,target_paths);
    assert(scope.files.every(file=>files.some(allowed=>allowed.path===file.path)),'Dependência fora do módulo autorizado.',403);
    const ref=await store.put(scope);scopes.set(ref.sha256,{scope,ref});
    return {state:{scope_ref:ref},observation:{scope_id:ref.sha256,scope_ref:ref,commit_sha:scope.commit_sha,target_paths:scope.target_paths,
      files:scope.files.map(file=>({path:file.path,sha256:file.sha256})),limitations:scope.limitations.slice(0,10).map(s=>s.slice(0,150)),
      limitations_truncated:scope.limitations.length>10 || scope.limitations.some(s=>s.length>150)}};
  }
  const handlers={
    list_sources:async({offset,limit})=>({observation:{files:files.slice(offset,offset+limit).map(metadata),total:files.length,next_offset:offset+limit<files.length?offset+limit:null,inspection_omissions:inspection.omitted ?? []}}),
    read_source:async({path,offset,length})=>{
      safePath(path);const file=files.find(file=>file.path===path);assert(file,'Fonte fora do módulo autorizado.',403);
      assert(offset<=file.content.length,'Offset excede a fonte consultada.',422);
      const end=Math.min(offset+length,file.content.length);
      return {observation:{path,sha256:file.sha256,offset,end,total_characters:file.content.length,truncated:end<file.content.length,content:file.content.slice(offset,end)}};
    },
    find_symbols:async({query})=>{
      const found=[];
      for(const file of files)for(const kind of ['exports','classes','methods'])for(const name of file.symbols?.[kind] || [])
        if(name.toLowerCase().includes(query.toLowerCase()))found.push({path:file.path,name,kind});
      return {observation:{matches:found.slice(0,50),total:found.length,truncated:found.length>50}};
    },
    get_approved_case:async({case_id})=>({observation:{...input.test_cases.find(row=>row.id===case_id),generated_path:input.generated_paths.find(row=>row.test_case_id===case_id)}}),
    get_approved_requirement:async({requirement_code})=>({observation:input.requirements.find(row=>row.code===requirement_code)}),
    get_adapter_capabilities:async()=>({observation:{capability_version:'1.0.0',adapter:input.scope.module.adapter,
      restrictions:input.scope.module.restrictions,max_scripts_per_bundle:20,max_source_files_per_bundle:16,
      runtime_readiness:'not_checked',execution_available_to_agent:false}}),
    prepare_automation_scope:async({target_paths})=>prepare(target_paths),
    submit_automation:async({scope_id,output})=>{
      const prepared=scopes.get(scope_id);
      assert(!output.artifacts.length || prepared,'Escopo não preparado nesta sessão.',422);
      const effectiveInput={...input,scope:prepared?.scope ?? input.scope};
      validateAutomation(output,effectiveInput);
      return {observation:{accepted:true,artifacts:output.artifacts.length,unsupported_cases:output.unsupported_cases.length,requires_human_review:true},
        terminal:{output,input:effectiveInput,scope_ref:prepared?.ref ?? null}};
    },
  };
  return {task,declarations:automationDeclarations(input,definition),execute:createAgentToolRegistry({task,handlers,maxObservationChars}),
    async restore(observation) {
      if(observation?.scope_ref) {
        const scope=await store.json(observation.scope_ref);
        assert(scope.commit_sha===inspection.commit_sha && scope.module.root===root && scope.files.every(file=>files.some(f=>f.path===file.path && f.sha256===file.sha256)),'Escopo restaurado fora da tarefa.',409);
        scopes.set(observation.scope_ref.sha256,{scope,ref:observation.scope_ref});
      }
    }};
}
