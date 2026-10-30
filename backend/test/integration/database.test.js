import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate, assertMigrations } from '../../src/research/migrate.js';

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith('/tcc_test_')) throw new Error('Utilize banco separado com prefixo tcc_test_.');

test('migração PostgreSQL é reexecutável e mantém integridade referencial', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(pool);
    assert.deepEqual(await migrate(pool), []);
    await assertMigrations(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const migration = (await client.query('SELECT name FROM research.migrations ORDER BY name DESC LIMIT 1')).rows[0].name;
      await client.query('DELETE FROM research.migrations WHERE name=$1', [migration]);
      await assert.rejects(assertMigrations(client), /Migração pendente/);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query('UPDATE research.migrations SET checksum=$1 WHERE name=$2', ['0'.repeat(64), migration]);
      await assert.rejects(assertMigrations(client), /foi modificada/);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await assert.rejects(client.query(`INSERT INTO research.code_versions(id,project_id,repository_url,requested_ref,commit_sha)
        VALUES($1,$2,'https://github.com/example/repo','main',$3)`, [randomUUID(),randomUUID(),'a'.repeat(40)]), { code: '23503' });
      await client.query('ROLLBACK');
      assert.ok((await client.query("SELECT count(*)::int AS n FROM research.migrations")).rows[0].n >= 2);
    } finally { client.release(); }
  } finally { await pool.end(); }
});
