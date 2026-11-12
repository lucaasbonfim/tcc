import {assert} from '../../errors.js';
import {validateShape} from '../../shared/validation.js';
import {validateOutput} from '../validation.js';
import {validatePart} from './parts.js';
import {resolveCitations} from './citations.js';
import {createAgentToolRegistry} from '../../runtime/tool-registry.js';

import {REQUIREMENTS_AGENT} from './definition.js';

export function createRequirementsAgentTools({input,schema,definition=REQUIREMENTS_AGENT,maxObservationChars=12000}) {
  assert(Array.isArray(input.source_catalog),'A1 requer catálogo de fontes fixado.',422);
  const catalog=input.source_catalog,read=new Set(),declarations=structuredClone(definition.tools);
  declarations.find(t=>t.name==='submit_requirements').parameters.properties.output=structuredClone(schema);
  const metadata=({quote,...item})=>({...item,characters:quote.length});
  const handlers={
    list_document_sources:async({offset,limit})=>({observation:{sources:catalog.slice(offset,offset+limit).map(source=>({...metadata(source),read:read.has(source.source_id)})),total:catalog.length,read_count:read.size,next_offset:offset+limit<catalog.length?offset+limit:null}}),
    read_document_sources:async({source_ids})=>{
      assert(new Set(source_ids).size===source_ids.length,'Fontes duplicadas na consulta.',422);
      const sources=source_ids.map(id=>{const source=catalog.find(s=>s.source_id===id);assert(source,'Fonte fora da tarefa.',403);return source;});
      const result={sources:[],remaining_source_ids:[...source_ids]};
      for(const source of sources){const next={sources:[...result.sources,source],remaining_source_ids:source_ids.slice(result.sources.length+1)};
        if(JSON.stringify(next).length>maxObservationChars)break;result.sources.push(source);result.remaining_source_ids.shift();}
      assert(result.sources.length>0,'Observação não comporta um trecho; revise os limites da tarefa.',422);
      result.sources.forEach(source=>read.add(source.source_id));return {observation:result,state:{read_source_ids:[...read]}};
    },
    submit_requirements:async({output})=>{
      assert(catalog.every(source=>read.has(source.source_id)),'Consulte todos os trechos atribuídos antes de submeter a análise.',422);
      const resolved=resolveCitations(output,input,schema);
      if(input.part)validatePart(resolved,input);else validateOutput('requirements',resolved,input);
      return {observation:{accepted:true,requirements:output.requirements.length,alerts:output.alerts.length,read_sources:read.size,requires_human_review:true},terminal:{output,input}};
    },
  };
  const validateCall=call=>{
    assert(typeof call?.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);
    const tool=declarations.find(t=>t.name===call.name);assert(tool,'Ferramenta não permitida para A1.',403);validateShape(call.args,tool.parameters,'argumentos');
  };
  return {declarations,task:{source_ids:catalog.map(s=>s.source_id),document_ids:input.documents.map(d=>d.id)},
    execute:createAgentToolRegistry({task:{},handlers,maxObservationChars,validateCall}),
    async restore(state){for(const id of state?.read_source_ids || []){assert(catalog.some(s=>s.source_id===id),'Fonte restaurada fora da tarefa.',409);read.add(id);}}};
}
