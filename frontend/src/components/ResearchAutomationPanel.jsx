import {useCallback,useEffect,useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import ResearchStatus from './ResearchStatus';

function Script({script,editable,busy,action,runId,onDirty,caseCode}) {
  const [files,setFiles]=useState(script.files_data),[reason,setReason]=useState('');
  const changed=JSON.stringify(files)!==JSON.stringify(script.files_data);
  useEffect(()=>{onDirty(script.id,changed);return()=>onDirty(script.id,false);},[script.id,changed,onDirty]);
  function review(decision){return action(()=>research.post(`/runs/${runId}/automated-tests/${script.id}/review`,{decision,revision:script.revision,justification:reason.trim() || (decision==='edited' ? 'Código corrigido pelo pesquisador antes da aprovação dos scripts.' : 'Decisão do pesquisador na revisão dos scripts.'),...(changed ? {files} : {})}));}
  return <article className="review-item"><div className="section-heading"><div><span className="item-code">{caseCode || 'Caso vinculado'}</span><h3>Script · versão {script.version}</h3></div><ResearchStatus status={script.review_status}/></div>
    <p>{script.content.rationale}</p><div className="item-tags">{script.content.requirement_codes.map(code=><span key={code}>{code}</span>)}<span>Contrato compatível; compilação/execução ainda exigem validação</span></div>
    <p className="muted mt-3">Esperado: {script.content.expected_result}</p>
    {script.processing_status==='eligible' && script.review_status==='pending' && <p className="muted">Admitido pela plataforma · sem aprovação humana.</p>}
    <details><summary>Alvos, fontes e limitações</summary><pre className="code-panel">{JSON.stringify({adaptador:script.adapter,caso_id:script.test_case_id,alvos:script.content.targets,fontes:script.content.expected_sources,limitações:script.content.limitations},null,2)}</pre></details>
    <details><summary>Ver ou corrigir código do script</summary>{files.map((file,index)=><div key={file.path}><p className="repository-label">{file.path}</p>{editable ? <label className="justification-label">Código do teste<textarea disabled={busy} className="code-editor" spellCheck={false} rows={12} maxLength={10000} value={file.code} onChange={event=>setFiles(files.map((f,i)=>i===index ? {...f,code:event.target.value} : f))}/></label> : <pre className="code-panel">{file.code}</pre>}</div>)}</details>
    {editable && <div className="review-controls"><details><summary>Adicionar observação da revisão (opcional)</summary><label className="justification-label">Justificativa da revisão do script<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label></details><div className="inline-actions"><Button disabled={busy || !changed} onClick={()=>review('edited')}>Salvar correção do script</Button><Button variant="secondary" disabled={busy || !changed} onClick={()=>setFiles(script.files_data)}>Descartar alterações</Button><Button variant="secondary" disabled={busy || changed} onClick={()=>review('rejected')}>Rejeitar script</Button></div><p className="muted">Confira a implementação real, asserções e esperado. Use a aprovação de todos no início da lista para seguir.</p></div>}
  </article>;
}
export default function ResearchAutomationPanel({run,busy,action,onView,onDraftChange}) {
  const autonomous=run.workflow_mode==='autonomous/v1',isAgent=run.snapshot_data.agent_policy?.modes?.automation==='agent/v1';
  const project=useResearch(`/projects/${run.project_id}`),[selectedRoot,setRoot]=useState(null),[caseIds,setCaseIds]=useState(null),[drafts,setDrafts]=useState(new Set());
  const onDirty=useCallback((id,dirty)=>{setDrafts(previous=>{if(previous.has(id)===dirty)return previous;const next=new Set(previous);if(dirty)next.add(id);else next.delete(id);return next;});onDraftChange?.(id,dirty);},[onDraftChange]);
  const version=project.data?.versions.find(v=>v.id===run.code_version_id),inspection=version?.inspection,modules=inspection?.modules || [],root=selectedRoot ?? modules[0]?.root ?? '',module=modules.find(m=>m.root===root),stage=run.stages.find(s=>s.agent==='automation');
  const approved=run.test_cases.filter(t=>t.review_status==='approved'),selectedCases=caseIds===null?approved.map(t=>t.id):caseIds.filter(id=>approved.some(row=>row.id===id));
  const editable=!autonomous&&run.status==='awaiting_review'&&stage?.status==='awaiting_review',scripts=run.automated_tests || [];
  const ready=run.status==='completed'&&run.stages.find(s=>s.agent==='tests')?.status==='completed',viable=module?.targets.length&&module?.automation_plan?.scope_count!==0;
  return <Card><div className="section-heading"><div><h2>Scripts automatizados · agente 2</h2><p>Gere os testes, confira o código e aprove os scripts para preparar a execução.</p></div>{stage&&<ResearchStatus status={stage.status}/>}</div><ErrorMessage>{project.error}</ErrorMessage>
    {!stage&&!autonomous&&<div className="research-form">
      {!ready?<p className="muted">Conclua a revisão dos casos de teste antes de gerar scripts.</p>:<>
        {inspection?.inspection_version!=='2.0.0'?<><p>Primeiro, verifique quais módulos deste projeto podem ser automatizados.</p><Button disabled={busy||!version} onClick={()=>action(async()=>{await research.post(`/projects/${run.project_id}/versions/${run.code_version_id}/inspect`);project.reload();})}>Inspecionar fontes deste commit</Button></>:<>
          <label>Módulo<select disabled={busy} value={root} onChange={e=>setRoot(e.target.value)}>{modules.map(m=><option key={m.root} value={m.root}>{m.root||'Módulo principal'} · {m.stack}</option>)}</select></label>
          <p><strong>{selectedCases.length}</strong> de {approved.length} cenários aprovados selecionados. {viable?'Módulo compatível com geração de scripts.':'Nenhum conjunto de fontes deste módulo é compatível com o adaptador atual.'}</p>
          {!viable&&<p className="notice">Consulte as restrições técnicas ou escolha outro módulo. Os casos textuais continuam disponíveis.</p>}
          <Button disabled={busy||!viable||!selectedCases.length} onClick={()=>action(()=>research.post(`/runs/${run.id}/automation`,{inspection_id:inspection.inspection_id,module_root:root,test_case_ids:selectedCases,operation_record:'system/v1'}))}>{selectedCases.length===approved.length?'Gerar scripts de todos os cenários aprovados':`Gerar scripts dos ${selectedCases.length} cenários selecionados`}</Button>
          <small>Gerar scripts não executa código. A operação é registrada pelo sistema.</small>
          <details><summary>Escolher cenários ({selectedCases.length} de {approved.length})</summary><div className="inline-actions"><Button variant="secondary" disabled={busy} onClick={()=>setCaseIds(null)}>Selecionar todos os cenários</Button><Button variant="secondary" disabled={busy} onClick={()=>setCaseIds([])}>Limpar seleção</Button></div>{approved.map(row=><label className="checkbox-label" key={row.id}><input type="checkbox" disabled={busy} checked={selectedCases.includes(row.id)} onChange={e=>setCaseIds(e.target.checked?[...selectedCases,row.id]:selectedCases.filter(id=>id!==row.id))}/>{row.code} · {row.content.title}</label>)}</details>
          <details className="secondary-section"><summary>Ver detalhes técnicos da geração</summary><p>Módulo inteiro selecionado. {isAgent?'O agente escolhe as fontes com ferramentas.':'A plataforma organiza as fontes em escopos predefinidos.'}</p><p>{inspection.files.length} arquivos lidos · {inspection.omitted.length} omitidos · adaptador {module?.adapter}.</p><Button variant="secondary" disabled={busy} onClick={()=>action(async()=>{await research.post(`/projects/${run.project_id}/versions/${run.code_version_id}/inspect`);project.reload();})}>Inspecionar fontes deste commit</Button>
            {module?.automation_plan&&<><p>{module.automation_plan.eligible_target_paths.length} fontes candidatas · {module.automation_plan.scope_count} escopos compatíveis.</p>{module.automation_plan.scope_targets.map(scope=><div key={scope.index}><h3>Escopo {scope.index+1}</h3>{scope.source_paths.map(path=><p className="repository-label" key={path}>{path}</p>)}</div>)}{module.automation_plan.excluded.map(item=><p key={item.path}>{item.path}: {item.reason}</p>)}</>}{inspection.warnings?.map((w,i)=><p className="notice compact" key={i}>{w}</p>)}
          </details>
        </>}
      </>}
    </div>}
    {!stage&&autonomous&&<p className="muted">A geração começa após os casos e usa o módulo da autorização inicial.</p>}
    {stage&&['failed','not_supported'].includes(stage.status)&&!scripts.length&&<p className="notice">{stage.status==='failed'?`Não foi possível gerar scripts: ${stage.message||'consulte a falha no histórico.'}`:'Nenhum script compatível foi gerado. Os casos textuais não representam testes executados.'}</p>}
    {stage&&run.automation_parts?.length>0&&<div className="generation-progress"><p><strong>{run.automation_parts.filter(p=>p.status==='completed').length}/{run.automation_parts.length} lotes de scripts concluídos</strong></p><p className="muted">{run.automation_coverage.generated} scripts gerados · {run.automation_coverage.unsupported.length} casos não automatizados · {run.automation_coverage.missing.length} sem resultado.</p><details><summary>Ver lotes e detalhes técnicos</summary><pre className="code-panel">{JSON.stringify(stage.context.scope_plan,null,2)}</pre>{run.automation_parts.map(p=><p key={p.id}>Lote {p.sequence} · <ResearchStatus status={p.status}/>{p.error&&` · ${p.error}`}</p>)}</details></div>}
    {editable&&<div className="stage-approval"><h3>Revisar scripts e continuar</h3><p>Aprova os pendentes e mantém os rejeitados excluídos. A execução exige uma autorização própria.</p>{drafts.size>0&&<p role="status">Salve ou descarte as alterações antes de continuar.</p>}<Button disabled={busy||drafts.size>0||!scripts.some(s=>s.review_status!=='rejected')} onClick={()=>action(async()=>{await research.post(`/runs/${run.id}/automation/approve`,{approve_pending:true,revisions:Object.fromEntries(scripts.map(({id,revision})=>[id,revision])),justification:'Aprovação em lote pelo pesquisador dos scripts pendentes, preservando correções e rejeições.'});onView('evidence');})}>Aprovar todos os scripts e continuar →</Button></div>}
    {(run.agent_outputs?.automation?.warnings || []).map((w,i)=><p className="notice compact" key={i}>{w}</p>)}
    {(run.agent_outputs?.automation?.unsupported_cases || []).map(item=><p className="notice compact" key={item.test_case_id}><strong>Caso {run.test_cases.find(t=>t.id===item.test_case_id)?.code || item.test_case_id} não automatizado:</strong> {item.reason}</p>)}
    {scripts.map(script=><Script key={`${script.id}-${script.revision}`} script={script} editable={editable} busy={busy} action={action} runId={run.id} onDirty={onDirty} caseCode={run.test_cases.find(c=>c.id===script.test_case_id)?.code}/>)}
    {stage?.status==='completed'&&<Button onClick={()=>onView('evidence')}>Preparar execução dos testes →</Button>}
  </Card>;
}
