import {useState} from 'react';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import {research} from '../services/research.service';
const kinds={compatible:'Compatível no cenário',assertion_failure:'Falha de asserção',test_issue:'Possível problema no teste',environment_issue:'Problema de ambiente',inconclusive:'Inconclusivo'};
const actions={no_change:'Sem alteração proposta',review_script:'Revisar script',check_environment:'Conferir ambiente',inconclusive:'Evidência insuficiente'};
export default function ResearchExecutionDiagnostics({run,onChange}) {
  const [reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),proposal=run.execution_proposals?.find(p=>p.phase==='diagnosis');
  if(!proposal)return null;
  async function review(decision){setBusy(true);setError('');try{await research.post(`/runs/${run.id}/execution/diagnostics/${proposal.id}/review`,{decision,justification:reason});onChange();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
  return <Card><h2>Diagnóstico técnico do A3</h2><p>{proposal.output_data.summary}</p><p className="muted">Proposta para revisão, separada da classificação do A4. Aceitar não altera scripts nem autoriza nova execução.</p>
    {proposal.output_data.diagnostics.map(row=><details key={row.result_id}><summary>{run.test_cases.find(c=>c.id===run.test_results.find(r=>r.id===row.result_id)?.test_case_id)?.code || row.result_id} · {kinds[row.kind]} · {actions[row.action]}</summary><p>{row.rationale}</p><p>Versão do script: {row.script_version}</p><p>Esperado: {row.expected_behavior}</p><pre className="code-panel">{row.observed_behavior}</pre><blockquote>{row.evidence_quote}</blockquote>{row.limitations.map((text,i)=><p className="muted" key={i}>{text}</p>)}</details>)}
    <ErrorMessage>{error}</ErrorMessage>
    {proposal.review_status==='pending' && run.status==='awaiting_review'?<><label>Justificativa da revisão do diagnóstico A3<textarea value={reason} maxLength={5000} rows={2} onChange={event=>setReason(event.target.value)}/></label><div className="inline-actions"><Button disabled={busy || !reason.trim()} onClick={()=>review('accepted')}>Confirmar diagnóstico técnico</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={()=>review('rejected')}>Rejeitar diagnóstico técnico</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={()=>review('revision_requested')}>Solicitar revisão em nova análise</Button></div></>:<p className="muted">{proposal.review_status==='pending'?'Aguardando conclusão das consultas para revisão.':`Revisão registrada: ${proposal.review_status}.`}</p>}
    {proposal.review_status==='revision_requested' && <p className="notice">Preserve os resultados desta análise. Uma correção exige nova análise, revisão dos scripts e outra autorização; a evidência anterior permanece inalterada.</p>}
  </Card>;
}
