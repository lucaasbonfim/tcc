import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { transaction, text, uuid } from '../src/research/errors.js';

test('validação limita textos e identificadores antes de acessar o banco', () => {
  assert.equal(uuid(randomUUID()).length, 36);
  for (const value of ['1', null, "' OR 1=1"]) assert.throws(() => uuid(value));
  assert.throws(() => text({}, 'nome'));
  assert.throws(() => text('', 'nome', 10, true));
  assert.throws(() => text('123', 'nome', 2));
});

test('transação reverte erro e sempre libera conexão', async () => {
  const commands = [];
  const pool = { connect: async () => ({ query: async sql => commands.push(sql), release: () => commands.push('release') }) };
  await assert.rejects(transaction(pool, async () => { throw new Error('falha'); }), /falha/);
  assert.deepEqual(commands, ['BEGIN', 'ROLLBACK', 'release']);
});
