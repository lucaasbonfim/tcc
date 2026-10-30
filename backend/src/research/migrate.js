import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pool from '../config/database.js';
import { transaction } from './errors.js';

export async function migrate(database = pool) {
  const directory = new URL('../../../database/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  return transaction(database, async client => {
    await client.query("SELECT pg_advisory_xact_lock(72711231)");
    await client.query('CREATE SCHEMA IF NOT EXISTS research');
    await client.query(`CREATE TABLE IF NOT EXISTS research.migrations (
      name TEXT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const applied = [];
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const existing = (await client.query('SELECT checksum FROM research.migrations WHERE name=$1', [name])).rows[0];
      if (existing && existing.checksum !== checksum) throw new Error(`Migração já aplicada foi modificada: ${name}`);
      if (existing) continue;
      await client.query(sql);
      await client.query('INSERT INTO research.migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      applied.push(name);
    }
    return applied;
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { console.log({ applied: await migrate(), directory: fileURLToPath(new URL('../../../database/migrations/', import.meta.url)) }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await pool.end(); }
}
