// Exclusivo da suíte E2E. Nunca montar no servidor da aplicação.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createArtifactStore } from '../src/research/artifacts.js';
import { createProjectService } from '../src/research/projects.js';
import { createRunService } from '../src/research/runs.js';
import { createResearchRouter } from '../src/research/routes.js';
import { createProcessor } from '../src/research/processor.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.startsWith('/tcc_test_')) throw new Error('E2E exige TEST_DATABASE_URL com banco tcc_test_.');
process.env.AUTH_SECRET = 'e2e-test-session-secret-not-for-production';
process.env.ADMIN_EMAIL = 'researcher@example.test';
process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('E2E-Research-Only',4);
process.env.FRONTEND_URL = 'http://localhost:5178';
const pool = new pg.Pool({connectionString:url});
const {migrate} = await import('../src/research/migrate.js');
await migrate(pool);
const root = await mkdtemp(join(tmpdir(),'tcc-e2e-'));
const store = createArtifactStore(root);
const projects = createProjectService({pool,store,resolveCode:async (repository_url,requested_ref) => ({repository_url,requested_ref:requested_ref || 'main',commit_sha:'a'.repeat(40),inspection:{reason:'Fixture técnica E2E, sem execução de código.'}})});
const runs = createRunService({pool,store,configuration:() => ({model:'e2e-fixture-not-research',parameters:{temperature:0.2,maxOutputTokens:8192}})});
const processor = createProcessor({pool,store,generate:async ({input}) => {
  const requirement = {code:'RF-001',title:'Consulta de projetos',description:'O pesquisador pode consultar projetos.',kind:'functional',actors:['Pesquisador'],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:input.documents?.[0].id || 'complementary-text',page:1,quote:'consultar projetos'}]};
  const testCase = {code:'CT-001',title:'Consultar projetos cadastrados',objective:'Verificar consulta de projetos.',requirement_codes:['RF-001'],preconditions:[],input_data:[],steps:['Consultar projetos cadastrados.'],expected_result:'Projetos cadastrados são exibidos.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Fixture E2E; código não executado.'}};
  return {raw:JSON.stringify(input.documents ? {requirements:[requirement],alerts:[]} : {test_cases:[testCase],warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
}});
const app = express();
app.use(cors({origin:process.env.FRONTEND_URL,credentials:true}));
app.use(cookieParser()); app.use(express.json({limit:'256kb'}));
const {default:authRoutes} = await import('../src/routes/auth.routes.js');
app.use('/api/auth',authRoutes);
app.use('/api/research',createResearchRouter({projects,runs,store}));
app.use(errorHandler);
const server = app.listen(3101,'127.0.0.1',() => console.log('Servidor E2E isolado http://127.0.0.1:3101 (somente fixtures técnicas).'));
let processing = false;
const timer = setInterval(async () => {if(processing)return;processing=true;try{await processor.processOne();}catch{console.error('Falha no processamento E2E.');}finally{processing=false;}},100);
async function stop() { clearInterval(timer);server.closeAllConnections();server.close();await pool.end();await rm(root,{recursive:true,force:true});process.exit(); }
process.on('SIGTERM',stop);process.on('SIGINT',stop);
