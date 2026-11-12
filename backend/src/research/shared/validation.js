import {assert} from '../errors.js';

export function validateShape(value, schema, path = 'resultado') {
  if (schema.type === 'object') {
    assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${path}: objeto obrigatório.`, 422);
    for (const key of Object.keys(value)) assert(Object.hasOwn(schema.properties,key), `${path}.${key}: campo desconhecido.`, 422);
    for (const key of schema.required) {
      assert(Object.hasOwn(value,key), `${path}.${key}: campo ausente.`, 422);
      validateShape(value[key],schema.properties[key],`${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    assert(Array.isArray(value) && value.length <= schema.maxItems && value.length >= (schema.minItems || 0), `${path}: lista inválida ou fora do limite. Quantidade permitida: ${schema.minItems || 0} a ${schema.maxItems} itens.`, 422);
    value.forEach((item,index) => validateShape(item,schema.items,`${path}[${index}]`));
  } else if (schema.type === 'string') {
    assert(typeof value === 'string' && value.trim().length > 0 && value.length <= 10000, `${path}: texto vazio ou inválido.`, 422);
    if (schema.enum) assert(schema.enum.includes(value), `${path}: valor fora do contrato.`, 422);
  } else if (schema.type === 'integer') {
    assert(Number.isInteger(value) && value >= schema.minimum && value <= schema.maximum, `${path}: inteiro inválido. Use um inteiro de ${schema.minimum} a ${schema.maximum}.`, 422);
  }
  return value;
}

