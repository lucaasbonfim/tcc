import {useEffect,useRef,useState} from 'react';
import {research} from '../services/research.service';
import {date} from '../utils/research';
import {agentName,EVENT_LABELS} from '../utils/agent-map';
import ResearchSnapshotContent from './ResearchSnapshotContent';
import ResearchPosteriorAssessment from './ResearchPosteriorAssessment';
import ErrorMessage from './ErrorMessage';
export default function ResearchEventDetail({run,event,onClose,onMoment,onSaved}) {
  const [result,setResult]=useState({id:null,detail:null,error:''}),close=useRef(null);
  useEffect(()=>{const controller=new AbortController();research.get(`/runs/${run.id}/events/${event.id}`,{signal:controller.signal}).then(detail=>{if(!controller.signal.aborted)setResult({id:event.id,detail,error:''});}).catch(error=>{if(!controller.signal.aborted)setResult({id:event.id,detail:null,error:error.message});});return()=>controller.abort();},[run.id,event.id]);
  useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
  const detail=result.id===event.id?result.detail:null;
  function keyboard(event){if(event.key==='Escape'){event.preventDefault();onClose();}if(event.key==='Tab'){const items=[...event.currentTarget.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(node=>!node.disabled&&node.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}}
  return <div className="event-inspector-overlay"><button className="event-inspector-backdrop" aria-label="Fechar detalhes do evento" tabIndex={-1} onClick={onClose}/><aside className="timeline-detail event-inspector" role="dialog" aria-modal="true" aria-labelledby="event-inspector-title" onKeyDown={keyboard}><header><div><p>{agentName(event.agent) || (event.actor==='human'?'Pesquisador':'Sistema')} · {date(event.occurred_at)}</p><h2 id="event-inspector-title">{EVENT_LABELS[event.kind] || event.kind}</h2></div><button ref={close} className="inspector-close" onClick={onClose} aria-label="Fechar evento">×</button></header>
    <div className="event-inspector-body"><ErrorMessage>{result.id===event.id?result.error:''}</ErrorMessage>{!detail&&!result.error?<p>Carregando registro…</p>:detail && <><ResearchSnapshotContent data={detail.data}/><details className="event-metadata"><summary>Metadados do registro</summary><dl className="metadata-list"><dt>Evento</dt><dd>{event.id}</dd>{detail.snapshot && <><dt>Snapshot</dt><dd>{detail.snapshot.id}</dd><dt>Conteúdo</dt><dd>{detail.snapshot.label}</dd><dt>SHA-256</dt><dd>{detail.snapshot.artifact.sha256}</dd></>}</dl></details>{detail.snapshot && !['human_review','human_assessment'].includes(event.kind) && <details className="event-assessment"><summary>Avaliar este artefato</summary><ResearchPosteriorAssessment key={detail.snapshot.id} run={run} snapshot={detail.snapshot} onSaved={onSaved}/></details>}</>}
    </div><footer><button className="secondary-link" onClick={()=>{onMoment(event);onClose();}}>Ver mapa neste momento</button><span>{detail?.snapshot?'Versão preservada':'Registro da execução'}</span></footer>
  </aside></div>;
}
