import {requirementsFixtureTurn} from './requirements-agent-fixture.js';
import {collaborationFixtureTurn} from './collaboration-fixture.js';
import {executionAgentFixtureTurn} from './execution-agent-fixture.js';
import {scriptReviewFixtureTurn} from './script-review-fixture.js';
import {evaluationFixtureTurn} from './evaluation-agent-fixture.js';
import {fixtureTurn,agentFixtureOutput} from './agent-scenario.js';
export function autonomousFixtureTurn(request) {
  const {tools,contents}=request;
  if(tools.some(t=>t.name==='read_document_sources'))return requirementsFixtureTurn(request);
  if(tools.some(t=>['read_test_requirement','respond_clarification'].includes(t.name)))return collaborationFixtureTurn(request);
  if(tools.some(t=>['submit_execution_diagnostics','respond_script_review'].includes(t.name)))return scriptReviewFixtureTurn(request);
  if(tools.some(t=>t.name==='submit_execution_plan'))return executionAgentFixtureTurn(request);
  if(tools.some(t=>t.name==='read_evaluation_context'))return evaluationFixtureTurn(request);
  const task=JSON.parse(contents[0].parts[0].text).untrusted_task,responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  if(!responses.length)return fixtureTurn([...task.case_catalog.map(c=>({id:'case-'+c.id,name:'get_approved_case',args:{case_id:c.id}})),...task.requirement_codes.map(code=>({id:'req-'+code,name:'get_approved_requirement',args:{requirement_code:code}})),{id:'caps',name:'get_adapter_capabilities',args:{}}]);
  if(!responses.some(r=>r.name==='prepare_automation_scope'))return fixtureTurn([{id:'read',name:'read_source',args:{path:'src/calc.js',offset:0,length:1000}},{id:'scope',name:'prepare_automation_scope',args:{target_paths:['src/calc.js']}}]);
  return fixtureTurn([{id:'submit',name:'submit_automation',args:{scope_id:responses.find(r=>r.name==='prepare_automation_scope').response.scope_id,output:agentFixtureOutput({scope:{commit_sha:task.commit_sha},test_cases:responses.filter(r=>r.name==='get_approved_case').map(r=>r.response)})}}]);
}
