import {assert} from './errors.js';
import {validateAgentCall} from './agent-contract.js';

export function boundedObservation(value,maxChars) {
  const serialized=JSON.stringify(value);
  if(serialized.length<=maxChars)return value;
  const result={truncated:true,total_characters:serialized.length,excerpt:''};
  // JSON escaping can expand the excerpt; enforce the serialized limit as well.
  let length=Math.max(0,Math.floor((maxChars-150)/2));
  result.excerpt=serialized.slice(0,length);
  while(JSON.stringify(result).length>maxChars && length>0)result.excerpt=serialized.slice(0,--length);
  assert(JSON.stringify(result).length<=maxChars,'Limite de observação insuficiente.',422);
  return result;
}

export function createAgentToolRegistry({task,handlers,maxObservationChars}) {
  return async call=>{
    validateAgentCall(call,task);
    const handler=handlers[call.name];assert(handler,'Ferramenta não implementada.',403);
    const result=await handler(call.args);
    return {...result,observation:boundedObservation(result.observation,maxObservationChars)};
  };
}
