import {createTaskQueue} from './task-queue.js';
import {createStageLifecycle} from './stage-lifecycle.js';
import {prepareStageInput,runAgentStage} from './stage-handlers.js';

import {AGENTS} from '../agents/registry.js';
import {validateOutput} from '../agents/validation.js';

import { transaction } from '../errors.js';
import { createAutomationService } from '../automation.js';
import {partitionAutomation,AUTOMATION_COVERAGE_GUARD} from '../agents/tests/scripts/contracts.js';
import {createExecutionService} from '../execution.js';
import {createEvaluationService} from '../evaluation.js';
import {validateEvaluation,evaluationRequestSchema} from '../agents/evaluation/contracts.js';
import {PART_SCHEMA,validatePart} from '../agents/requirements/parts.js';
import {citationRequest,resolveCitations} from '../agents/requirements/citations.js';
import {assertTestCoverage} from '../agents/tests/cases/parts.js';
import {assert} from '../errors.js';
import {agentMode,resolveAgentPolicy} from '../runtime/policy.js';
import {createAgentTurnGateway} from '../runtime/model-gateway.js';

import {validateExecutionProposal} from '../agents/execution/planning/contracts.js';

import {validateExecutionDiagnostics} from '../agents/execution/diagnosis/contracts.js';

import {createAutonomyController} from './autonomous-flow.js';

import {recordAttemptInput} from '../attempt-snapshots.js';

export function createResearchOrchestrator({ pool, store, generate, executorClient, generateTurn=createAgentTurnGateway() }) {
  const automation=createAutomationService({pool,store});
  const execution=createExecutionService({pool,store,client:executorClient});
  const evaluation=createEvaluationService({pool,store});
  const autonomy=createAutonomyController({pool,store,executorClient});
  const {claim}=createTaskQueue({pool});
  const {finish,recoverExpired}=createStageLifecycle({pool,store,automation,execution,evaluation});
  return {
    recoverExpired,
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
        let input=await prepareStageInput({pool,store,automation,execution,evaluation,job,snapshot,isAgent});
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
          const agentOperation=()=>runAgentStage({pool,store,job,snapshot,policy,generateTurn,request,input,signal:controller.signal,
            onInputPrepared:update=>{if(Object.hasOwn(update,'input'))input=update.input;if(Object.hasOwn(update,'inputRef'))inputRef=update.inputRef;}});
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
