

import {assert} from '../errors.js';

import {createAgentSessionStore} from '../runtime/session-store.js';
import {createAutomationAgentTools} from '../agents/tests/scripts/tools.js';
import {runAgentTask,taskFingerprint} from '../runtime/run-agent.js';
import {AGENT_CONTRACT_VERSION} from '../runtime/session-contract.js';
import {createRequirementsAgentTools} from '../agents/requirements/tools.js';
import {createTestsAgentTools} from '../agents/tests/cases/tools.js';
import {createEvaluationAgentTools} from '../agents/evaluation/tools.js';
import {createCollaborationService} from '../agents/requirements/subagents/clarification.js';
import {createExecutionPlanningTools} from '../agents/execution/planning/tools.js';

import {createExecutionDiagnosisTools} from '../agents/execution/diagnosis/tools.js';

import {createScriptReviewService} from '../agents/tests/subagents/script-review.js';

export async function prepareStageInput({pool,store,automation,execution,evaluation,job,snapshot,isAgent}) {
  let input;
  if(job.automationPart)input=await automation.partInput(job.automationPart);
  else if(job.testPart)input=await store.json(job.testPart.input);
  else if(job.part)input={project_name:snapshot.project.name,...await store.json(job.part.input)};
  else if(job.stage.agent==='evaluation')input=await evaluation.inputFor(job.run.id);
  else if(job.stage.agent==='execution')input=isAgent?(job.stage.context.phase==='planning'?await execution.planningInput(job.stage.context.planning_input):await execution.diagnosisInput(job)):await execution.prepare(job);
  else if(job.stage.agent==='automation') input=await automation.inputFor(job.run.id,job.stage);
  else if (job.stage.agent === 'requirements') input = {project_name:snapshot.project.name,documents:snapshot.documents};
  else input = {project_name:snapshot.project.name,code_version:snapshot.code_version,
    requirements:(await pool.query("SELECT content FROM research.requirements WHERE run_id=$1 AND research.artifact_eligible(run_id,review_status,processing_status) ORDER BY code",[job.run.id])).rows.map(row => row.content)};
  return input;
}

