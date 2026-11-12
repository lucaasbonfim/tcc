import { randomUUID } from 'node:crypto';
import {AGENTS} from './agents.js';
import {validateOutput} from './agents/validation.js';
import {validateRequirement} from './agents/requirements/contracts.js';
import { transaction } from './errors.js';
import { createAutomationService } from './automation.js';
import {partitionAutomation,AUTOMATION_COVERAGE_GUARD} from './agents/tests/scripts/contracts.js';
import {createExecutionService} from './execution.js';
import {createEvaluationService} from './evaluation.js';
import {validateEvaluation,evaluationRequestSchema} from './evaluation-contract.js';
import {PART_SCHEMA,validatePart,consolidateParts} from './agents/requirements/parts.js';
import {citationRequest,resolveCitations,preservedOutput} from './agents/requirements/citations.js';
import {assertTestCoverage,persistTestPart,testCoverage} from './agents/tests/cases/parts.js';
import {assert} from './errors.js';
import {agentMode,resolveAgentPolicy} from './agent-policy.js';
import {createAgentTurnGateway} from './model.js';
import {createAgentSessionStore} from './agent-sessions.js';
import {createAutomationAgentTools} from './agents/tests/scripts/tools.js';
import {runAgentTask,taskFingerprint} from './agent-runtime.js';
import {AGENT_CONTRACT_VERSION} from './runtime/session-contract.js';
import {createRequirementsAgentTools} from './agents/requirements/tools.js';
import {createTestsAgentTools} from './agents/tests/cases/tools.js';
import {createEvaluationAgentTools} from './evaluation-agent.js';
import {createCollaborationService} from './agents/requirements/subagents/clarification.js';
import {createExecutionPlanningTools,validateExecutionProposal} from './execution-agent.js';
import {createExecutionDiagnosisTools,validateExecutionDiagnostics} from './execution-diagnostics.js';
import {createScriptReviewService} from './agents/tests/subagents/script-review.js';
import {createAutonomyController} from './autonomy.js';
import {appendRunEvent} from './run-events.js';
import {recordAttemptInput,recordAttemptOutput} from './attempt-snapshots.js';

