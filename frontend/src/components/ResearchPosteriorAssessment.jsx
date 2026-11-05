import {useState} from 'react';
import {research} from '../services/research.service';
import {useResearch} from '../hooks/useResearch';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import {date,shortId} from '../utils/research';
const verdicts={correct:'Correto',partial:'Parcial',incorrect:'Incorreto',inconclusive:'Inconclusivo'};
export default function ResearchPosteriorAssessment({run,snapshot,onSaved}) {
  const judgments=useResearch(`/runs/${run.id}/assessments`),[verdict,setVerdict]=useState('inconclusive'),[reason,setReason]=useState(''),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const terminal=['completed','failed','cancelled'].includes(run.status),target=snapshot?.id || null;
  async function save(){setBusy(true);setError('');try{await research.post(`/runs/${run.id}/assessments`,{snapshot_id:target,verdict,justification:reason,reference_note:reference});setReason('');judgments.reload();onSaved();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
  return <section className="posterior-assessment"><h3>Avaliação humana posterior</h3><p className="muted">{snapshot?`Objeto: snapshot ${shortId(snapshot.id)} · ${snapshot.label}.`:'Objeto: execução como um todo.'} O julgamento é salvo separadamente e conserva as saídas originais. A conta do pesquisador não identifica automaticamente um avaliador independente.</p><ErrorMessage>{error || judgments.error}</ErrorMessage>
    {terminal?<div className="research-form"><label>Julgamento<select aria-label="Julgamento" value={verdict} onChange={event=>setVerdict(event.target.value)}>{Object.entries(verdicts).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Justificativa do julgamento<textarea value={reason} maxLength={5000} rows={3} onChange={event=>setReason(event.target.value)}/></label><label>Referência consultada (opcional)<textarea value={reference} maxLength={5000} rows={2} onChange={event=>setReference(event.target.value)}/></label><Button disabled={busy || !reason.trim()} onClick={save}>Registrar julgamento posterior</Button></div>:<p>Disponível depois do término, falha ou cancelamento.</p>}
    {(judgments.data || []).filter(item=>item.snapshot_id===target).map(item=><blockquote key={item.id}><strong>{verdicts[item.verdict]} · {date(item.created_at)}</strong><p>{item.justification}</p>{item.reference_note && <p>Referência informada: {item.reference_note}</p>}<small>Responsável: {item.actor}</small></blockquote>)}
  </section>;
}
