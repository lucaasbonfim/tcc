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
import {createAutomationService} from '../src/research/automation.js';
import {createExecutionService} from '../src/research/execution.js';
import {createEvaluationService} from '../src/research/evaluation.js';
import {repositoryFixture} from './repository-fixture.js';
import {inspectRepository} from '../src/research/inspection.js';
import {generatedPath} from '../src/research/automation-contract.js';
import {fixtureResult} from '../../shared/execution-fixture.js';
import {requireAdmin} from '../src/middlewares/auth.js';

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
const repository=repositoryFixture({'package.json':'{"type":"module"}','src/projects.js':'export function consultarProjetos(){return [];}' });
const projects = createProjectService({pool,store,inspectCode:version=>inspectRepository(version,repository.fetch),resolveCode:async (repository_url,requested_ref) => ({repository_url,requested_ref:requested_ref || 'main',commit_sha:'a'.repeat(40),inspection:{reason:'Fixture técnica E2E, sem execução de código.'}})});
const runs = createRunService({pool,store,configuration:() => ({model:'e2e-fixture-not-research',parameters:{temperature:0.2,maxOutputTokens:8192}})});
let executorEnabled=false;
const receipt={ready:true,protocol_version:1,deployment_id:'e2e-fixture-only',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
const executorClient={health:async()=>executorEnabled ? receipt : {ready:false,reason:'Fixture E2E: executor indisponível até habilitação exclusiva do teste.'},execute:async bundle=>{const result=fixtureResult(bundle);result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
const processor = createProcessor({pool,store,executorClient,generate:async ({input}) => {
  if(input.results)return {raw:JSON.stringify({findings:input.results.map(result=>({test_result_id:result.id,test_case_id:result.test_case_id,automated_test_id:result.automated_test_id,requirement_code:'RF-001',classification:'compatible',expected_behavior:input.test_cases[0].content.expected_result,observed_behavior:result.observed_excerpt,evidence_quote:result.observed_excerpt,justification:'Fixture E2E somente; não é resultado da pesquisa.',limitations:['Fixture técnica.']})),warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
  if(input.scope){const row=input.test_cases[0];return {raw:JSON.stringify({artifacts:[{test_case_id:row.id,requirement_codes:['RF-001'],adapter:'node-test/v2',commit_sha:'a'.repeat(40),files:[{path:generatedPath(row.id,'node-test/v2').path,code:"import test from 'node:test';import assert from 'node:assert/strict';import {consultarProjetos} from '../src/projects.js';test('consulta',()=>assert.deepEqual(consultarProjetos(),[]));"}],targets:[{path:'src/projects.js',symbols:['consultarProjetos']}],rationale:'Fixture E2E de geração.',expected_result:row.content.expected_result,expected_sources:[{requirement_code:'RF-001',quote:'consultar projetos'}],limitations:['Fixture, sem compilação/execução real.']}],unsupported_cases:[],warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};}
  const requirement = {code:'RF-001',title:'Consulta de projetos',description:'O pesquisador pode consultar projetos.',kind:'functional',actors:['Pesquisador'],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:input.documents?.[0].id || 'complementary-text',page:1,quote:'consultar projetos'}]};
  const testCase = {code:'CT-001',title:'Consultar projetos cadastrados',objective:'Verificar consulta de projetos.',requirement_codes:['RF-001'],preconditions:[],input_data:[],steps:['Consultar projetos cadastrados.'],expected_result:'Projetos cadastrados são exibidos.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Fixture E2E; código não executado.'}};
  return {raw:JSON.stringify(input.documents ? {requirements:[requirement],alerts:[]} : {test_cases:[testCase],warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
}});
const app = express();
app.use(cors({origin:process.env.FRONTEND_URL,credentials:true}));
app.use(cookieParser()); app.use(express.json({limit:'256kb'}));
const {default:authRoutes} = await import('../src/routes/auth.routes.js');
app.use('/api/auth',authRoutes);
app.use('/api/research',createResearchRouter({projects,runs,store,automation:createAutomationService({pool,store}),execution:createExecutionService({pool,store,client:executorClient}),evaluation:createEvaluationService({pool,store})}));
// This route exists only in this test-only server guarded by TEST_DATABASE_URL. Never add it to production app.
app.post('/__e2e/enable-executor',requireAdmin,(_req,res)=>{executorEnabled=true;res.json({fixture_only:true});});
app.use(errorHandler);
const server = app.listen(3101,'127.0.0.1',() => console.log('Servidor E2E isolado http://127.0.0.1:3101 (somente fixtures técnicas).'));
let processing = false;
const timer = setInterval(async () => {if(processing)return;processing=true;try{await processor.processOne();}catch{console.error('Falha no processamento E2E.');}finally{processing=false;}},100);
async function stop() { clearInterval(timer);server.closeAllConnections();server.close();await pool.end();await rm(root,{recursive:true,force:true});process.exit(); }
process.on('SIGTERM',stop);process.on('SIGINT',stop);