export function createProcessor({ pool, store, generate, executorClient, generateTurn=createAgentTurnGateway() }) {
  const automation=createAutomationService({pool,store});
  const execution=createExecutionService({pool,store,client:executorClient});
  const evaluation=createEvaluationService({pool,store});
  const autonomy=createAutonomyController({pool,store,executorClient});
  async function claim() {
    return transaction(pool, async db => {
      const run = (await db.query(`SELECT r.* FROM research.runs r WHERE r.status='pending'
        AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='pending' AND
          (s.attempt_count<3 OR (s.agent='requirements' AND EXISTS(SELECT 1 FROM research.requirement_parts p WHERE p.run_id=r.id AND p.status='pending')
            AND NOT EXISTS(SELECT 1 FROM research.requirement_parts p WHERE p.run_id=r.id AND p.status='failed'))
            OR (s.agent='tests' AND EXISTS(SELECT 1 FROM research.test_parts p WHERE p.run_id=r.id AND p.status='pending' AND p.attempt_count<3)
            AND NOT EXISTS(SELECT 1 FROM research.test_parts p WHERE p.run_id=r.id AND p.status='failed'))
            OR (s.agent='automation' AND EXISTS(SELECT 1 FROM research.automation_parts p WHERE p.run_id=r.id AND p.status='pending' AND p.attempt_count<3)
            AND NOT EXISTS(SELECT 1 FROM research.automation_parts p WHERE p.run_id=r.id AND p.status='failed'))))
        ORDER BY r.created_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
      if (!run) return null;
      const stage = (await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND status='pending' ORDER BY position LIMIT 1 FOR UPDATE",[run.id])).rows[0];
      const token = randomUUID();
      const attemptId = randomUUID();
      const part=stage.agent==='requirements' ? (await db.query("SELECT * FROM research.requirement_parts WHERE run_id=$1 AND status IN ('pending','failed') ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const testPart=stage.agent==='tests' ? (await db.query("SELECT * FROM research.test_parts WHERE run_id=$1 AND status IN ('pending','failed') AND attempt_count<3 ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const automationPart=stage.agent==='automation' ? (await db.query("SELECT * FROM research.automation_parts WHERE run_id=$1 AND status IN ('pending','failed') AND attempt_count<3 ORDER BY sequence LIMIT 1 FOR UPDATE",[run.id])).rows[0] : null;
      const executing=stage.agent==='execution' && !['planning','diagnosis'].includes(stage.context.phase);
      const executionJob=executing ? (await db.query('SELECT * FROM research.execution_jobs WHERE run_id=$1 AND id=$2 AND attempt_count<3 FOR UPDATE',[run.id,stage.context.job_id])).rows[0] : null;
      if(executing)assert(executionJob,'Trabalho de execução esgotado ou ausente.',409);
      const checkpoint=part || testPart || automationPart || executionJob;
      const increment=!checkpoint || stage.attempt_count===0 || checkpoint.status==='failed' ? 1 : 0;
      await db.query("UPDATE research.stages SET status='running',attempt_count=attempt_count+$3,lease_token=$2,lease_until=now()+interval '180 seconds',message=NULL WHERE id=$1",[stage.id,token,increment]);
      if(part)await db.query("UPDATE research.requirement_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[part.id]);
      if(testPart)await db.query("UPDATE research.test_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[testPart.id]);
      if(automationPart)await db.query("UPDATE research.automation_parts SET status='running',attempt_count=attempt_count+1,error=NULL WHERE id=$1",[automationPart.id]);
      if(executionJob)await db.query("UPDATE research.execution_jobs SET attempt_count=attempt_count+1 WHERE id=$1",[executionJob.id]);
      await db.query("UPDATE research.runs SET status='running' WHERE id=$1",[run.id]);
      const number=(await db.query('SELECT COALESCE(max(number),0)+1 AS n FROM research.attempts WHERE stage_id=$1',[stage.id])).rows[0].n;
      await db.query("INSERT INTO research.attempts(id,stage_id,number,status,requirement_part_id,test_part_id,automation_part_id,execution_job_id) VALUES($1,$2,$3,'running',$4,$5,$6,$7)",[attemptId,stage.id,number,part?.id || null,testPart?.id || null,automationPart?.id || null,executionJob?.id || null]);
      await appendRunEvent(db,{run_id:run.id,source_key:`attempt:${attemptId}:started`,kind:'attempt_started',agent:stage.agent,stage_id:stage.id,attempt_id:attemptId,job_id:executionJob?.id,payload:{number,phase:stage.context?.phase,part_sequence:checkpoint?.sequence}});
      return {run,stage,token,attemptId,part,testPart,automationPart,executionJob};
    });
  }
  async function finish(job, { inputRef, outputRef, metadata, output, error, elapsed, automationValidated=false }) {
    return transaction(pool, async db => {
      await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);
      const current = (await db.query('SELECT status,lease_token FROM research.stages WHERE id=$1 FOR UPDATE',[job.stage.id])).rows[0];
      if (current.status !== 'running' || current.lease_token !== job.token) {
        // Preserve a resposta tardia para auditoria, sem reabrir a execução cancelada/interrompida.
        await db.query(`UPDATE research.attempts SET input=COALESCE(input,$2),output=COALESCE(output,$3),provider_metadata=COALESCE(provider_metadata,$4),duration_ms=COALESCE(duration_ms,$5)
          WHERE id=$1`,[job.attemptId,inputRef,outputRef,metadata,elapsed]);
        await recordAttemptOutput(db,store,job,{inputRef,outputRef,output,error,late:true});
        return;
      }
      let partial=false;
      if(job.part) {
        await db.query('UPDATE research.requirement_parts SET status=$2,output=$3,error=$4 WHERE id=$1',[job.part.id,error ? 'failed' : 'completed',outputRef,error]);
        if(!error) {
          const parts=(await db.query('SELECT * FROM research.requirement_parts WHERE run_id=$1 ORDER BY sequence',[job.run.id])).rows;
          partial=parts.some(p=>p.status!=='completed');
          if(!partial) {
            const inputs=[];for(const part of parts)inputs.push({id:part.id,output:preservedOutput(await store.json(part.output))});
            const consolidated=consolidateParts(inputs),snapshot=await store.json(job.run.snapshot);
            consolidated.output.requirements.forEach(req=>validateRequirement(req,snapshot.documents));
            const ref=await store.put(consolidated);
            await db.query('UPDATE research.runs SET consolidation=$2 WHERE id=$1',[job.run.id,ref]);output=consolidated.output;
          }
        }
      }
      if(job.testPart) {
        const mapping=error ? [] : await persistTestPart(db,job.run.id,output);
        await db.query('UPDATE research.test_parts SET status=$2,output=$3,error=$4,mapping=$5 WHERE id=$1',[job.testPart.id,error ? 'failed' : 'completed',outputRef,error,JSON.stringify(mapping)]);
        if(!error) {
          partial=Boolean((await db.query("SELECT id FROM research.test_parts WHERE run_id=$1 AND status IN ('pending','running','failed') LIMIT 1",[job.run.id])).rowCount);
          if(!partial) {
            const requirements=(await db.query('SELECT code,content,review_status,processing_status FROM research.requirements WHERE run_id=$1',[job.run.id])).rows;
            const cases=(await db.query('SELECT code,content,review_status,processing_status FROM research.test_cases WHERE run_id=$1',[job.run.id])).rows;
            assert(!testCoverage(requirements,cases).missing.length,'Consolidação de testes possui requisitos sem caso. Complete os cenários antes de continuar.',422);
          }
        }
      }
      if(job.automationPart) {
        const dispositions=[...job.automationPart.dispositions,...(!error || automationValidated ? await automation.persist(db,job,output) : [])];
        await db.query('UPDATE research.automation_parts SET status=$2,output=$3,error=$4,dispositions=$5 WHERE id=$1',[job.automationPart.id,error ? 'failed' : 'completed',outputRef,error,JSON.stringify(dispositions)]);
        if(!error) {
          const parts=(await db.query('SELECT status,dispositions FROM research.automation_parts WHERE run_id=$1',[job.run.id])).rows;
          partial=parts.some(part=>part.status!=='completed');
          if(!partial){const addressed=parts.flatMap(part=>part.dispositions.filter(item=>item.status!=='deferred').map(item=>item.test_case_id));assert(addressed.length===job.stage.context.case_ids.length && new Set(addressed).size===addressed.length && job.stage.context.case_ids.every(id=>addressed.includes(id)),'Existem casos sem script ou justificativa na consolidação.',422);}
        }
      }
      if (!error && !partial && !job.testPart && !job.automationPart) {
        if(job.stage.agent==='evaluation')await evaluation.persist(db,job,output);
        else if(job.stage.agent==='execution') {if(job.stage.context.phase==='planning')await execution.persistPlanning(db,job,output);else if(job.stage.context.phase==='diagnosis')await execution.persistDiagnosis(db,job,output,inputRef);else await execution.persist(db,job,output);}
        else if(job.stage.agent==='automation') await automation.persist(db,job,output);
        else {
        const items = job.stage.agent === 'requirements' ? output.requirements : output.test_cases;
        const table = job.stage.agent === 'requirements' ? 'requirements' : 'test_cases';
        for (const content of items) {
          const id = randomUUID();
          await db.query(`INSERT INTO research.${table}(id,run_id,code,content) VALUES($1,$2,$3,$4)`,[id,job.run.id,content.code,JSON.stringify(content)]);
          if (table === 'test_cases') for (const code of content.requirement_codes) await db.query(`INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id)
            SELECT $1,$2,id FROM research.requirements WHERE run_id=$1 AND code=$3 AND research.artifact_eligible(run_id,review_status,processing_status)`,[job.run.id,id,code]);
        }
        }
      }
      if(job.stage.agent==='execution' && !['planning','diagnosis'].includes(job.stage.context.phase)) {
        if(error){await db.query("UPDATE research.execution_jobs SET status='failed',error=$2,finished_at=now() WHERE id=$1",[job.stage.context.job_id,error]);await db.query("UPDATE research.execution_plans SET status='failed',finished_at=now() WHERE run_id=$1",[job.run.id]);}
        else {const next=(await db.query("SELECT * FROM research.execution_jobs WHERE run_id=$1 AND status<>'completed' ORDER BY sequence LIMIT 1",[job.run.id])).rows[0];
          if(next){partial=true;await db.query('UPDATE research.stages SET context=$2,attempt_count=$3 WHERE id=$1',[job.stage.id,{...job.stage.context,job_id:next.id},next.attempt_count]);}}
      }
      await db.query(`UPDATE research.attempts SET status=$2,input=$3,output=$4,provider_metadata=$5,error=$6,finished_at=now(),duration_ms=$7 WHERE id=$1`,
        [job.attemptId,error ? 'failed' : 'completed',inputRef,outputRef,metadata,error,elapsed]);
      await recordAttemptOutput(db,store,job,{inputRef,outputRef,output,error});
      await appendRunEvent(db,{run_id:job.run.id,source_key:`attempt:${job.attemptId}:finished`,kind:error?'attempt_failed':'attempt_finished',actor:job.executionJob?'executor':'agent',agent:job.stage.agent,stage_id:job.stage.id,attempt_id:job.attemptId,job_id:job.executionJob?.id,payload:{phase:job.stage.context?.phase,status:error?'failed':'completed',error:error||null,elapsed_ms:elapsed,partial}});
      const unsupported=job.stage.agent==='automation' && !error && !partial && !(await db.query('SELECT id FROM research.automated_tests WHERE run_id=$1 LIMIT 1',[job.run.id])).rowCount;
      const diagnosed=job.stage.agent==='execution' && job.stage.context.phase==='diagnosis' && !error;
      const executed=job.stage.agent==='execution' && !['planning','diagnosis'].includes(job.stage.context.phase) && !error && !partial;
      await db.query(`UPDATE research.stages SET status=$2,message=$3,lease_token=NULL,lease_until=NULL WHERE id=$1`,
        [job.stage.id,error ? 'failed' : partial ? 'pending' : executed || diagnosed ? 'completed' : unsupported ? 'not_supported' : 'awaiting_review',error || (partial ? `Parte ${(job.part || job.testPart || job.automationPart || job.executionJob).sequence} concluída; checkpoint preservado.` : diagnosed ? 'Diagnóstico técnico proposto; revisão humana separada.' : executed ? 'Evidências independentes do executor preservadas.' : unsupported ? 'Nenhum caso selecionado pôde ser automatizado. Consulte as justificativas.' : 'Resultados estruturados disponíveis para revisão humana.')]);
      await db.query(`UPDATE research.runs SET status=$2,finished_at=${error || unsupported || executed ? 'now()' : 'NULL'} WHERE id=$1`,[job.run.id,error ? 'failed' : partial ? 'pending' : unsupported && job.run.workflow_mode==='autonomous/v1' ? 'awaiting_review' : unsupported || executed ? 'completed' : 'awaiting_review']);
      if(diagnosed || (executed && !await execution.queueDiagnosis(db,job.run.id)))await evaluation.queue(db,job.run.id);
    });
  }
  return {
    async recoverExpired() {
      return transaction(pool, async db => {
        const expired = (await db.query(`SELECT r.id FROM research.runs r WHERE r.status='running'
          AND EXISTS(SELECT 1 FROM research.stages s WHERE s.run_id=r.id AND s.status='running' AND s.lease_until<now())
          FOR UPDATE SKIP LOCKED`)).rows;
        for (const run of expired) {
          const stages = (await db.query("SELECT id FROM research.stages WHERE run_id=$1 AND status='running' AND lease_until<now() FOR UPDATE",[run.id])).rows;
          for (const stage of stages) {
            await db.query("UPDATE research.attempts SET status='interrupted',finished_at=now(),error='Worker interrompido ou prazo da etapa excedido.' WHERE stage_id=$1 AND status='running'",[stage.id]);
            await db.query("UPDATE research.stages SET status='failed',message='Worker interrompido. Repetição explícita necessária.',lease_token=NULL,lease_until=NULL WHERE id=$1",[stage.id]);
            await db.query("UPDATE research.execution_jobs SET status='failed',error='Worker interrompido.' WHERE stage_id=$1 AND status='running'",[stage.id]);
            await db.query("UPDATE research.execution_plans SET status='failed' WHERE run_id=$1 AND status='running'",[run.id]);
            await db.query("UPDATE research.agent_sessions SET status='interrupted',stop_reason='worker_interrupted',finished_at=now(),usage_unknown=usage_unknown OR EXISTS(SELECT 1 FROM research.agent_steps p WHERE p.session_id=research.agent_sessions.id AND p.status='requested') WHERE stage_id=$1 AND status='running'",[stage.id]);
          }
          await db.query("UPDATE research.runs SET status='failed',finished_at=now() WHERE id=$1",[run.id]);
          await appendRunEvent(db,{run_id:run.id,source_key:`worker:interrupted:${stages.map(s=>s.id).join(':')}`,kind:'worker_interrupted',payload:{stage_ids:stages.map(s=>s.id),reason:'Worker interrompido ou prazo excedido; resposta não presumida.'}});
          await db.query("UPDATE research.execution_jobs SET status='failed',error='Worker interrompido; consulte o executor antes de repetir.',finished_at=now() WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.requirement_parts SET status='failed',error='Worker interrompido; parte requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.test_parts SET status='failed',error='Worker interrompido; lote requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
          await db.query("UPDATE research.automation_parts SET status='failed',error='Worker interrompido; lote requer repetição.' WHERE run_id=$1 AND status='running'",[run.id]);
        }
        return expired.length;
      });
    },
    async processOne() {
      await autonomy.recoverReady();
      const job = await claim();
      if (!job) return false;
      const started = Date.now();
      let inputRef = null, outputRef = null, metadata = null, output = null, error = null,automationValidated=false;
      try {
        const snapshot = await store.json(job.run.snapshot);
        const isAgent=agentMode(snapshot,job.stage.agent)==='agent/v1' && (job.stage.agent!=='execution' || ['planning','diagnosis'].includes(job.stage.context.phase));
        const policy=isAgent ? resolveAgentPolicy(snapshot) : null;
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
        const definition = job.part ? {schema:PART_SCHEMA} : ['automation','evaluation','execution'].includes(job.stage.agent) ? {schema:job.stage.context.schema} : (snapshot.agent_definitions || AGENTS).find(agent => agent.agent === job.stage.agent);
        const grounded=job.stage.agent==='requirements' && job.stage.context?.citation_mode==='catalog/v1' ? citationRequest(input,definition.schema) : null;
        if(grounded)input=grounded.input;
        const isAutomation=job.stage.agent==='automation';
        const request = { model:job.run.model,parameters:job.run.parameters,instruction:job.stage.instruction+(isAutomation ? ' '+AUTOMATION_COVERAGE_GUARD : ''),
          instruction_version:job.stage.instruction_version+(isAutomation ? '+coverage-guard/1' : ''),schema:grounded?.schema || (job.stage.agent==='evaluation' ? evaluationRequestSchema(input) : definition.schema),input };
        if(job.run.workflow_mode==='autonomous/v1') {request.instruction='Condição autonomous/v1: entradas de outros agentes foram admitidas por verificações automáticas, sem revisão ou aprovação humana. Não alegue julgamento humano das entradas. '+request.instruction;request.instruction_version+='+autonomous/v1';}
        inputRef = await store.put(request);
        await transaction(pool,async db=>{await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE',[job.run.id]);await recordAttemptInput(db,job,inputRef);});
        // Cliente injetável; prazo também cobre provedores que não respeitem AbortSignal.
        const controller = new AbortController();
        let timer;
        let monitoring=false;
        const monitor=setInterval(async()=>{
          if(monitoring || controller.signal.aborted)return;monitoring=true;
          try{const row=(await pool.query('SELECT status,lease_token FROM research.stages WHERE id=$1',[job.stage.id])).rows[0];if(row?.status!=='running' || row.lease_token!==job.token)controller.abort();}
          catch{controller.abort();}finally{monitoring=false;}
        },2000);
        try {
          const emptyPart=job.part && input.documents.every(doc=>doc.pages.every(page=>!page.text.trim()));
          const agentOperation=async()=>{
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
                model:job.run.model,parameters:job.run.parameters,instruction:request.instruction,instruction_version:request.instruction_version,toolDefinitions:tools.declarations,terminalTool:isRequirements?'submit_requirements':isEvaluation?'submit_evaluation':isPlanning?'submit_execution_plan':isDiagnosis?'submit_execution_diagnostics':'submit_test_cases',signal:controller.signal});
              input=terminal.input;inputRef=await store.put({...request,input,execution_mode:'agent/v1'});
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
              model:job.run.model,parameters:job.run.parameters,instruction:request.instruction,instruction_version:request.instruction_version,toolDefinitions:tools.declarations,signal:controller.signal});
            input=terminal.input;
            inputRef=await store.put({...request,input,execution_mode:'agent/v1'});
            return {raw:JSON.stringify(terminal.output),metadata:{provider:'agent-runtime',execution_mode:'agent/v1',cost:null}};
          };
          const operation=isAgent ? agentOperation() : emptyPart ? Promise.resolve({raw:JSON.stringify({requirements:[],alerts:[{kind:'extraction_limitation',description:'Parte sem texto interpretável. Confira/transcreva o documento original.',sources:[]}]}),metadata:{provider:'deterministic-empty-page',usage:null,cost:null}}) :
            job.stage.agent==='execution' ? execution.perform(input,controller.signal).then(result=>({raw:JSON.stringify(result),metadata:{provider:'deterministic-executor'}})) : generate({...request,signal:controller.signal});
          const result = await Promise.race([operation,new Promise((_,reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Prazo da operação excedido.')); },isAgent ? policy.limits.max_duration_ms+5000 : 95000);
          })]);
          metadata = result.metadata;
          let resolved=false,automationErrors=[];
          try {
          assertComplete(result.metadata);
          output = JSON.parse(result.raw);
          if(grounded)output=resolveCitations(output,input,request.schema);
          if(job.part)validatePart(output,input);
          else if(job.stage.agent==='automation') {
            const checked=partitionAutomation(output,input);output=checked.output;automationErrors=checked.errors;automationValidated=true;
            assert(!automationErrors.length,automationErrors.map(item=>`${input.test_cases.find(row=>row.id===item.test_case_id)?.content.code || item.test_case_id}: ${item.reason}`).join(' '),422);
          }
          else if(job.stage.agent==='evaluation')validateEvaluation(output,input);
          else if(job.stage.agent==='execution' && isAgent) {if(job.stage.context.phase==='planning')validateExecutionProposal(output,input);else validateExecutionDiagnostics(output,input);}
          else if(job.stage.agent!=='execution')validateOutput(job.stage.agent,output,input);
          if(job.stage.agent==='tests')assertTestCoverage(output.test_cases,input.requirements);
          resolved=Boolean(grounded);
          } finally {outputRef=await store.put({raw:result.raw,...(resolved ? {validated_output:output,citation_method:'source-catalog/v1'} : {}),
            ...(automationValidated ? {validated_output:output,validation_errors:automationErrors} : {})});}
        } finally { clearTimeout(timer);clearInterval(monitor); }
      } catch (cause) {
        // Não persistir objetos do SDK, cabeçalhos ou credenciais recebidos em erros remotos.
        error = cause.statusCode === 403 ? 'Consulta recusada pelo escopo da tarefa. Consulte a trajetória do agente.' : cause.statusCode === 422 ? cause.message.slice(0,1000) :
          cause instanceof SyntaxError ? 'Resposta do modelo não é JSON válido. Consulte a saída bruta preservada.' :
          cause.name === 'AbortError' || cause.message?.includes('Prazo') ? 'Tempo limite da chamada ao modelo excedido.' :
          'Falha de processamento. Verifique disponibilidade do provedor, modelo, credenciais e armazenamento.';
      }
      try{await finish(job,{inputRef,outputRef,metadata,output,error,automationValidated,elapsed:Date.now()-started});}
      catch(cause){await finish(job,{inputRef,outputRef,metadata,output,error:cause.statusCode===422 ? cause.message.slice(0,1000) : 'Falha ao consolidar/persistir resultados; confira o armazenamento e o banco.',elapsed:Date.now()-started});}
      await autonomy.advance(job.run.id);
      return true;
    },
  };
}

function assertComplete(metadata) {
  if(metadata?.finish_reasons?.includes('MAX_TOKENS')) {
    const error=new Error('Resposta interrompida pelo limite de saída do modelo. Continue em partes menores; nenhuma saída parcial foi aceita.');error.statusCode=422;throw error;
  }
}
