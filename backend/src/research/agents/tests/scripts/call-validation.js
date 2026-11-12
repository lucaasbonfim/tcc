import {assert} from '../../../shared/errors.js';
import {validateShape} from '../../../shared/validation.js';
import {AUTOMATION_AGENT_TOOLS} from './definition.js';

export function validateAgentCall(call,task) {
  assert(call && typeof call==='object' && typeof call.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);
  const definition=AUTOMATION_AGENT_TOOLS.find(t=>t.name===call.name);
  assert(definition,'Ferramenta desconhecida ou não permitida.',403);
  // validateShape requires non-empty strings, except the explicitly empty terminal scope.
  const args=call.name==='submit_automation' && call.args?.scope_id==='' ? {...call.args,scope_id:'no-scripts'} : call.args;
  validateShape(args,definition.parameters,'argumentos');
  if(call.name==='submit_automation') {
    assert(call.args.scope_id!=='' || !call.args.output.artifacts.length,'Scripts exigem escopo preparado.',422);
    const ids=[...call.args.output.artifacts,...call.args.output.unsupported_cases].map(item=>item.test_case_id);
    const valid=ids.length===task.case_ids.length && new Set(ids).size===ids.length && ids.every(id=>task.case_ids.includes(id));
    const detail=task.case_binding==='exact-id/v1'?` Use test_case_id exatamente como fornecido, mantendo os hífens. O nome do arquivo compacta o UUID apenas no caminho. Esperados: ${JSON.stringify(task.case_ids)}. Recebidos: ${JSON.stringify(ids.slice(0,20))}.` : '';
    assert(valid,'Submissão omitiu, duplicou ou referenciou caso fora da tarefa.'+detail,422);
  }
  if(call.name==='get_approved_case')assert(task.case_ids.includes(call.args.case_id),'Caso fora da tarefa.',403);
  if(call.name==='get_approved_requirement')assert(task.requirement_codes.includes(call.args.requirement_code),'Requisito fora da tarefa.',403);
  return definition;
}
