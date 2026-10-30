import Button from './Button';
import ResearchStatus from './ResearchStatus';

export default function ResearchTestCoverage({run,busy,onComplete}) {
  const coverage=run.test_coverage;
  if(!coverage?.total)return null;
  const parts=run.test_parts || [],active=parts.filter(part=>part.status!=='cancelled');
  const canComplete=coverage.missing.length>0 && ['awaiting_review','completed','failed'].includes(run.status)
    && run.stages.some(stage=>stage.agent==='requirements' && stage.status==='completed')
    && !run.stages.some(stage=>stage.agent==='automation') && !run.execution_jobs?.length;
  return <div className="notice compact"><strong>{coverage.linked}/{coverage.total} requisitos com casos vinculados</strong>
    <p>{coverage.missing.length ? `${coverage.missing.length} requisito(s) ainda sem cenário. A aprovação da etapa fica bloqueada até completar os vínculos.` : 'Todos os requisitos aprovados possuem ao menos um caso não rejeitado.'} {coverage.approved_linked} com caso já aprovado.</p>
    <p>Os vínculos permitem conferir os requisitos contemplados. A qualidade e a abrangência dos cenários precisam de revisão.</p>
    {active.length>0 && <p>{active.filter(part=>part.status==='completed').length}/{active.length} lotes de casos concluídos. Lotes concluídos são preservados após falhas.</p>}
    {canComplete && <Button disabled={busy} onClick={onComplete}>Gerar casos para os requisitos sem cenário</Button>}
    <details><summary>Conferir requisitos e casos vinculados</summary><div className="table-wrap"><table><thead><tr><th>Requisito</th><th>Casos</th></tr></thead><tbody>{coverage.rows.map(row=><tr key={row.code}><td>{row.code} · {row.title}</td><td>{row.case_codes.length ? row.case_codes.join(', ') : 'Sem caso vinculado'}</td></tr>)}</tbody></table></div></details>
    {parts.length>0 && <details><summary>Lotes e erros de geração</summary>{parts.map(part=><p key={part.id}>Lote {part.sequence} · {part.requirement_codes.join(', ')} · <ResearchStatus status={part.status}/>{part.error && ` · ${part.error}`}</p>)}</details>}
  </div>;
}
