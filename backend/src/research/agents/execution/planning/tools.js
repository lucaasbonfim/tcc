import {validateExecutionProposal} from './contracts.js';
import {assert} from '../../../errors.js';
import {validateShape} from '../../../shared/validation.js';
import {createAgentToolRegistry} from '../../../agent-tools.js';
import {createRecordReader} from '../../../agent-records.js';

import {EXECUTION_PLANNING_AGENT} from './definition.js';

export function createExecutionPlanningTools({input,definition=EXECUTION_PLANNING_AGENT,maxObservationChars=12000}) {
  const reader=createRecordReader({records:input.entries.map(({script,scope,files,test_case})=>({id:script.id,data:{script:{id:script.id,version:script.version,revision:script.revision,content:script.content,files},test_case,source_files:scope.files.map(({path,sha256,content})=>({path,sha256,bytes:Buffer.byteLength(content)}))}})),maxObservationChars,idField:'script_id'});
  let capabilitiesRead=false;const declarations=structuredClone(definition.tools);
  const handlers={
    get_execution_capabilities:async()=>{capabilitiesRead=true;return {observation:{adapter:input.scope.module.adapter,commit_sha:input.scope.commit_sha,receipt:input.receipt,limits:{scripts_per_bundle:20,sources_per_bundle:16,bundle_bytes:1048576,max_scripts:200}},state:{execution_capabilities_read:true}};},
    list_execution_scripts:async({offset,limit})=>({observation:{scripts:input.entries.slice(offset,offset+limit).map(({script,scope})=>({id:script.id,test_case_id:script.test_case_id,version:script.version,revision:script.revision,source_paths:scope.files.map(f=>f.path),characters:reader.characters(script.id),read_complete:Boolean(reader.complete(script.id))})),total:input.entries.length,next_offset:offset+limit<input.entries.length?offset+limit:null}}),
    read_execution_script:async({script_id,offset,length})=>reader.read(script_id,offset,length),
    validate_execution_groups:async({groups})=>{const bundles=validateExecutionProposal({groups,rationale:'Validação técnica.',limitations:[]},input);return {observation:{valid:true,bundles:bundles.map((b,i)=>({sequence:i+1,scripts:b.generated_tests.length,sources:b.source_files.length,bytes:Buffer.byteLength(JSON.stringify(b))})),authorized:false}};},
    submit_execution_plan:async({output})=>{assert(capabilitiesRead,'Consulte as capacidades antes de submeter.',422);reader.assertComplete();const bundles=validateExecutionProposal(output,input);return {observation:{accepted:true,bundles:bundles.length,authorized:false,requires_human_review:true},terminal:{output,input}};},
  };
  const validateCall=call=>{assert(typeof call?.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);const tool=declarations.find(t=>t.name===call.name);assert(tool,'Ferramenta não permitida para A3.',403);validateShape(call.args,tool.parameters,'argumentos');};
  return {declarations,task:{script_ids:input.entries.map(e=>e.script.id)},execute:createAgentToolRegistry({task:{},handlers,maxObservationChars,validateCall}),async restore(state){if(state?.execution_capabilities_read)capabilitiesRead=true;await reader.restore(state);}};
}
