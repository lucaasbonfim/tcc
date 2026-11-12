// Exclusivo da suíte E2E. Nunca montar no servidor da aplicação.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createArtifactStore } from '../src/research/storage/artifacts.js';
import { createProjectService } from '../src/research/services/projects.js';
import { createRunService } from '../src/research/services/runs.js';
import { createResearchRouter } from '../src/research/http/routes.js';
import { createResearchOrchestrator } from '../src/research/orchestrator/index.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {createAutomationService} from '../src/research/services/automation.js';
import {createExecutionService} from '../src/research/services/execution.js';
import {createEvaluationService} from '../src/research/services/evaluation.js';
import {repositoryFixture} from './repository-fixture.js';
import {inspectRepository} from '../src/research/sources/inspection.js';
import {generatedPath} from '../src/research/agents/tests/scripts/contracts.js';
import {fixtureResult} from '../../shared/execution-fixture.js';
import {fixtureTurn} from './agent-scenario.js';
import {testCasesFixtureTurn} from './tests-agent-fixture.js';
import {evaluationFixtureTurn} from './evaluation-agent-fixture.js';
import {collaborationFixtureTurn} from './collaboration-fixture.js';
import {executionAgentFixtureTurn} from './execution-agent-fixture.js';
import {scriptReviewFixtureTurn} from './script-review-fixture.js';
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
const runs = createRunService({pool,store,executorClient:{health:()=>executorClient.health()},configuration:() => ({model:'e2e-fixture-not-research',parameters:{temperature:0.2,maxOutputTokens:8192}})});
let executorEnabled=false;
const receipt={ready:true,protocol_version:1,deployment_id:'e2e-fixture-only',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
const executorClient={health:async()=>executorEnabled ? receipt : {ready:false,reason:'Fixture E2E: executor indisponível até habilitação exclusiva do teste.'},execute:async bundle=>{const project=(await pool.query('SELECT p.name FROM research.projects p JOIN research.runs r ON r.project_id=p.id WHERE r.id=$1',[bundle.run_id])).rows[0];const result=fixtureResult(bundle,project?.name.startsWith('Revisão A3 E2E')?'failed':'passed');result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
const generate=async ({input}) => {
  if(input.results)return {raw:JSON.stringify({findings:input.results.map(result=>({test_result_id:result.id,test_case_id:result.test_case_id,automated_test_id:result.automated_test_id,requirement_code:'RF-001',classification:result.status==='passed'?'compatible':result.status==='failed'?'possible_functional_divergence':'inconclusive',expected_behavior:input.test_cases[0].content.expected_result,observed_behavior:result.observed_excerpt,evidence_quote:result.observed_excerpt,justification:'Fixture E2E somente; não é resultado da pesquisa.',limitations:['Fixture técnica.']})),warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
  if(input.scope)return {raw:JSON.stringify({artifacts:input.test_cases.map(row=>({test_case_id:row.id,requirement_codes:['RF-001'],adapter:'node-test/v2',commit_sha:'a'.repeat(40),files:[{path:generatedPath(row.id,'node-test/v2').path,code:"import test from 'node:test';import assert from 'node:assert/strict';import {consultarProjetos} from '../src/projects.js';test('consulta',()=>assert.deepEqual(consultarProjetos(),[]));"}],targets:[{path:'src/projects.js',symbols:['consultarProjetos']}],rationale:'Fixture E2E de geração.',expected_result:row.content.expected_result,expected_sources:[{requirement_code:'RF-001',quote:'consultar projetos'}],limitations:['Fixture, sem compilação/execução real.']})),unsupported_cases:[],warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
  const requirement = {code:'RF-001',title:'Consulta de projetos',description:'O pesquisador pode consultar projetos.',kind:'functional',actors:['Pesquisador'],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:input.documents?.[0].id || 'complementary-text',page:1,quote:'consultar projetos'}]};
  const testCase = {code:'CT-001',title:'Consultar projetos cadastrados',objective:'Verificar consulta de projetos.',requirement_codes:['RF-001'],preconditions:[],input_data:[],steps:['Consultar projetos cadastrados.'],expected_result:'Projetos cadastrados são exibidos.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Fixture E2E; código não executado.'}};
  if(input.project_name?.startsWith('Cancelar agente E2E'))testCase.title='Controle de cancelamento agentivo';
  if(input.project_name?.startsWith('Colaboração E2E'))requirement.title='Colaboração E2E: consulta';
  if(input.project_name?.startsWith('Autonomia E2E'))requirement.title='Autonomia E2E: consulta';
  if(input.project_name?.startsWith('Revisão A3 E2E'))testCase.title='Revisão A3 E2E: consultar projetos';
  if(input.source_catalog)requirement.sources=[{source_id:input.source_catalog[0].source_id}];
  const cases=input.project_name?.startsWith('Lote E2E') ? Array.from({length:104},(_,i)=>({...testCase,code:`CT-${String(i+1).padStart(3,'0')}`})) : [testCase];
  return {raw:JSON.stringify(input.documents ? {requirements:[requirement],alerts:[]} : {test_cases:cases,warnings:[]}),metadata:{model_version:'e2e-fixture',usage:null,cost:null}};
};
const retryFixtureCalls=new Map();
const processor=createResearchOrchestrator({pool,store,executorClient,generate,generateTurn:async({contents,tools})=>{
  const firstText=contents[0].parts[0].text;
  if(firstText.includes('Retry-E2E')){const sends=(retryFixtureCalls.get(firstText)||0)+1;retryFixtureCalls.set(firstText,sends);if(sends<=2)throw Object.assign(new Error('fixture-transient-private'),{name:'ApiError',status:503});}
  if(contents[0].parts[0].text.includes('503-E2E'))throw Object.assign(new Error('fixture-provider-detail-private'),{name:'ApiError',status:503});
  const autonomous=JSON.stringify(contents).includes('Autonomia E2E');
  if(tools.some(t=>t.name==='respond_clarification') && autonomous && !contents.some(c=>c.parts.some(p=>p.functionResponse)))await new Promise(resolve=>setTimeout(resolve,6000));
  if(autonomous && tools.some(t=>t.name==='read_test_requirement'))return collaborationFixtureTurn({contents,tools});
  if(tools.some(t=>t.name==='respond_script_review') || JSON.stringify(contents).includes('Revisão A3 E2E'))return scriptReviewFixtureTurn({contents,tools});
  if(tools.some(t=>['submit_execution_plan','submit_execution_diagnostics'].includes(t.name)))return executionAgentFixtureTurn({contents,tools});
  if(tools.some(t=>t.name==='respond_clarification') || contents[0].parts[0].text.includes('Colaboração E2E'))return collaborationFixtureTurn({contents,tools});
  if(tools.some(t=>t.name==='read_evaluation_context'))return evaluationFixtureTurn({contents});
  if(tools.some(t=>t.name==='read_test_requirement'))return testCasesFixtureTurn({contents});
  const task=JSON.parse(contents[0].parts[0].text).untrusted_task;
  if(tools.some(t=>t.name==='read_document_sources')) {
    const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
    const catalog=responses.find(r=>r.name==='list_document_sources')?.response.sources;
    if(!catalog)return fixtureTurn([{id:'list',name:'list_document_sources',args:{offset:0,limit:50}}]);
    const sources=responses.filter(r=>r.name==='read_document_sources').flatMap(r=>r.response.sources || []);
    const missing=catalog.filter(source=>!sources.some(s=>s.source_id===source.source_id));
    if(missing.length)return fixtureTurn([{id:'read-'+sources.length,name:'read_document_sources',args:{source_ids:missing.slice(0,20).map(s=>s.source_id)}}]);
    const first=sources[0],output=JSON.parse((await generate({input:{project_name:autonomous?'Autonomia E2E':undefined,documents:[{id:first.document_id,pages:[{page:first.page,text:first.quote}]}],source_catalog:sources}})).raw);
    return fixtureTurn([{id:'submit',name:'submit_requirements',args:{output}}]);
  }
  if(task.case_catalog[0].title==='Controle de cancelamento agentivo')await new Promise(resolve=>setTimeout(resolve,5000));
  const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  if(!responses.length)return fixtureTurn([
    ...task.case_catalog.map(row=>({id:'case-'+row.id,name:'get_approved_case',args:{case_id:row.id}})),
    ...task.requirement_codes.map(code=>({id:'req-'+code,name:'get_approved_requirement',args:{requirement_code:code}})),
    {id:'manifest',name:'list_sources',args:{offset:0,limit:20}}]);
  if(!responses.some(r=>r.name==='prepare_automation_scope'))return fixtureTurn([
    {id:'read',name:'read_source',args:{path:'src/projects.js',offset:0,length:1000}},
    {id:'scope',name:'prepare_automation_scope',args:{target_paths:['src/projects.js']}}]);
  const cases=responses.filter(r=>r.name==='get_approved_case').map(r=>r.response);
  const output=JSON.parse((await generate({input:{scope:{commit_sha:task.commit_sha},test_cases:cases}})).raw);
  return fixtureTurn([{id:'submit',name:'submit_automation',args:{scope_id:responses.find(r=>r.name==='prepare_automation_scope').response.scope_id,output}}]);
}});
const app = express();
app.use(cors({origin:process.env.FRONTEND_URL,credentials:true}));
app.use(cookieParser()); app.use(express.json({limit:'256kb'}));
const {default:authRoutes} = await import('../src/routes/auth.routes.js');
app.use('/api/auth',authRoutes);
// All E2E workflows share one loopback IP. Keep their cumulative fixture imports separate from the production default.
app.use('/api/research',createResearchRouter({projects,runs,store,importLimit:300,requestLimit:10000,automation:createAutomationService({pool,store}),execution:createExecutionService({pool,store,client:executorClient}),evaluation:createEvaluationService({pool,store})}));
// This route exists only in this test-only server guarded by TEST_DATABASE_URL. Never add it to production app.
app.post('/__e2e/enable-executor',requireAdmin,(req,res)=>{executorEnabled=req.body?.enabled!==false;res.json({fixture_only:true});});
app.use(errorHandler);
const server = app.listen(3101,'127.0.0.1',() => console.log('Servidor E2E isolado http://127.0.0.1:3101 (somente fixtures técnicas).'));
let processing = false;
const timer = setInterval(async () => {if(processing)return;processing=true;try{await processor.processOne();}catch{console.error('Falha no processamento E2E.');}finally{processing=false;}},100);
async function stop() { clearInterval(timer);server.closeAllConnections();server.close();await pool.end();await rm(root,{recursive:true,force:true});process.exit(); }
process.on('SIGTERM',stop);process.on('SIGINT',stop);
