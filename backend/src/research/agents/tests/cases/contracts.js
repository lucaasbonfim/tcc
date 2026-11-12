import {assert} from '../../../errors.js';
import {validateShape} from '../../../shared/validation.js';

const string = { type: 'string' };
const strings = { type: 'array', items: string, maxItems: 50 };
const object = properties => ({ type:'object', properties, required:Object.keys(properties), additionalProperties:false });
const array = (items, maxItems = 100, minItems = 0) => ({ type:'array', items, minItems, maxItems });
const enumeration = values => ({ type:'string', enum:values });
const source = object({ document_id:string, page:{type:'integer',minimum:1,maximum:200}, quote:string });
export const testCaseSchema = object({
  code:string, title:string, objective:string, requirement_codes:array(string,50,1), preconditions:strings,
  input_data:strings, steps:array(string,50,1), expected_result:string,
  scenario:enumeration(['positive','negative','alternative','boundary']),
  automation:object({ feasibility:enumeration(['manual_only','needs_inspection']), rationale:string }),
});
export const testsOutputSchema = object({ test_cases:array(testCaseSchema,200,1), warnings:strings });

export function validateTestCase(value, requirements) {
  validateShape(value,testCaseSchema);
  assert(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(value.code), 'Código de caso inválido.', 422);
  const codes = new Set(requirements.map(item => item.code));
  assert(new Set(value.requirement_codes).size === value.requirement_codes.length && value.requirement_codes.every(code => codes.has(code)), 'Caso referencia requisito não aprovado ou inexistente.', 422);
  return value;
}
