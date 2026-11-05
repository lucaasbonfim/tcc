import {randomUUID} from 'node:crypto';
import {assert,text} from './errors.js';
import {appendRunEvent} from './run-events.js';

// Applies only to operational requests. Human review and code authorization never use this helper.
export function operationalReason(input,description) {
  assert(input.operation_record===undefined || input.operation_record==='system/v1','Origem do registro operacional inválida.',422);
  if(input.operation_record==='system/v1'){
    assert(input.justification===undefined,'Separe o registro operacional de uma justificativa humana.',422);
    return `[Registro operacional do sistema] ${description}`;
  }
  return text(input.justification,'Justificativa',5000,true);
}
export function recordOperation(db,{run_id,stage_id,operation,description,payload={}}) {
  return appendRunEvent(db,{run_id,stage_id,source_key:`operation:${randomUUID()}`,kind:'operation_requested',actor:'system',
    payload:{...payload,operation,description,requested_by:'researcher',justification_origin:'system',human_approval:false}});
}
