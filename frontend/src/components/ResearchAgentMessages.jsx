import {useState} from 'react';
import {Link} from 'react-router-dom';
import {research} from '../services/research.service';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
function Message({run,message,onChange}) {
  const [justification,setJustification]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const statuses={pending:'Aguardando revisão',acknowledged:'Esclarecimento reconhecido',rejected:'Resposta rejeitada',revision_requested:'Nova análise necessária'};
  async function review(decision){setBusy(true);setError('');try{await research.post(`/runs/${run.id}/agent-messages/${message.id}/review`,{decision,justification});onChange();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
  return <article className="review-history"><h3>A2 → A1 · {message.request_data.requirement.content.code}</h3>
    <p>{message.request_data.question}</p><p className="muted">Revisão {message.requirement_revision} do requisito · {statuses[message.review_status]}</p>
    {message.response_data?<><p><strong>Resposta proposta:</strong> {message.response_data.answer}</p><details><summary>Fontes da resposta</summary>{message.response_data.sources.map(source=><blockquote key={source.source_id}>{source.document_id} · página {source.page}: {source.quote}</blockquote>)}</details></>:<p>Consulta sem resposta concluída. Consulte a sessão filha e o estado da análise.</p>}
    <ErrorMessage>{error}</ErrorMessage>
    {run.status==='awaiting_review' && message.status==='answered' && message.review_status==='pending' && <><label>Justificativa da revisão do esclarecimento<textarea value={justification} maxLength={5000} rows={2} onChange={event=>setJustification(event.target.value)}/></label><div className="inline-actions">
      <Button disabled={busy || !justification.trim() || message.response_data.status==='unavailable'} onClick={()=>review('acknowledged')}>Reconhecer esclarecimento</Button>
      <Button variant="secondary" disabled={busy || !justification.trim()} onClick={()=>review('rejected')}>Rejeitar resposta</Button>
      <Button variant="secondary" disabled={busy || !justification.trim()} onClick={()=>review('revision_requested')}>Solicitar revisão da regra</Button>
    </div></>}
    {message.review_justification && <p>Justificativa humana: {message.review_justification}</p>}
    {message.review_status==='revision_requested' && <p className="notice">Aprovação dos casos bloqueada. Preserve e encerre esta análise; corrija a especificação e <Link to={`/admin/projects/${run.project_id}`}>inicie outra no projeto</Link>. As aprovações anteriores não serão reaproveitadas.</p>}
  </article>;
}
export default function ResearchAgentMessages({run,onChange}) {
  if(!run.agent_messages?.length)return null;
  return <Card><h2>Mensagens entre agentes</h2><p>Esclarecimentos são propostas. Revise cada resposta antes de aprovar os casos; reconhecer uma resposta não aprova o requisito nem os casos.</p>{run.agent_messages.map(message=><Message key={message.id} run={run} message={message} onChange={onChange}/>)}</Card>;
}
