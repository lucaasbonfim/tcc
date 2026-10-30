import 'dotenv/config';
import pool from '../config/database.js';
import { createArtifactStore } from './artifacts.js';
import { createModelGateway } from './model.js';
import { createProcessor } from './processor.js';
import { assertMigrations } from './migrate.js';

let stopping = false;
let wake;
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => { stopping = true; wake?.(); });
const processor = createProcessor({pool,store:createArtifactStore(),generate:createModelGateway()});
try {
  await assertMigrations(pool);
  console.log('Worker de pesquisa iniciado. Execução externa somente via executor dedicado validado.');
  while (!stopping) {
    try {
      await processor.recoverExpired();
      if (await processor.processOne()) continue;
    } catch { console.error('Falha do worker; nova consulta em dois segundos. Verifique banco e armazenamento.'); }
    if (!stopping) await new Promise(resolve => { const timer = setTimeout(resolve,2000); wake = () => {clearTimeout(timer);resolve();}; });
  }
} catch (error) { console.error('Worker não iniciou:', error.message); process.exitCode=1; }
finally { await pool.end(); }
