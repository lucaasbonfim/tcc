import {useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import {RESULT_LABELS,date} from '../utils/research';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';

export default function ResearchExecutionPanel({run,busy,action}) {
  const capabilities=useResearch('/capabilities'),[reason,setReason]=useState('');
  const ready=capabilities.data?.execution.ready,receipt=capabilities.data?.execution;
  const jobs=run.execution_jobs || [],stage=run.stages.find(s=>s.agent==='execution');
  const scripts=run.automated_tests || [],adapter=scripts.find(s=>s.review_status==='approved')?.adapter;
  return <Card><div className="section-heading"><div><h2>{!ready && !jobs.length ? 'Execução de testes não suportada' : 'Execução de testes · agente 3'}</h2><p>{stage?.message}</p></div><Button variant="secondary" onClick={capabilities.reload}>Verificar executor</Button></div><ErrorMessage>{capabilities.error}</ErrorMessage>
    {!ready && <p className="notice">{receipt?.reason || 'Verificando disponibilidade. Sem recibo válido de isolamento, nenhum trabalho é autorizado.'}</p>}
    {!jobs.length && <div className="research-form"><p className="muted">Serão enviados somente scripts aprovados e fontes imutáveis do escopo selecionado. A suíte antiga do repositório não será descoberta/executada automaticamente.</p>
      {ready && <p className="notice">Executor validado: {receipt.deployment_id}. Política <code>{receipt.policy_sha256}</code>. Adaptadores: {Object.keys(receipt.images).join(', ')}.</p>}
      <label>Justificativa da autorização de execução<textarea rows={3} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label><Button disabled={busy || !ready || !adapter || !receipt?.images?.[adapter] || run.status!=='completed' || run.stages.find(s=>s.agent==='automation')?.status!=='completed' || !reason.trim()} onClick={()=>action(()=>research.post(`/runs/${run.id}/execution`,{justification:reason}))}>Autorizar execução isolada</Button>
      <small className="muted">A geração, revisão e autorização são ações separadas. Falhas de infraestrutura não são classificadas automaticamente como defeitos funcionais.</small></div>}
    {jobs.map(job=><div className="review-item" key={job.id}><h3>Trabalho {job.id}</h3><p className="muted">{RESULT_LABELS[job.status] || job.status} · {job.adapter} · {date(job.created_at)}</p>{job.error && <ErrorMessage>{job.error}</ErrorMessage>}
      {job.result_data && <><dl className="metadata-list"><dt>Estado</dt><dd>{RESULT_LABELS[job.result_data.status] || job.result_data.status}</dd><dt>Duração / saída</dt><dd>{job.result_data.duration_ms} ms / {job.result_data.exit_code ?? 'Não disponível'}</dd><dt>Ambiente</dt><dd><code>{job.result_data.environment.image_id}</code></dd></dl>
        <div className="table-scroll"><table><thead><tr><th>Teste gerado</th><th>Resultado</th><th>Observação</th></tr></thead><tbody>{run.test_results.map(result=><tr key={result.id}><td>{result.content.test_name}<small>{run.test_cases.find(t=>t.id===result.test_case_id)?.code} · {result.automated_test_id}</small></td><td>{RESULT_LABELS[result.status] || result.status}</td><td className="result-observation">{result.content.observed}</td></tr>)}</tbody></table></div>
        {[['Comandos executados',job.result_data.commands],['Ambiente e limites',job.result_data.environment],['Saída padrão',job.result_data.stdout],['Saída de erro',job.result_data.stderr],['Relatórios do framework',job.result_data.framework_reports],['Limitações',job.result_data.limitations]].map(([label,value])=><details key={label}><summary>{label}</summary><pre className="code-panel">{typeof value==='string' ? value || '(vazio)' : JSON.stringify(value,null,2)}</pre></details>)}</>}
    </div>)}
  </Card>;
}
