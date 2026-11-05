import {useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import {RESULT_LABELS,date,shortId} from '../utils/research';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import ResearchAuthorizationReason from './ResearchAuthorizationReason';

export default function ResearchExecutionPanel({run,busy,action}) {
  const autonomous=run.workflow_mode==='autonomous/v1',capabilities=useResearch('/capabilities'),[reason,setReason]=useState(''),[authorized,setAuthorized]=useState(false);
  const receipt=capabilities.data?.execution,ready=receipt?.ready,jobs=run.execution_jobs || [],stage=run.stages.find(s=>s.agent==='execution'),scripts=run.automated_tests || [],approved=scripts.filter(s=>s.review_status==='approved'),adapter=approved[0]?.adapter;
  const native=run.snapshot_data.agent_policy?.modes.execution==='agent/v1',proposal=run.execution_proposals?.find(p=>p.phase==='planning'),canAuthorize=native?run.status==='awaiting_review'&&stage?.status==='awaiting_review'&&proposal?.review_status==='pending':run.status==='completed';
  const scriptStageReady=run.stages.find(s=>s.agent==='automation')?.status==='completed',environmentReady=ready&&Boolean(receipt.images?.[adapter]);
  return <Card><div className="section-heading"><div><h2>{receipt&&!ready&&!jobs.length?'Execução de testes não suportada':'Execução de testes · agente 3'}</h2><p>{jobs.length?'Resultados e evidências da execução autorizada.':'Confira o plano e o ambiente antes de executar código.'}</p></div><Button variant="secondary" onClick={()=>{setAuthorized(false);capabilities.reload();}}>Verificar executor</Button></div><ErrorMessage>{capabilities.error}</ErrorMessage>
    {!ready&&<p className="notice">{receipt?.reason||'Verificando disponibilidade do executor…'}</p>}
    {ready&&<p className="environment-status"><span className="live-dot"/> Executor disponível · {receipt.development_only?'Docker Desktop local':'ambiente dedicado'}</p>}
    {ready&&!environmentReady&&approved.length>0&&<p className="notice">Este ambiente não disponibiliza o adaptador exigido pelos scripts ({adapter}).</p>}
    {!jobs.length&&!autonomous&&<div className="research-form">
      <div className="execution-readiness"><p>{scripts.length} scripts gerados</p><p>{approved.length} revisados e aprovados por pessoa</p><p>{proposal?'Plano do A3 disponível':'Nenhuma execução autorizada'}</p></div>
      {native&&!proposal&&<><p>O A3 precisa propor o plano de execução antes da sua autorização. Preparar o plano não executa código.</p><Button disabled={busy||!environmentReady||!scriptStageReady||!approved.length||run.status!=='completed'||stage?.attempt_count>0} onClick={()=>action(()=>research.post(`/runs/${run.id}/execution/planning`,{operation_record:'system/v1'}))}>Preparar plano com A3</Button></>}
      {proposal&&<section className="plan-review"><h3>Proposta de plano do A3</h3><p>{proposal.output_data.rationale}</p>{proposal.output_data.groups.map((g,i)=><div key={i}><strong>Lote {i+1} · {g.script_ids.length} scripts</strong><p>{g.rationale}</p><p className="muted">{g.script_ids.map(id=>run.test_cases.find(c=>c.id===scripts.find(s=>s.id===id)?.test_case_id)?.code||shortId(id)).join(', ')}</p></div>)}{proposal.output_data.limitations.map((text,i)=><p className="muted" key={i}>{text}</p>)}</section>}
      {(!native||proposal)&&scriptStageReady&&<div className="authorization-panel research-form"><h3>Autorizar execução dos testes</h3><p>Somente os scripts aprovados serão executados. A suíte existente do projeto não será descoberta automaticamente.</p><details open><summary>Conferir escopo e limites</summary><dl className="metadata-list"><dt>Versão do código</dt><dd><code>{run.snapshot_data.code_version.commit_sha}</code></dd><dt>Scripts aprovados</dt><dd>{approved.length} · adaptador {adapter||'indisponível'}</dd><dt>Ambiente</dt><dd>{receipt?.deployment_id||'indisponível'}</dd><dt>Isolamento</dt><dd>Rede desativada, fontes protegidas, CPU, memória e tempo limitados pelo executor.</dd><dt>Plano</dt><dd>{proposal?.output_data.groups.length||'A definir pelo serviço'} lotes; até 200 scripts e 200 lotes.</dd></dl><details><summary>Identidade técnica do ambiente</summary><pre className="code-panel">{JSON.stringify({policy_sha256:receipt?.policy_sha256,image:receipt?.images?.[adapter],limits:receipt?.limits},null,2)}</pre></details></details>
        <ResearchAuthorizationReason label="Finalidade da autorização de execução" disabled={busy} onChange={setReason}/>
        <label className="checkbox-label"><input type="checkbox" checked={authorized} disabled={busy||!environmentReady||!canAuthorize} onChange={e=>setAuthorized(e.target.checked)}/>Autorizo executar os scripts aprovados nesta versão e neste ambiente, dentro dos limites apresentados.</label>
        <Button disabled={busy||!authorized||!reason||!environmentReady||!canAuthorize} onClick={()=>action(()=>research.post(`/runs/${run.id}/execution`,{justification:reason,...(native?{proposal_id:proposal.id}:{})}))}>Autorizar execução isolada</Button>
      </div>}
      {native&&!proposal&&<Button variant="secondary" disabled>Autorizar execução isolada</Button>}
    </div>}
    {autonomous&&<p className="muted">A execução usa a autorização inicial preservada, com código, módulo, ambiente e limites fixados.</p>}
    {(run.execution_plans || []).map(plan=><details key={plan.id}><summary>Plano autorizado · {jobs.filter(j=>j.plan_id===plan.id).length} lotes · {RESULT_LABELS[plan.status]||plan.status}</summary><pre className="code-panel">{JSON.stringify(plan.manifest_data,null,2)}</pre></details>)}
    {jobs.map((job,index)=><section className="review-item" key={job.id}><div className="section-heading"><h3>Lote {index+1}</h3><span>{RESULT_LABELS[job.status]||job.status}</span></div>{job.error&&<ErrorMessage>{job.error}</ErrorMessage>}
      {job.result_data&&<><p className="muted">{RESULT_LABELS[job.result_data.status]||job.result_data.status} · {job.result_data.duration_ms} ms · {date(job.created_at)}</p><div className="table-scroll"><table><thead><tr><th>Teste</th><th>Resultado observado</th><th>Observação</th></tr></thead><tbody>{run.test_results.filter(r=>r.job_id===job.id).map(result=><tr key={result.id}><td>{result.content.test_name}<small>{run.test_cases.find(t=>t.id===result.test_case_id)?.code}</small></td><td>{RESULT_LABELS[result.status]||result.status}</td><td className="result-observation">{result.content.observed}</td></tr>)}</tbody></table></div>
        <details><summary>Evidências, logs e detalhes técnicos</summary><p>Trabalho {job.id} · {job.adapter} · saída {job.result_data.exit_code??'não informada'}</p>{[['Comandos executados',job.result_data.commands],['Ambiente e limites',job.result_data.environment],['Saída padrão',job.result_data.stdout],['Saída de erro',job.result_data.stderr],['Relatórios do framework',job.result_data.framework_reports],['Limitações',job.result_data.limitations]].map(([label,value])=><details key={label}><summary>{label}</summary><pre className="code-panel">{typeof value==='string'?value||'(vazio)':JSON.stringify(value,null,2)}</pre></details>)}</details></>}
    </section>)}
    {!!jobs.length&&<p className="muted">Um teste reprovado não comprova um defeito funcional. Consulte as evidências e a avaliação do A4.</p>}
  </Card>;
}
