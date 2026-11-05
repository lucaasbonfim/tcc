export const AGENT_ROLES=['requirements','tests','execution','evaluation'];
export const normalizeAgent=role=>role==='automation'?'tests':role;
export const AGENT_NAMES={requirements:'Requisitos',tests:'Testes',execution:'Execução',evaluation:'Avaliação'};
export const EVENT_LABELS={operation_requested:'Operação solicitada',model_turn_failed:'Chamada ao modelo falhou',model_retry_scheduled:'Aguardando nova tentativa do modelo',run_created:'Execução preparada',attempt_started:'Tarefa iniciada',input_prepared:'Entrada preservada',input_effective:'Entrada efetiva',session_started:'Sessão iniciada',model_turn_requested:'Chamada ao modelo',model_turn_completed:'Resposta do modelo',model_response_late:'Resposta tardia do modelo',model_step_reused:'Turno reaproveitado',tool_requested:'Ferramenta solicitada',tool_observed:'Resultado da ferramenta',tool_rejected:'Ferramenta recusada',session_finished:'Sessão encerrada',message_request:'Pedido entre agentes',message_response:'Resposta entre agentes',message_unavailable:'Consulta indisponível',message_record:'Registro de consulta',artifact_produced:'Saída preservada',output_rejected:'Saída recusada',late_output:'Saída tardia, não aplicada',attempt_finished:'Tarefa concluída',attempt_failed:'Tarefa falhou',artifacts_admitted:'Artefatos admitidos',human_review:'Revisão humana',human_assessment:'Julgamento posterior',run_cancelled:'Execução cancelada',workflow_finished:'Fluxo concluído',workflow_failed:'Fluxo interrompido',execution_authorized:'Execução autorizada',worker_interrupted:'Worker interrompido',planning_requested:'Planejamento solicitado',automation_prepared:'Geração de scripts preparada'};
const activities={list_document_sources:'Localizando trechos dos documentos',read_document_sources:'Lendo documentação',submit_requirements:'Entregando requisitos',list_test_requirements:'Listando requisitos',read_test_requirement:'Lendo requisito',submit_test_cases:'Entregando casos de teste',request_requirement_clarification:'Pedindo esclarecimento ao A1',read_clarification_sources:'Conferindo fontes para responder',respond_clarification:'Respondendo ao A2',list_sources:'Localizando arquivos',read_source:'Lendo código',find_symbols:'Localizando símbolos',get_approved_case:'Conferindo caso de teste',get_approved_requirement:'Conferindo requisito',get_adapter_capabilities:'Conferindo adaptador',prepare_automation_scope:'Preparando fontes dos testes',submit_automation:'Entregando scripts',get_execution_capabilities:'Conferindo ambiente de execução',list_execution_scripts:'Listando scripts',read_execution_script:'Conferindo script',validate_execution_groups:'Validando lotes',submit_execution_plan:'Entregando plano de execução',list_execution_results:'Listando resultados',read_execution_evidence:'Examinando evidências',submit_execution_diagnostics:'Entregando diagnóstico',request_script_review:'Pedindo revisão ao A2',read_script_review_context:'Conferindo script e resultado',respond_script_review:'Respondendo ao A3',list_evaluation_results:'Listando evidências',read_evaluation_context:'Conferindo regra e evidência',submit_evaluation:'Entregando conclusões'};
export function eventCategory(event){if(event.kind.startsWith('message_'))return 'messages';if(event.actor==='human')return 'human';if(event.snapshot_id && ['input','output','artifact','late'].some(s=>event.kind.startsWith(s)))return 'artifacts';if(/^(model_|tool_|session_)/.test(event.kind))return 'technical';return 'control';}
export const agentName=role=>role==='automation'?'A2 · Scripts':AGENT_ROLES.includes(role)?`A${AGENT_ROLES.indexOf(role)+1} · ${AGENT_NAMES[role]}`:null;
export function projectAgentMap(run,events,{historical=false}={}) {
  const nodes=Object.fromEntries(AGENT_ROLES.map(role=>[role,{role,state:'idle',activity:'Ainda não iniciado',calls:0,artifacts:0,lastEvent:null}])),sessions=new Map(),attempts=new Map(),messages=new Map();let stopped=false;
  for(const event of events){const role=normalizeAgent(event.agent),node=nodes[role],payload=event.payload || {};
    if(node)node.lastEvent=event;
    if(event.kind==='attempt_started'){
      stopped=false;
      for(const [id,session] of sessions)if(session.stage_id===event.stage_id && session.attempt_id!==event.attempt_id)sessions.delete(id);
      for(const [id,attempt] of attempts)if(attempt.stage_id===event.stage_id)attempts.delete(id);
      attempts.set(event.attempt_id,event);if(node){node.state='active';node.activity=event.actor==='executor'?'Executando testes':'Preparando tarefa';}
    }
    if(event.kind==='session_started')sessions.set(event.session_id,{...event,activity:'Preparando tarefa'});
    const session=sessions.get(event.session_id);
    if(event.kind==='model_turn_requested'){if(node)node.calls++;if(session)session.activity='Consultando modelo';}
    if(event.kind==='model_retry_scheduled' && session)session.activity=`Aguardando provedor · nova tentativa em ${Math.ceil(payload.delay_ms/1000)} s`;
    if(event.kind==='model_turn_failed' && session)session.activity='Chamada ao modelo indisponível';
    if(event.kind==='model_turn_completed' && session)session.activity='Processando resposta';
    if(event.kind==='tool_requested' && session)session.activity=activities[payload.name] || 'Consultando ferramenta';
    if(['tool_observed','tool_rejected'].includes(event.kind) && session)session.activity=event.kind==='tool_rejected'?'Ferramenta recusada':'Consulta concluída';
    if(event.kind==='session_finished')sessions.delete(event.session_id);
    if(event.kind==='artifact_produced' && node)node.artifacts+=payload.count || 1;
    if(['attempt_finished','attempt_failed'].includes(event.kind)){
      attempts.delete(event.attempt_id);for(const [id,s] of sessions)if(s.attempt_id===event.attempt_id)sessions.delete(id);
      if(node){node.state=event.kind==='attempt_failed'?'failed':payload.partial?'ready':'completed';node.activity=event.kind==='attempt_failed'?'Tarefa interrompida':payload.partial?'Parte concluída':'Saída preservada';}
    }
    if(event.kind==='message_request')messages.set(event.message_id,{id:event.message_id,sender:normalizeAgent(event.agent),recipient:normalizeAgent(event.recipient),request:event,response:null});
    if(['message_response','message_unavailable','message_record'].includes(event.kind) && messages.has(event.message_id))messages.get(event.message_id).response=event;
    if(['run_cancelled','worker_interrupted','workflow_failed','workflow_finished'].includes(event.kind)){
      stopped=true;for(const n of Object.values(nodes))if(n.state==='active'||n.state==='ready'){n.state=event.kind==='run_cancelled'?'cancelled':event.kind==='workflow_finished'?'completed':'interrupted';n.activity=event.kind==='run_cancelled'?'Cancelado':'Processamento encerrado';}sessions.clear();attempts.clear();
    }
  }
  const terminal=stopped || !historical && ['failed','cancelled','completed'].includes(run.status);
  for(const node of Object.values(nodes)){
    const active=[...sessions.values()].filter(s=>normalizeAgent(s.agent)===node.role),pending=[...messages.values()].filter(m=>m.sender===node.role && !m.response),tasks=[...attempts.values()].filter(t=>normalizeAgent(t.agent)===node.role);
    if(!historical){const stages=(run.stages || []).filter(s=>normalizeAgent(s.agent)===node.role),failed=stages.find(s=>s.status==='failed'),review=stages.find(s=>s.status==='awaiting_review');
      if(failed){node.state='failed';node.activity='Tarefa interrompida';}
      else if(!terminal && review && !active.length && !tasks.length){node.state='review';node.activity=run.workflow_mode==='autonomous/v1'?'Validando saída':'Aguardando revisão';}
      else if(stages.length && stages.every(s=>['completed','not_supported'].includes(s.status)) && stages.some(s=>s.status==='completed') && !active.length && !tasks.length){node.state='completed';node.activity='Etapa concluída';}
    }
    if(!terminal && (active.length || tasks.length)){
      node.state=pending.length?'waiting':'active';node.activity=pending.length?`Aguardando ${agentName(pending[0].recipient)?.split(' · ')[0] || 'resposta'}`:active.at(-1)?.activity || 'Executando testes';
      node.consultation=active.some(s=>s.payload?.parent_session_id || s.message_id);
    }else if(terminal && ['active','ready','waiting'].includes(node.state)){node.state=run.status==='cancelled'?'cancelled':'interrupted';node.activity='Processamento interrompido';}
  }
  return {nodes:AGENT_ROLES.map(role=>nodes[role]),messages:[...messages.values()],terminal};
}