export async function runAgentStage({pool,store,job,snapshot,policy,generateTurn,request,input,signal,onInputPrepared}) {
  assert(job.stage.context.execution_mode==='agent/v1','Modo da etapa diverge do snapshot.',422);
  const definition=job.stage.context.agent_definition;
  assert(definition?.contract_version===AGENT_CONTRACT_VERSION && Array.isArray(definition.tools),'Contrato agentivo ausente/incompatível; crie nova análise.',422);
  if(['requirements','tests','evaluation','execution'].includes(job.stage.agent)) {
    const isRequirements=job.stage.agent==='requirements';
    const isEvaluation=job.stage.agent==='evaluation';
    const isPlanning=job.stage.agent==='execution' && job.stage.context.phase==='planning';
    const isDiagnosis=job.stage.agent==='execution' && job.stage.context.phase==='diagnosis';
    const options={input,schema:request.schema,definition,maxObservationChars:policy.limits.max_observation_chars,
      requestClarification:(args,context)=>createCollaborationService({pool,store}).request({job,input,snapshot,policy,generateTurn,signal:context.signal,...args}),
      requestScriptReview:(args,context)=>createScriptReviewService({pool,store}).request({job,input,snapshot,policy,generateTurn,signal:context.signal,...args})};
    const tools=(isRequirements?createRequirementsAgentTools:isEvaluation?createEvaluationAgentTools:isPlanning?createExecutionPlanningTools:isDiagnosis?createExecutionDiagnosisTools:createTestsAgentTools)(options);
    const task={...tools.task,objective:isRequirements?'Extrair requisitos rastreáveis e analisar incertezas das fontes atribuídas.':isEvaluation?'Investigar as evidências e propor conclusões vinculadas aos cenários executados.':isPlanning?'Planejar lotes de execução dos scripts aprovados, para autorização humana.':isDiagnosis?'Diagnosticar problemas técnicos dos testes executados sem alterar evidências.':'Elaborar cenários de teste sustentados pelos requisitos aprovados.',
      fingerprint:taskFingerprint({input,schema:request.schema,definition,policy,model:job.run.model,parameters:job.run.parameters})};
    if(job.run.workflow_mode==='autonomous/v1' && (isPlanning || job.stage.agent==='tests'))task.objective=isPlanning?'Planejar lotes dos scripts admitidos pela plataforma, dentro da autorização inicial.':'Elaborar cenários sustentados pelos requisitos admitidos pela plataforma, sem revisão humana intermediária.';
    const initialContents=[{role:'user',parts:[{text:JSON.stringify({untrusted_task:{objective:task.objective,
      ...(isRequirements?{document_catalog:input.documents.map(d=>({id:d.id,name:d.name,pages:d.pages.map(p=>p.page)})),source_count:tools.task.source_ids.length,part:input.part ?? null}:isEvaluation || isDiagnosis?{result_count:input.results.length}:isPlanning?{script_count:input.entries.length}:{requirement_catalog:input.requirements.map(r=>({code:r.code,title:r.title})),batch:input.batch ?? null}),limits:policy.limits}})}]}];
    const terminal=await runAgentTask({sessions:createAgentSessionStore(pool,job),store,generateTurn,tools,task,policy,initialContents,
      model:job.run.model,parameters:job.run.parameters,instruction:request.instruction,instruction_version:request.instruction_version,toolDefinitions:tools.declarations,terminalTool:isRequirements?'submit_requirements':isEvaluation?'submit_evaluation':isPlanning?'submit_execution_plan':isDiagnosis?'submit_execution_diagnostics':'submit_test_cases',signal:signal});
    input=terminal.input;onInputPrepared({input});const inputRef=await store.put({...request,input,execution_mode:'agent/v1'});onInputPrepared({inputRef});
    return {raw:JSON.stringify(terminal.output),metadata:{provider:'agent-runtime',execution_mode:'agent/v1',cost:null}};
  }
  const inspectionRef=(await pool.query('SELECT artifact FROM research.inspections WHERE id=$1 AND code_version_id=$2',[job.stage.context.inspection_id,job.run.code_version_id])).rows[0]?.artifact;
  assert(inspectionRef,'Inspeção da tarefa não encontrada.',422);
  const inspection=await store.json(inspectionRef);
  const tools=createAutomationAgentTools({input,inspection,store,definition,maxObservationChars:policy.limits.max_observation_chars});
  const task={...tools.task,module_root:input.scope.module.root,commit_sha:input.scope.commit_sha,
    fingerprint:taskFingerprint({cases:input.test_cases,requirements:input.requirements,inspection:inspectionRef.sha256,model:job.run.model,parameters:job.run.parameters,policy,definition})};
  const initialContents=[{role:'user',parts:[{text:JSON.stringify({untrusted_task:{objective:'Automatizar todos os casos atribuídos preservando as regras aprovadas.',
    case_catalog:input.test_cases.map(row=>({id:row.id,title:row.content.title,requirement_codes:row.content.requirement_codes})),
    requirement_codes:tools.task.requirement_codes,generated_paths:input.generated_paths,module_root:task.module_root,commit_sha:task.commit_sha,limits:policy.limits}})}]}];
  const terminal=await runAgentTask({sessions:createAgentSessionStore(pool,job),store,generateTurn,tools,task,policy,initialContents,
    model:job.run.model,parameters:job.run.parameters,instruction:request.instruction,instruction_version:request.instruction_version,toolDefinitions:tools.declarations,terminalTool:'submit_automation',signal:signal});
  input=terminal.input;onInputPrepared({input});
  const inputRef=await store.put({...request,input,execution_mode:'agent/v1'});onInputPrepared({inputRef});
  return {raw:JSON.stringify(terminal.output),metadata:{provider:'agent-runtime',execution_mode:'agent/v1',cost:null}};
}
