export function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export function assert(condition, message, status = 400) {
  if (!condition) fail(status, message);
}

export function text(value, name, max = 10000, required = false) {
  assert(value === undefined || typeof value === 'string', `${name}: texto inválido.`);
  const result = (value ?? '').trim();
  assert(result.length <= max && (!required || result.length > 0), `${name}: informe entre ${required ? 1 : 0} e ${max} caracteres.`);
  return result;
}

export function uuid(value) {
  assert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'Identificador inválido.');
  return value;
}

export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await action(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') fail(409, 'Registro duplicado ou projeto com execução ativa.');
    throw error;
  } finally {
    client.release();
  }
}
