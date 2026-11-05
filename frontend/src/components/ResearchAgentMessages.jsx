import {useState} from 'react';
import {Link} from 'react-router-dom';
import {research} from '../services/research.service';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
function Message({run,message,onChange}) {
  const [justification,setJustification]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const scriptReview=message.kind==='script_review';
  const statuses={pending:'Aguardando revisão',acknowledged:'Esclarecimento reconhecido',rejected:'Resposta rejeitada',revision_requested:'Nova análise necessária'};
  async function review(decision){setBusy(true);setError('');try{await research.post(`/runs/${run.id}/agent-messages/${message.id}/review`,{decision,justification});onChange();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
  return <article className="review-history"><h3>{scriptReview?'A3 → A2':'A2 → A1'} · {scriptReview?message.request_data.script.case_code:message.request_data.requirement.content.code}</h3>
    <p>{message.request_data.question}</p><p className="muted">{scriptReview?`Versão ${message.script_version}, revisão ${message.script_revision} do script`:`Revisão ${message.requirement_revision} do requisito`} · {scriptReview && message.review_status==='acknowledged'?'Proposta reconhecida sem aplicar':statuses[message.review_status]}</p>
    {message.response_data?<><p><strong>Resposta proposta:</strong> {message.response_data.answer}</p><details><summary>Fontes da resposta</summary>{message.response_data.sources.map(source=><blockquote key={source.source_id}>{source.document_id} · página {source.page}: {source.quote}</blockquote>)}</details></>:<p>Consulta sem resposta concluída. Consulte a sessão filha e o estado da análise.</p>}
    <ErrorMessage>{error}</ErrorMessage>
    {scriptReview && message.response_data?.status==='proposed_revision' && <details><summary>Rascunho da versão {message.response_data.proposed_version} · não aplicado</summary><p className="notice">O script aprovado e sua autorização permanecem vinculados à versão executada. Confira manualmente asserções e esperado; a validação estática não prova correção semântica. Use outra análise, revisão e autorização para uma correção.</p><p>Esperado preservado: {message.response_data.expected_result}</p>{message.response_data.files.map(file=><div key={file.path}><strong className="artifact-path">{file.path}</strong><pre className="code-panel">{file.code}</pre></div>)}</details>}
    {(run.workflow_mode==='autonomous/v1'?['completed','failed','cancelled'].includes(run.status):run.status==='awaiting_review') && message.status==='answered' && message.review_status==='pending' && <><label>{scriptReview?'Justificativa da revisão da proposta de script':'Justificativa da revisão do esclarecimento'}<textarea value={justification} maxLength={5000} rows={2} onChange={event=>setJustification(event.target.value)}/></label><div className="inline-actions">
      <Button disabled={busy || !justification.trim() || message.response_data.status==='unavailable'} onClick={()=>review('acknowledged')}>{scriptReview?'Reconhecer proposta sem aplicar':'Reconhecer esclarecimento'}</Button>
      <Button variant="secondary" disabled={busy || !justification.trim()} onClick={()=>review('rejected')}>Rejeitar resposta</Button>
      <Button variant="secondary" disabled={busy || !justification.trim()} onClick={()=>review('revision_requested')}>{scriptReview?'Solicitar revisão do script em nova análise':'Solicitar revisão da regra'}</Button>
    </div></>}
    {message.review_justification && <p>Justificativa humana: {message.review_justification}</p>}
    {message.review_status==='revision_requested' && <p className="notice">{scriptReview?'Correção de script pendente de nova análise, revisão e autorização.':'Aprovação dos casos bloqueada; a regra precisa de revisão.'} Preserve e encerre esta análise antes de <Link to={`/admin/projects/${run.project_id}`}>iniciar outra no projeto</Link>. As aprovações anteriores não serão reaproveitadas.</p>}
  </article>;
}
export default function ResearchAgentMessages({run,onChange}) {
  if(!run.agent_messages?.length)return null;
  return <Card><h2>Mensagens entre agentes</h2><p>{run.workflow_mode==='autonomous/v1'?'As consultas ocorreram sem aprovação humana intermediária. Revise as respostas após o término; reconhecer uma proposta não a aplica nem autoriza outra execução.':'Respostas são propostas para revisão. Reconhecer não altera artefatos aprovados nem autoriza execução. Consultas A2/A1 são revisadas antes dos casos; consultas A3/A2, antes da conclusão da avaliação.'}</p>{run.agent_messages.map(message=><Message key={message.id} run={run} message={message} onChange={onChange}/>)}</Card>;
}
