import {useEffect,useRef,useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import {date,shortId,AGENT_LABELS} from '../utils/research';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import ResearchStatus from './ResearchStatus';

const tools={list_sources:'Consultar fontes',read_source:'Ler fonte',find_symbols:'Buscar símbolos',get_approved_case:'Consultar caso aprovado',get_approved_requirement:'Consultar requisito',get_adapter_capabilities:'Consultar capacidades',prepare_automation_scope:'Preparar fontes do teste',submit_automation:'Submeter scripts para revisão',list_document_sources:'Listar trechos dos documentos',read_document_sources:'Consultar trechos dos documentos',submit_requirements:'Submeter requisitos para revisão',list_test_requirements:'Listar requisitos para os casos',read_test_requirement:'Consultar requisito para os casos',submit_test_cases:'Submeter casos para revisão'};
Object.assign(tools,{list_evaluation_results:'Listar resultados para avaliação',read_evaluation_context:'Investigar contexto da evidência',submit_evaluation:'Submeter conclusões para revisão'});
const agentNumbers={requirements:1,tests:2,automation:2,execution:3,evaluation:4};
const reasons={submitted:'Artefatos submetidos para revisão',budget_exhausted:'Orçamento da tarefa esgotado',interrupted:'Processamento interrompido',processing_error:'Falha durante o processamento',scope_violation:'Consulta fora do escopo recusada',cancelled_by_researcher:'Cancelada pelo pesquisador',worker_interrupted:'Worker interrompido',lease_lost:'Posse da tarefa perdida'};
function usePolling(active,reload){const previous=useRef(active);useEffect(()=>{if(previous.current && !active)reload();previous.current=active;if(!active)return;const timer=setInterval(reload,4000);return()=>clearInterval(timer);},[active,reload]);}

function Session({runId,id,active}) {
  const [offset,setOffset]=useState(0),[artifact,setArtifact]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const {data,error:loadError,reload}=useResearch(`/runs/${runId}/agent-sessions/${id}?offset=${offset}&limit=10`);
  usePolling(active,reload);
  async function inspect(call,type) {
    setBusy(true);setError('');
    try{setArtifact({title:type==='observation'?'Observação da ferramenta':'Argumentos da consulta',data:await research.get(`/runs/${runId}/agent-sessions/${id}/artifacts/call/${call.id}/${type}`)});}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  return <div className="mt-4"><ErrorMessage>{loadError || error}</ErrorMessage>
    {!data && !loadError && <p role="status">Carregando trajetória...</p>}
    {data && <><p className="notice compact">{reasons[data.session.stop_reason] || (active?'O agente está trabalhando dentro dos limites registrados.':'Trajetória preservada.')}</p>
      <details><summary>Objetivo e limites da sessão</summary><pre className="code-panel">{JSON.stringify({tarefa:data.session.task,politica:data.session.policy},null,2)}</pre></details>
      {data.steps.map(step=><div key={step.id} className="review-history"><h3>Turno {step.sequence} · <ResearchStatus status={step.status}/></h3>
        {step.provider_metadata?.reused_from_step_id && <p className="muted">Resposta reaproveitada de uma tentativa anterior.</p>}
        {data.calls.filter(call=>call.step_id===step.id).map(call=><div className="attempt-row" key={call.id}><div><strong>{tools[call.name] || call.name}</strong><p><ResearchStatus status={call.status}/> · {call.duration_ms==null?'Tempo não informado':`${call.duration_ms} ms`}</p></div><div className="inline-actions"><button className="text-button" disabled={busy} onClick={()=>inspect(call,'arguments')}>Ver argumentos</button>{call.observation && <button className="text-button" disabled={busy} onClick={()=>inspect(call,'observation')}>Ver observação</button>}</div></div>)}
      </div>)}
      <div className="inline-actions"><Button variant="secondary" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-10))}>Turnos anteriores</Button><Button variant="secondary" disabled={data.next_offset===null} onClick={()=>setOffset(data.next_offset)}>Próximos turnos</Button></div>
    </>}
    {artifact && <div className="mt-4"><div className="section-heading"><h3>{artifact.title}</h3><button className="text-button" onClick={()=>setArtifact(null)}>Fechar observação</button></div><pre className="code-panel">{JSON.stringify(artifact.data,null,2)}</pre></div>}
  </div>;
}

export default function ResearchAgentHistory({run}) {
  const [offset,setOffset]=useState(0),[selected,setSelected]=useState(null);
  const {data,error,reload}=useResearch(`/runs/${run.id}/agent-sessions?offset=${offset}&limit=10`);
  usePolling(['pending','running'].includes(run.status),reload);
  const roles=Object.entries(run.snapshot_data.agent_policy?.modes || {}).filter(([,mode])=>mode==='agent/v1').map(([role])=>AGENT_LABELS[role]);
  return <Card><div className="section-heading"><div><h2>Trajetória do agente</h2><p>{roles.length?`Etapas com ferramentas: ${roles.join(', ')}.`:'Esta análise utiliza o fluxo com etapas predefinidas.'}</p></div><Button variant="secondary" onClick={reload}>Atualizar trajetória</Button></div>
    <ErrorMessage>{error}</ErrorMessage>
    {data && <><p>{data.summary.model_turns} chamadas ao modelo · {data.summary.tool_calls} chamadas de ferramentas · {data.summary.total_tokens_reported} tokens reportados{data.summary.usage_unknown?' (contagem parcial)':''} · {(data.summary.elapsed_ms/1000).toFixed(1)} s registrados</p>
      {!data.sessions.length && <p className="muted mt-3">Nenhuma sessão com ferramentas registrada nesta análise.</p>}
      {data.sessions.map(session=><div className="review-history" key={session.id}><div className="section-heading"><div><h3>Sessão {shortId(session.id)} · A{agentNumbers[session.agent] || '?'} · {AGENT_LABELS[session.agent]}</h3><p>{date(session.started_at)} · <ResearchStatus status={session.status}/></p></div><Button variant="secondary" onClick={()=>setSelected(selected===session.id?null:session.id)}>{selected===session.id?'Fechar sessão':'Consultar sessão'}</Button></div>{selected===session.id && <Session key={session.id} runId={run.id} id={session.id} active={session.status==='running'}/>}</div>)}
      <div className="inline-actions"><Button variant="secondary" disabled={offset===0} onClick={()=>{setSelected(null);setOffset(Math.max(0,offset-10));}}>Sessões anteriores</Button><Button variant="secondary" disabled={data.next_offset===null} onClick={()=>{setSelected(null);setOffset(data.next_offset);}}>Próximas sessões</Button></div>
    </>}
  </Card>;
}
