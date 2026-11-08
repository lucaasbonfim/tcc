import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useResearch } from '../hooks/useResearch';
import { research } from '../services/research.service';
import { AGENT_LABELS, date, shortId } from '../utils/research';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ResearchStatus from '../components/ResearchStatus';
import ResearchReviewWorkspace from '../components/ResearchReviewWorkspace';
import ResearchRunNavigation from '../components/ResearchRunNavigation';
import {RUN_VIEWS} from '../utils/run-views';
import ResearchAutomationPanel from '../components/ResearchAutomationPanel';
import ResearchExecutionPanel from '../components/ResearchExecutionPanel';
import ResearchEvaluationPanel from '../components/ResearchEvaluationPanel';
import ResearchTestCoverage from '../components/ResearchTestCoverage';
import ResearchAgentHistory from '../components/ResearchAgentHistory';
import ResearchAgentMessages from '../components/ResearchAgentMessages';
import ResearchExecutionDiagnostics from '../components/ResearchExecutionDiagnostics';
import ResearchTimeline from '../components/ResearchTimeline';
import ResearchRunOverview from '../components/ResearchRunOverview';
import UnsavedChangesGuard from '../components/UnsavedChangesGuard';
import {nextRunAction} from '../utils/run-journey';

function clean(content) {return Object.fromEntries(Object.entries(content).map(([key,value]) => [key,Array.isArray(value) && value.every(item => typeof item==='string') ? value.map(item => item.trim()).filter(Boolean) : value]));}

