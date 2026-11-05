export const WORK_STAGES=[['requirements','Requisitos','A1'],['tests','Casos de teste','A2'],['automation','Scripts','A2'],['evidence','Execução','A3'],['analysis','Resultados','A4']];
export const quantity=(count,singular,plural)=>`${count} ${count===1?singular:plural}`;
export function summarizeResults(results=[]) {
  return {
    'Casos com teste concluído':new Set(results.filter(r=>['passed','failed'].includes(r.status)).map(r=>r.test_case_id)).size,
    'Testes aprovados':results.filter(r=>r.status==='passed').length,
    'Testes reprovados':results.filter(r=>r.status==='failed').length,
    'Problemas técnicos':results.filter(r=>['test_error','compilation_error','infrastructure_error','dependency_unavailable','timeout'].includes(r.status)).length,
    'Inconclusivos':results.filter(r=>r.status==='inconclusive').length,
  };
}
export function nextRunAction(run) {
  const stages=run.stages || [],stage=agent=>stages.find(s=>s.agent===agent),autonomous=run.workflow_mode==='autonomous/v1';
  if(run.workflow_error)return {title:'A análise foi interrompida',description:run.workflow_error,view:'timeline',label:'Conferir interrupção'};
  if(run.status==='failed')return {title:'Uma etapa precisa de atenção',description:stages.find(s=>s.status==='failed')?.message || 'Confira a falha antes de retomar o processamento.',view:'timeline',label:'Conferir falha'};
  if(run.status==='cancelled')return {title:'Análise encerrada',description:'Os documentos, artefatos e registros anteriores continuam disponíveis.',view:'history',label:'Consultar registros'};
  if(run.status==='pending')return {title:'Aguardando processamento',description:'A análise está na fila. O processamento da próxima etapa ainda não começou.',view:'timeline',label:'Acompanhar agentes'};
  if(['pending','running'].includes(run.status) || autonomous&&run.status==='awaiting_review'){
    const current=stages.find(s=>['running','pending'].includes(s.status)),entry=WORK_STAGES.find(([key])=>key===(current?.agent==='execution'?'evidence':current?.agent==='evaluation'?'analysis':current?.agent));
    return {title:entry?`${entry[2]} · ${entry[1]} em processamento`:'Análise em processamento',description:'Os agentes estão trabalhando. Você pode acompanhar as consultas e os artefatos preservados.',view:'timeline',label:'Acompanhar agentes'};
  }
  const review=stages.find(s=>s.status==='awaiting_review');
  if(review){const view=review.agent==='execution'?'evidence':review.agent==='evaluation'?'analysis':review.agent;return {title:review.agent==='execution'?'Confira o plano antes de autorizar':'Aguardando sua revisão',description:review.agent==='requirements'?'Confira os requisitos e suas fontes para gerar os casos de teste.':review.agent==='tests'?'Revise os casos e as respostas entre agentes antes de preparar os scripts.':review.agent==='automation'?'Confira o código dos scripts. A aprovação não autoriza a execução.':review.agent==='execution'?'O plano do A3 está pronto. Executar os testes exige sua autorização explícita.':'Confira os diagnósticos e as classificações propostas para concluir a análise.',view,label:review.agent==='execution'?'Revisar plano':'Revisar agora'};}
  if(!stage('automation')&&stage('tests')?.status==='completed')return {title:'Casos revisados. Prepare os testes automatizados.',description:'Selecione um módulo e gere scripts com o A2. Nenhum código será executado nesta operação.',view:'automation',label:'Preparar scripts'};
  if(stage('automation')?.status==='not_supported')return {title:'Não foram gerados scripts compatíveis',description:'Consulte as limitações registradas pelo A2. Os casos textuais não foram executados.',view:'automation',label:'Conferir limitações'};
  if(stage('automation')?.status==='completed'&&!(run.execution_jobs || []).length&&!autonomous)return {title:'Scripts revisados. Prepare a execução.',description:'Confira o ambiente e autorize o escopo antes de executar testes.',view:'evidence',label:'Preparar execução'};
  return {title:'Resultados disponíveis',description:autonomous?'Os artefatos foram admitidos pela plataforma. A avaliação humana pode ser registrada separadamente.':'Consulte as evidências e as decisões preservadas nesta análise.',view:'analysis',label:'Consultar resultados'};
}
export function workStageStatus(run,key) {
  const agent=key==='evidence'?'execution':key==='analysis'?'evaluation':key;
  const status=run.stages?.find(s=>s.agent===agent)?.status;
  if(['evidence','analysis'].includes(key)&&status==='not_supported'&&!run.stages?.some(s=>s.agent==='automation'))return 'blocked';
  return status ?? 'blocked';
}
