import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/research/migrate.js';

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith('/tcc_test_')) throw new Error('Utilize banco separado com prefixo tcc_test_.');

test('migração PostgreSQL é reexecutável e mantém integridade referencial', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(pool);
    assert.deepEqual(await migrate(pool), []);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assert.rejects(client.query(`INSERT INTO research.code_versions(id,project_id,repository_url,requested_ref,commit_sha)
        VALUES($1,$2,'https://github.com/example/repo','main',$3)`, [randomUUID(),randomUUID(),'a'.repeat(40)]), { code: '23503' });
      await client.query('ROLLBACK');
      assert.equal((await client.query("SELECT count(*)::int AS n FROM research.migrations")).rows[0].n, 1);
    } finally { client.release(); }
  } finally { await pool.end(); }
});