export default function ResearchRunPage() {
  const {runId} = useParams();
  const navigate=useNavigate();
  const {data:run,error,loading,reload} = useResearch(`/runs/${runId}`,true);
  const [params,setParams] = useSearchParams();
  const requestedView=params.get('view');
  const tab = RUN_VIEWS.some(([value])=>value===requestedView)?requestedView:'overview';
  const [busy,setBusy] = useState(false);
  const [actionError,setActionError] = useState('');
  const [justification,setJustification] = useState('');
  const [artifact,setArtifact] = useState(null);
  const [cancelReason,setCancelReason]=useState('');
  const [drafts,setDrafts]=useState(new Set());
  const onDraftChange=useCallback((id,dirty)=>setDrafts(previous=>{if(previous.has(id)===dirty)return previous;const next=new Set(previous);if(dirty)next.add(id);else next.delete(id);return next;}),[]);
  async function action(work,refresh=true) {setBusy(true);setActionError('');try{await work();if(refresh)reload();}catch(cause){setActionError(cause.message);}finally{setBusy(false);}}
  if (loading && !run) return <Loading>Carregando execução...</Loading>;
  if (!run) return <ErrorMessage>{error}</ErrorMessage>;
  const project = run.snapshot_data.project;
  const autonomous=run.workflow_mode==='autonomous/v1';
  const next=nextRunAction(run),onView=view=>setParams({view});
  const ready={requirements:true,tests:run.stages.some(s=>s.agent==='requirements'&&s.status==='completed')||run.test_cases.length>0,automation:run.stages.some(s=>s.agent==='tests'&&s.status==='completed')||run.stages.some(s=>s.agent==='automation'),evidence:run.stages.some(s=>s.agent==='automation'&&s.status==='completed')||run.execution_jobs.length>0,analysis:run.evidence.length>0||run.findings.length>0};
  const blocked=Object.hasOwn(ready,tab)&&!ready[tab];
  const reviewing = run.stages.find(stage => stage.status==='awaiting_review');
  const items = tab==='requirements' ? run.requirements : run.test_cases;
  const editable = !autonomous && run.status==='awaiting_review' && reviewing?.agent===tab;
  const messagesResolved=(run.agent_messages || []).every(m=>m.status==='answered' && ['acknowledged','rejected'].includes(m.review_status));
  const canApprove = editable && items.some(item=>item.review_status!=='rejected') && drafts.size===0 && (tab!=='tests' || (run.test_coverage?.missing.length===0 && messagesResolved));
  return <div className="page-stack"><UnsavedChangesGuard dirty={drafts.size>0}/><div className="page-heading"><div><Link className="back-link" to={`/admin/projects/${run.project_id}`}>← Projeto</Link><h1>{project.name}</h1><p>Análise iniciada em {date(run.created_at)} · {autonomous?'Autônoma':'Assistida'}</p></div><div className="heading-actions"><ResearchStatus status={run.status}/><Button variant="secondary" onClick={reload}>Atualizar</Button></div></div>
    <ErrorMessage>{error || actionError}</ErrorMessage>
    <ErrorMessage>{run.workflow_error}</ErrorMessage>

    {run.resumed_from_run_id && <p className="notice">Continuação com checkpoints preservados. <Link to={`/admin/runs/${run.resumed_from_run_id}`}>Consultar análise anterior e suas tentativas</Link>.</p>}
    {run.continuations?.length>0 && <p className="notice">Esta análise possui continuação: {run.continuations.map(next=><Link key={next.id} to={`/admin/runs/${next.id}`}>abrir {shortId(next.id)} ({next.status}) </Link>)}.</p>}

    {!autonomous && run.status==='failed' && !run.continuations?.some(next=>['pending','running','awaiting_review'].includes(next.status)) && run.stages.some(stage=>stage.agent==='requirements' && stage.status==='failed') && run.requirement_parts?.some(part=>part.status==='completed') && run.requirement_parts.some(part=>part.status!=='completed') && <Card><h2>Continuar a partir das partes concluídas</h2><p className="muted">Uma nova análise vinculada reutiliza os checkpoints válidos. Documentos, condição e histórico anteriores ficam preservados.</p><Button disabled={busy} onClick={()=>action(async()=>{const next=await research.post(`/runs/${runId}/resume`,{operation_record:'system/v1'});navigate(`/admin/runs/${next.id}`);},false)}>Continuar a partir dos checkpoints</Button></Card>}
    <ResearchRunNavigation view={tab} run={run}/>
    {tab==='overview'&&<ResearchRunOverview run={run} onView={onView}/>}
    {blocked&&<Card><h2>Esta etapa ainda não está disponível</h2><p className="muted">{tab==='tests'?'Conclua a revisão dos requisitos primeiro.':tab==='automation'?'Conclua a revisão dos casos de teste primeiro.':tab==='evidence'?'Gere e aprove os scripts antes de preparar a execução.':'Execute testes para obter evidências antes da avaliação.'}</p><Button onClick={()=>onView(next.view)}>{next.label}</Button></Card>}
    {tab==='tests'&&<ResearchAgentMessages run={run} onChange={reload}/>}
    {!blocked && ['requirements','tests'].includes(tab) && <Card><div className="section-heading"><div><h2>{tab==='requirements' ? 'Requisitos identificados' : 'Casos de teste textuais'}</h2><p>{items.length} itens · {items.filter(item => item.review_status==='pending').length} aguardando revisão</p></div></div>
      {tab==='tests' && <ResearchTestCoverage run={run} busy={busy || loading || drafts.size>0} onComplete={()=>action(()=>research.post(`/runs/${runId}/tests/complete`,{operation_record:'system/v1'}))}/>}
      {editable && <div className="stage-approval"><h3>Corrija o que precisar e aprove todos de uma vez</h3><p>O botão aprova todos os itens pendentes e conclui esta etapa. Suas correções salvas serão usadas; itens rejeitados continuam excluídos.</p>{drafts.size>0 && <p role="status">Salve ou descarte as alterações em edição antes de continuar.</p>}<details><summary>Adicionar observação (opcional)</summary><label>Observação da aprovação<textarea rows={2} maxLength={5000} value={justification} onChange={event=>setJustification(event.target.value)}/></label></details><Button className="mt-3" disabled={busy || loading || !canApprove} onClick={()=>action(async()=>{await research.post(`/runs/${runId}/approve/${tab}`,{approve_pending:true,items:items.map(({id,revision})=>({id,revision})),justification:justification.trim() || 'Aprovação em lote pelo pesquisador dos itens pendentes, preservando correções e rejeições.'});setJustification('');setParams({view:tab==='requirements' ? 'tests' : 'automation'});})}>{busy ? 'Salvando…' : tab==='requirements' ? 'Aprovar todos e gerar casos de teste →' : 'Aprovar todos e continuar →'}</Button></div>}
      {tab==='requirements' && run.requirement_parts?.length>0 && <details className="secondary-section"><summary>Processamento dos documentos</summary><strong>{run.requirement_parts.filter(p=>p.status==='completed').length}/{run.requirement_parts.length} partes processadas</strong><p>Checkpoints preservados; somente partes não concluídas são retomadas.</p><details><summary>Páginas, trechos e estados</summary>{run.requirement_parts.map(part=><div key={part.id}><p>Parte {part.sequence}: <ResearchStatus status={part.status}/>{part.error && ` · ${part.error}`}</p><pre className="code-panel">{JSON.stringify(part.segments,null,2)}</pre></div>)}</details></details>}
      {(run.agent_outputs?.[tab]?.alerts || run.agent_outputs?.[tab]?.warnings || []).map((warning,index) => <div className="notice compact" key={index}>{typeof warning==='string' ? warning : <><strong>{warning.kind}</strong><p>{warning.description}</p>{warning.sources?.map((source,i) => <small key={i}>{source.document_id} · p. {source.page} · {source.quote}</small>)}</>}</div>)}
      {!items.length ? <div className="empty-state"><strong>{tab==='requirements' ? 'Nenhum requisito disponível nesta execução.' : 'Nenhum caso de teste disponível nesta execução.'}</strong><p>{tab==='tests' ? 'A geração depende da revisão e aprovação dos requisitos e do processamento do segundo agente.' : 'Aguarde o processamento ou consulte o erro registrado no histórico.'}</p></div> : <ResearchReviewWorkspace items={items} kind={tab} documents={run.snapshot_data.documents} requirements={run.requirements} editable={editable} busy={busy || loading} onDraftChange={onDraftChange} onReview={(row,decision,content,reason) => action(() => research.post(`/runs/${runId}/reviews/${tab}/${row.id}`,{decision,content:clean(content),justification:reason,revision:row.revision}))}/>}
    </Card>}
    {!blocked && tab==='automation' && <ResearchAutomationPanel run={run} busy={busy} action={action} onView={onView} onDraftChange={onDraftChange}/>}
    {tab==='timeline' && <ResearchTimeline key={run.id} run={run} onChange={reload}/>}
    {!blocked && tab==='evidence' && <ResearchExecutionPanel run={run} busy={busy} action={action} onChange={reload}/>}
    {!blocked && tab==='analysis' && <ResearchEvaluationPanel run={run} busy={busy} action={action} onChange={reload}/>}
    {tab==='analysis'&&<><ResearchAgentMessages run={run} onChange={reload}/><ResearchExecutionDiagnostics run={run} onChange={reload}/></>}
    {tab==='history' && <><Card><div className="section-heading"><h2>Configuração preservada</h2><div className="inline-actions">{['json','csv'].map(format => <Button key={format} variant="secondary" disabled={busy} onClick={() => action(() => research.download(`/runs/${runId}/export/${format}`,`research-${runId}.${format}`),false)}>Exportar {format.toUpperCase()}</Button>)}</div></div><dl className="metadata-list"><dt>Execução</dt><dd><code>{run.id}</code></dd><dt>Versão do código</dt><dd><code>{run.snapshot_data.code_version.commit_sha}</code><p>{run.snapshot_data.code_version.requested_ref}</p></dd><dt>Modo de trabalho</dt><dd>{autonomous?'Autônomo':'Assistido'}</dd><dt>Política dos agentes</dt><dd><details><summary>Consultar modos e limites preservados</summary><pre className="code-panel">{JSON.stringify(run.snapshot_data.agent_policy ?? {legacy:true},null,2)}</pre></details></dd><dt>Modelo solicitado</dt><dd>{run.model}</dd><dt>Parâmetros</dt><dd><code>{JSON.stringify(run.parameters)}</code></dd><dt>Início / fim</dt><dd>{date(run.created_at)} / {date(run.finished_at)}</dd><dt>Documentos</dt><dd>{run.snapshot_data.documents.map(doc => <p key={doc.id}>{doc.name} · v{String(doc.version)} {doc.sha256 && <code>{shortId(doc.sha256)}</code>}</p>)}</dd><dt>Tokens e custos</dt><dd>Somente valores informados pelo provedor, por tentativa. Custo não informado permanece nulo.</dd></dl></Card>
      <ResearchAgentHistory run={run}/>
      <Card><div className="section-heading"><h2>Tentativas dos agentes</h2></div>{!run.attempts.length ? <p className="muted">Nenhuma tentativa iniciada pelo worker.</p> : run.attempts.map(attempt => <div className="attempt-row" key={attempt.id}><div><h3>{AGENT_LABELS[run.stages.find(stage => stage.id===attempt.stage_id)?.agent]} · tentativa {attempt.number}</h3><ResearchStatus status={attempt.status}/><p className="muted">{date(attempt.started_at)} · {attempt.duration_ms !== null ? `${attempt.duration_ms} ms` : 'Duração não disponível'}</p>{attempt.error && <ErrorMessage>{attempt.error}</ErrorMessage>}<details><summary>Metadados do provedor</summary><pre className="code-panel">{JSON.stringify(attempt.provider_metadata,null,2)}</pre></details></div><div className="inline-actions">{['input','output'].filter(type => attempt[type]).map(type => <button className="text-button" disabled={busy} key={type} onClick={() => action(async () => setArtifact({title:type==='input' ? 'Entrada preservada' : 'Saída bruta preservada',data:await research.get(`/runs/${runId}/attempts/${attempt.id}/${type}`)}),false)}>{type==='input' ? 'Ver entrada' : 'Ver saída'}</button>)}</div></div>)}</Card>
      <Card><h2>Decisões humanas</h2>{!run.reviews.length ? <p className="muted mt-3">Nenhuma revisão registrada.</p> : run.reviews.map(review => <details key={review.id} className="review-history"><summary>{date(review.created_at)} · {review.entity_type} · {review.decision}</summary><p>{review.justification}</p><p className="muted">Responsável: {review.actor}</p><pre className="code-panel">{JSON.stringify({antes:review.before_value,depois:review.after_value},null,2)}</pre></details>)}</Card>
    </>}
    {artifact && <Card><div className="section-heading"><h2>{artifact.title}</h2><button className="text-button" onClick={() => setArtifact(null)}>Fechar</button></div><pre className="code-panel">{JSON.stringify(artifact.data,null,2)}</pre></Card>}
    {['pending','running','awaiting_review','failed'].includes(run.status)&&<details className="run-controls secondary-section"><summary>Retomar ou encerrar análise</summary><div className="research-form">{run.status==='failed'&&!run.workflow_error&&<Button disabled={busy||!run.stages.some(s=>s.status==='failed'&&s.attempt_count<3)} onClick={()=>action(()=>research.post(`/runs/${runId}/retry`,{operation_record:'system/v1'}))}>Repetir etapa com falha</Button>}<label>Motivo do encerramento<select value={cancelReason} onChange={e=>setCancelReason(e.target.value)}><option value="">Selecione um motivo</option><option value="Encerramento solicitado para revisar as entradas e preparar outra análise.">Revisar entradas e iniciar outra análise</option><option value="Processamento interrompido para investigar uma falha técnica.">Investigar uma falha técnica</option><option value="Execução de controle encerrada pelo pesquisador.">Encerrar uma análise de controle</option></select></label><details><summary>Adicionar observação ao encerramento (opcional)</summary><label>Justificativa da ação<textarea rows={2} maxLength={4500} value={justification} onChange={e=>setJustification(e.target.value)}/></label></details><Button variant="secondary" disabled={busy||!cancelReason} onClick={()=>action(()=>research.post(`/runs/${runId}/cancel`,{justification:[cancelReason,justification.trim()].filter(Boolean).join(' ')}))}>Cancelar execução</Button><small>O cancelamento preserva o histórico e impede que uma resposta tardia reabra a análise.</small></div></details>}
  </div>;
}
