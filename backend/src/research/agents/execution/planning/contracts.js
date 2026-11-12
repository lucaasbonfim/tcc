import {validateShape} from '../../../shared/validation.js';
import {buildExecutionBundles} from '../../../services/execution-plan.js';
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const string={type:'string'},list=(items,maxItems,minItems=0)=>({type:'array',items,maxItems,minItems});
export const EXECUTION_PLAN_SCHEMA=obj({groups:list(obj({script_ids:list(string,20,1),rationale:string}),200,1),rationale:string,limitations:list(string,30)});
export function validateExecutionProposal(output,input) {
  validateShape(output,EXECUTION_PLAN_SCHEMA);
  return buildExecutionBundles({...input,groups:output.groups.map(g=>g.script_ids)});
}
