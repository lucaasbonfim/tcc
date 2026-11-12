import {assert} from '../../errors.js';
import {validateShape} from '../../shared/validation.js';

const string = { type: 'string' };
const strings = { type: 'array', items: string, maxItems: 50 };
const object = properties => ({ type:'object', properties, required:Object.keys(properties), additionalProperties:false });
const array = (items, maxItems = 100, minItems = 0) => ({ type:'array', items, minItems, maxItems });
const enumeration = values => ({ type:'string', enum:values });
const source = object({ document_id:string, page:{type:'integer',minimum:1,maximum:200}, quote:string });
export const requirementSchema = object({
  code:string, title:string, description:string, kind:enumeration(['functional','business_rule','non_functional']),
  actors:strings, use_cases:strings, preconditions:strings, postconditions:strings, main_flow:strings,
  alternative_flows:strings, exception_flows:strings, acceptance_criteria:strings, uncertainties:strings,
  sources:array(source,10,1),
});
export const requirementsOutputSchema = object({ requirements:array(requirementSchema,100,1),
  alerts:array(object({ kind:enumeration(['ambiguity','inconsistency','missing_information','extraction_limitation']), description:string, sources:array(source,10) }),100) });

const normalize = value => value.replace(/\s+/g,' ').trim();
export function validateSources(sources, documents) {
  for (const source of sources) {
    const doc = documents.find(doc => doc.id === source.document_id);
    const page = doc?.pages.find(page => page.page === source.page);
    assert(page && normalize(page.text).includes(normalize(source.quote)), 'Fonte não corresponde a um trecho da página preservada.', 422);
  }
}

export function validateRequirement(value, documents) {
  validateShape(value,requirementSchema);
  assert(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(value.code), 'Código de requisito inválido.', 422);
  validateSources(value.sources,documents);
  return value;
}

