import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import ResearchEventList from './ResearchEventList';
import {useResearchTimeline} from '../hooks/useResearchTimeline';
import {research} from '../services/research.service';
import {date} from '../utils/research';
import {projectAgentMap,AGENT_ROLES,AGENT_NAMES,normalizeAgent,eventCategory,agentName} from '../utils/agent-map';
import {describeAgentFailure} from '../utils/agent-failure';
import ResearchAgentMap from './ResearchAgentMap';
import ResearchSequence from './ResearchSequence';
import ResearchEventDetail from './ResearchEventDetail';
import ResearchPosteriorAssessment from './ResearchPosteriorAssessment';
import ErrorMessage from './ErrorMessage';
export default function ResearchTimeline({run,onChange}) {
  const [revision,setRevision]=useState(0),[selected,setSelected]=useState(null),[moment,setMoment]=useState(null),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
  const [params,setParams]=useSearchParams();
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 650px)').matches);
  useEffect(()=>{const media=window.matchMedia('(max-width: 650px)'),update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const filter=params.get('events') || 'essential',agent=params.get('agent') || '',layout=params.get('layout') || (compact?'list':'diagram');
  function updateParam(key,value) {setParams(previous=>{const next=new URLSearchParams(previous);next.set(key,value);if(key!=='eventPage')next.delete('eventPage');return next;},{replace:true});}
  const setFilter=value=>updateParam('events',value),setAgent=value=>updateParam('agent',value);
  const timeline=useResearchTimeline(run.id,revision,onChange),events=timeline.events,summary=timeline.summary;
  const momentIndex=moment?events.findIndex(event=>event.id===moment):events.length-1,historical=moment!==null;
  const projection=useMemo(()=>projectAgentMap({...run,status:timeline.status || run.status},historical?events.slice(0,momentIndex+1):events,{historical}),[run,timeline.status,events,historical,momentIndex]);
  const visible=events.filter(event=>(!agent || normalizeAgent(event.agent)===agent || normalizeAgent(event.recipient)===agent) && (filter==='all'||filter==='essential'&&(eventCategory(event)!=='technical'||['model_turn_failed','model_retry_scheduled'].includes(event.kind))||eventCategory(event)===filter));
  const pageCount=Math.max(1,Math.ceil(visible.length/50)),requestedPage=Number(params.get('eventPage'));
  const page=params.has('eventPage')&&Number.isInteger(requestedPage)?Math.max(0,Math.min(pageCount-1,requestedPage)):pageCount-1;
  const pageEvents=visible.slice(page*50,(page+1)*50);
  const failure=(timeline.status || run.status)==='failed'?describeAgentFailure(timeline.failure):null;
  function refresh(){setRevision(n=>n+1);onChange();}
  async function retry(){setBusy(true);setActionError('');try{await research.post(`/runs/${run.id}/retry`,{operation_record:'system/v1'});setMoment(null);refresh();}catch(error){setActionError(error.message);}finally{setBusy(false);}}
  function selectAgent(role){setAgent(role);const event=[...events].reverse().find(e=>normalizeAgent(e.agent)===role && ['artifact_produced','attempt_failed','tool_requested','model_turn_requested','message_request','message_response'].includes(e.kind));if(event)setSelected(event);}
  return <div className="agent-workbench"><section className="agent-map-panel"><header className="workbench-heading"><div><h2>Trajetória dos agentes</h2><p>{historical?'Revisão de um momento registrado':'Mapa da execução'}</p></div><div className="workbench-actions"><span className={`connection-label ${timeline.connection==='Ao vivo' && !historical?'connected':''}`} role="status">{historical?'Histórico':timeline.connection}</span><button className="text-button" onClick={refresh} aria-label="Atualizar histórico">↻ Atualizar</button></div></header>
    <ErrorMessage>{timeline.error || actionError}</ErrorMessage>
    {failure && <div className="execution-failure" role="alert"><span className="failure-symbol" aria-hidden="true">!</span><div><h3>{failure.title}</h3><p>{agentName(timeline.failure?.agent) || 'Etapa interrompida'} · {failure.description}</p><details><summary>Como continuar</summary><p>{failure.next}</p></details></div><div className="failure-actions"><button className="text-button" onClick={()=>setSelected([...events].reverse().find(e=>e.kind==='attempt_failed'||e.kind==='workflow_failed') || events.at(-1))}>Ver falha</button>{!run.workflow_error && run.stages.some(s=>s.status==='failed'&&s.attempt_count<3) && <button className="secondary-link" disabled={busy} onClick={retry}>Retomar etapa</button>}</div></div>}
    <ResearchAgentMap projection={projection} live={!historical} onAgent={selectAgent}/>
    <div className="map-time-controls"><button aria-label="Momento anterior" disabled={momentIndex<=0} onClick={()=>setMoment(events[Math.max(0,momentIndex-1)]?.id)}>‹</button><input aria-label="Momento da execução" aria-valuetext={events[momentIndex]?date(events[momentIndex].occurred_at):'Nenhum evento'} type="range" min="0" max={Math.max(0,events.length-1)} value={Math.max(0,momentIndex)} disabled={!events.length} onChange={event=>setMoment(Number(event.target.value)===events.length-1?null:events[Number(event.target.value)]?.id)}/><button aria-label="Próximo momento" disabled={!historical || momentIndex>=events.length-1} onClick={()=>setMoment(momentIndex+1>=events.length-1?null:events[momentIndex+1]?.id)}>›</button><span>{historical?`${momentIndex+1}/${events.length} · ${date(events[momentIndex]?.occurred_at)}`:projection.terminal?'Último registro':'Agora'}</span>{historical && <button className="text-button" onClick={()=>setMoment(null)}>Voltar ao atual</button>}</div>
    {timeline.history_mode==='legacy' && <p className="legacy-caption">Histórico legado: somente registros e arquivos disponíveis. Transições ausentes não são reconstruídas.</p>}
    <div className="map-summary">{summary && <><span><strong>{summary.requests}</strong> consultas</span><span><strong>{summary.completed_cycles}</strong> ciclos completos</span><span><strong>{summary.technical_retries}</strong> retentativas técnicas</span><span><strong>{summary.model_retries ?? 0}</strong> retentativas do modelo</span><details><summary>Contagens por agente</summary>{summary.by_pair.map(pair=><p key={`${pair.sender}:${pair.recipient}`}>{agentName(pair.sender)} → {agentName(pair.recipient)}: {pair.requests} consultas / {pair.cycles} ciclos completos</p>)}<p>{summary.pending_requests} sem resposta · {summary.unavailable_responses} indisponíveis · {summary.unknown_responses} sem conteúdo verificável</p></details></>}</div>
  </section><section className="sequence-panel"><header className="workbench-heading"><div><h2>Sequência da execução</h2><p>Selecione uma mensagem ou artefato para abrir seu conteúdo.</p></div><div className="sequence-filters"><label><span className="sr-only">Exibir eventos</span><select aria-label="Exibir eventos" value={filter} onChange={event=>setFilter(event.target.value)}>{[['essential','Essenciais'],['messages','Conversas entre agentes'],['artifacts','Entradas e artefatos'],['technical','Ferramentas e modelo'],['human','Avaliação humana'],['all','Todos os eventos']].map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label><label><span className="sr-only">Agente</span><select aria-label="Agente" value={agent} onChange={event=>setAgent(event.target.value)}><option value="">Todos os agentes</option>{AGENT_ROLES.map(role=><option key={role} value={role}>{AGENT_NAMES[role]}</option>)}</select></label></div></header>
    <div className="history-view-controls"><div role="group" aria-label="Apresentação do histórico"><button className="secondary-link" aria-pressed={layout==='list'} onClick={()=>updateParam('layout','list')}>Lista</button><button className="secondary-link" aria-pressed={layout!=='list'} onClick={()=>updateParam('layout','diagram')}>Diagrama</button></div><span>{visible.length} de {events.length} eventos</span></div>
    {layout==='list'?<ResearchEventList events={pageEvents} selected={selected?.id} onSelect={setSelected}/>:<ResearchSequence events={pageEvents} selected={selected?.id} onSelect={setSelected}/>}
    {pageCount>1 && <nav className="history-pagination" aria-label="Páginas do histórico"><button className="secondary-link" disabled={page===0} onClick={()=>updateParam('eventPage',String(page-1))}>Eventos anteriores</button><span role="status">Página {page+1} de {pageCount}</span><button className="secondary-link" disabled={page===pageCount-1} onClick={()=>updateParam('eventPage',String(page+1))}>Próximos eventos</button></nav>}
  </section><details className="run-assessment"><summary>Avaliação posterior da execução</summary><ResearchPosteriorAssessment run={run} onSaved={refresh}/></details>
    {selected && <ResearchEventDetail run={run} event={selected} onClose={()=>setSelected(null)} onMoment={event=>setMoment(event.id)} onSaved={refresh}/>}
  </div>;
}
