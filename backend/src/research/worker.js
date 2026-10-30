import 'dotenv/config';
import pool from '../config/database.js';
import { createArtifactStore } from './artifacts.js';
import { createModelGateway } from './model.js';
import { createProcessor } from './processor.js';

let stopping = false;
let wake;
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => { stopping = true; wake?.(); });
const processor = createProcessor({pool,store:createArtifactStore(),generate:createModelGateway()});
try {
  await pool.query('SELECT 1 FROM research.migrations LIMIT 1');
  console.log('Worker de pesquisa iniciado. Execução de código externo desabilitada.');
  while (!stopping) {
    try {
      await processor.recoverExpired();
      if (await processor.processOne()) continue;
    } catch { console.error('Falha do worker; nova consulta em dois segundos. Verifique banco e armazenamento.'); }
    if (!stopping) await new Promise(resolve => { const timer = setTimeout(resolve,2000); wake = () => {clearTimeout(timer);resolve();}; });
  }
} catch { console.error('Worker não iniciou. Execute as migrações e verifique o PostgreSQL.'); process.exitCode=1; }
finally { await pool.end(); }
