import {agentName, EVENT_LABELS, eventCategory} from '../utils/agent-map';
import {date} from '../utils/research';

export default function ResearchEventList({events,selected,onSelect}) {
  return <ol className="history-event-list" aria-label="Eventos da análise">
    {events.map(event=><li key={event.id}><button className={`timeline-event event-${eventCategory(event)} ${selected===event.id?'selected':''}`} aria-pressed={selected===event.id} onClick={()=>onSelect(event)}>
      <span className="history-event-heading"><strong>{EVENT_LABELS[event.kind] || event.kind}</strong><time dateTime={event.occurred_at}>{date(event.occurred_at)}</time></span>
      <span>{agentName(event.agent) || (event.actor==='human'?'Pesquisador':'Sistema')}{event.recipient?` → ${agentName(event.recipient) || event.recipient}`:''}</span>
      {event.payload?.text && <p>{event.payload.text}</p>}
      <span className="history-event-action">Consultar registro</span>
    </button></li>)}
    {!events.length && <li className="empty-state"><strong>Nenhum evento neste filtro.</strong><p>Escolha outro agente ou exiba todos os eventos.</p></li>}
  </ol>;
}
