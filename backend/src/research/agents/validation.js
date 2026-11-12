import {assert} from '../shared/errors.js';
import {validateShape} from '../shared/validation.js';
import {requirementsOutputSchema,validateRequirement,validateSources} from './requirements/contracts.js';
import {testsOutputSchema,validateTestCase} from './tests/cases/contracts.js';

export function validateOutput(agent, output, input) {
  assert(agent === 'requirements' || agent === 'tests', 'Agente não suportado.', 422);
  validateShape(output,agent === 'requirements' ? requirementsOutputSchema : testsOutputSchema);
  const items = agent === 'requirements' ? output.requirements : output.test_cases;
  assert(new Set(items.map(item => item.code)).size === items.length, 'Códigos duplicados na resposta.', 422);
  if (agent === 'requirements') {
    items.forEach(item => validateRequirement(item,input.documents));
    output.alerts.forEach(alert => validateSources(alert.sources,input.documents));
  } else items.forEach(item => validateTestCase(item,input.requirements));
  return output;
}
