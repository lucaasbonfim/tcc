import {useState} from 'react';
import {research} from '../services/research.service';
import {CLASSIFICATION_LABELS} from '../utils/research';
import Card from './Card';
import Button from './Button';
import ResearchStatus from './ResearchStatus';

function Finding({finding,run,editable,busy,action}) {
  const [reason,setReason]=useState(''),[classification,setClassification]=useState('');
  const req=run.requirements.find(r=>r.id===finding.requirement_id),test=run.test_cases.find(t=>t.id===finding.test_case_id),result=run.test_results.find(r=>r.id===finding.test_result_id),script=run.automated_tests.find(t=>t.id===finding.automated_test_id);
  const original=finding.content;
  function review(decision){return action(()=>research.post(`/runs/${run.id}/findings/${finding.id}/review`,{decision,revision:finding.revision,justification:reason,...(classification ? {classification} : {})}));}
  return <article className="review-item"><div className="section-heading"><div><span className="item-code">{req?.code} → {test?.code} → {result?.id}</span><h3>{CLASSIFICATION_LABELS[original.classification]}</h3></div><ResearchStatus status={finding.review_status}/></div><p>{original.justification}</p>
    <dl className="item-details"><div><dt>Esperado aprovado</dt><dd>{original.expected_behavior}</dd></div><div><dt>Observado na evidência</dt><dd>{original.observed_behavior}</dd></div></dl><blockquote>“{original.evidence_quote}”</blockquote>
    <details><summary>Requisito, caso, script e evidência</summary><p className="preserve-text">{req?.content.description}</p>{req?.content.sources.map((source,index)=><blockquote key={index}>{source.document_id} · página {source.page}: “{source.quote}”</blockquote>)}<pre className="code-panel">{JSON.stringify({caso:test?.content,script:script?.files_data,resultado:result?.content,evidence_id:result?.evidence_id,limitações:original.limitations},null,2)}</pre></details>
    {finding.human_classification && <p className="notice compact">Classificação humana: {CLASSIFICATION_LABELS[finding.human_classification]}. A proposta original do agente permanece preservada.</p>}
    {editable && <div className="research-form review-controls"><label>Classificação humana (opcional)<select value={classification} onChange={event=>setClassification(event.target.value)}><option value="">Manter proposta ao confirmar; sem alternativa ao rejeitar</option>{Object.entries(CLASSIFICATION_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Justificativa da decisão humana<textarea rows={3} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label><div className="inline-actions"><Button disabled={busy || !reason.trim()} onClick={()=>review('confirmed')}>Confirmar classificação</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={()=>review('rejected')}>Rejeitar classificação</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={()=>review('inconclusive')}>Marcar inconclusiva</Button></div></div>}
  </article>;
}
export default function ResearchEvaluationPanel({run,busy,action}) {
  const [reason,setReason]=useState('');
  const stage=run.stages.find(s=>s.agent==='evaluation'),findings=run.findings || [];
  const editable=run.status==='awaiting_review' && stage?.status==='awaiting_review';
  return <Card><div className="section-heading"><div><h2>Avaliação de evidências · agente 4</h2><p>{stage?.message}</p></div><ResearchStatus status={stage?.status}/></div>
    {!findings.length && <p className="notice">{run.evidence?.length ? 'Evidências recebidas. Aguarde a análise ou consulte a falha no histórico.' : 'Sem evidências independentes de execução, nenhuma divergência é proposta. Gere/revise scripts e utilize um executor validado.'}</p>}
    <p className="muted">Um teste reprovado não prova um defeito. Um teste aprovado sustenta apenas o cenário observado, sem comprovar todos os requisitos.</p>
    {findings.map(finding=><Finding key={`${finding.id}-${finding.revision}`} finding={finding} run={run} editable={editable} busy={busy} action={action}/>)}
    {editable && <div className="research-form stage-approval"><label>Justificativa da conclusão da avaliação<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label><Button disabled={busy || !reason.trim() || !findings.length || findings.some(f=>f.review_status==='pending')} onClick={()=>action(()=>research.post(`/runs/${run.id}/evaluation/approve`,{justification:reason}))}>Concluir revisão da avaliação</Button></div>}
  </Card>;
}
