import {createProjectService} from '../src/research/projects.js';
import {createRunService} from '../src/research/runs.js';
import {createProcessor} from '../src/research/processor.js';
import {inspectRepository} from '../src/research/inspection.js';
import {repositoryFixture} from './repository-fixture.js';
import {generatedPath} from '../src/research/automation-contract.js';

export function scenarioServices(pool,store,options={}) {
  const repository=repositoryFixture({'package.json':'{"type":"module"}','src/calc.js':'export function sum(a,b){return a+b;}'});
  const projects=createProjectService({pool,store,resolveCode:async(repository_url,requested_ref)=>({repository_url,requested_ref,commit_sha:'a'.repeat(40),inspection:{}}),inspectCode:version=>inspectRepository(version,repository.fetch)});
  const runs=createRunService({pool,store,configuration:()=>({model:'platform-fixture-only',parameters:{temperature:0.2,maxOutputTokens:8192}}),...options});
  const generate=async request=>{
    let output;
    if(request.input.results) {
      output={findings:request.input.results.flatMap(result=>request.input.test_cases.find(t=>t.id===result.test_case_id).content.requirement_codes.map(code=>({
        test_result_id:result.id,requirement_code:code,test_case_id:result.test_case_id,automated_test_id:result.automated_test_id,
        classification:result.status==='failed' ? 'possible_functional_divergence' : result.status==='passed' ? 'compatible' : 'inconclusive',
        expected_behavior:request.input.test_cases.find(t=>t.id===result.test_case_id).content.expected_result,observed_behavior:result.observed_excerpt,
        evidence_quote:result.observed_excerpt,justification:'Classificação sintética da fixture para testar persistência; não é conclusão da pesquisa.',limitations:['Fixture técnica.']}))),warnings:[]};
    } else if(request.input.scope) {
      const row=request.input.test_cases[0];
      output={artifacts:[{test_case_id:row.id,requirement_codes:['RF-001'],adapter:'node-test/v2',commit_sha:'a'.repeat(40),
        files:[{path:generatedPath(row.id,'node-test/v2').path,code:"import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../src/calc.js';test('soma',()=>{assert.equal(sum(2,3),5);});"}],
        targets:[{path:'src/calc.js',symbols:['sum']}],rationale:'Confere soma definida no requisito.',expected_result:row.content.expected_result,expected_sources:[{requirement_code:'RF-001',quote:'somar dois números'}],limitations:[]}],unsupported_cases:[],warnings:[]};
    } else if(request.input.documents) output={requirements:[{code:'RF-001',title:'Somar',description:'O sistema deve somar dois números.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:'complementary-text',page:1,quote:'somar dois números'}]}],alerts:[]};
    else output={test_cases:[{code:'CT-001',title:'Somar valores',objective:'Conferir soma.',requirement_codes:['RF-001'],preconditions:[],input_data:['2 e 3'],steps:['Somar 2 e 3.'],expected_result:'Retorna a soma.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Conferir função sum.'}}],warnings:[]};
    return {raw:JSON.stringify(output),metadata:{model_version:'test-fixture',usage:null,cost:null}};
  };
  const processor=createProcessor({pool,store,generate,...options});
  return {projects,runs,processor,generate};
}
export async function textualScenario(services) {
  const {projects,runs,processor}=services;
  const project=await projects.create({name:'Fixture de automação',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve somar dois números.'});
  const run=await runs.create(project.id);
  await processor.processOne();
  let detail=await runs.detail(run.id);
  await runs.reviewItem(run.id,'requirements',detail.requirements[0].id,{revision:0,decision:'approved',justification:'Fonte conferida em teste da plataforma.'});
  await runs.approveStage(run.id,'requirements',{justification:'Requisitos aprovados na fixture.'});
  await processor.processOne();detail=await runs.detail(run.id);
  await runs.reviewItem(run.id,'tests',detail.test_cases[0].id,{revision:0,decision:'approved',justification:'Caso conferido.'});
  await runs.approveStage(run.id,'tests',{justification:'Casos textuais aprovados.'});
  return {project,run,inspection:await projects.inspect(project.id,run.code_version_id)};
}
