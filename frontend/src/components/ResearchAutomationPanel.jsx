import {useCallback,useEffect,useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import ResearchStatus from './ResearchStatus';

function Script({script,editable,busy,action,runId,onDirty}) {
  const [files,setFiles]=useState(script.files_data),[reason,setReason]=useState('');
  const changed=JSON.stringify(files)!==JSON.stringify(script.files_data);
  useEffect(()=>{onDirty(script.id,changed);return()=>onDirty(script.id,false);},[script.id,changed,onDirty]);
  function review(decision){return action(()=>research.post(`/runs/${runId}/automated-tests/${script.id}/review`,{decision,revision:script.revision,justification:reason.trim() || (decision==='edited' ? 'Código corrigido pelo pesquisador antes da aprovação dos scripts.' : 'Decisão do pesquisador na revisão dos scripts.'),...(changed ? {files} : {})}));}
  return <article className="review-item"><div className="section-heading"><div><span className="item-code">{script.content.test_case_id}</span><h3>Script {script.adapter} · versão {script.version}</h3></div><ResearchStatus status={script.review_status}/></div>
    <p>{script.content.rationale}</p><div className="item-tags">{script.content.requirement_codes.map(code=><span key={code}>{code}</span>)}<span>Contrato compatível; compilação/execução ainda exigem validação</span></div>
    <p className="muted mt-3">Esperado: {script.content.expected_result}</p>
    <details><summary>Alvos, fontes e limitações</summary><pre className="code-panel">{JSON.stringify({alvos:script.content.targets,fontes:script.content.expected_sources,limitações:script.content.limitations},null,2)}</pre></details>
    <details><summary>Ver ou corrigir código do script</summary>{files.map((file,index)=><div key={file.path}><p className="repository-label">{file.path}</p>{editable ? <label className="justification-label">Código do teste<textarea disabled={busy} className="code-editor" spellCheck={false} rows={12} maxLength={10000} value={file.code} onChange={event=>setFiles(files.map((f,i)=>i===index ? {...f,code:event.target.value} : f))}/></label> : <pre className="code-panel">{file.code}</pre>}</div>)}</details>
    {editable && <div className="review-controls"><details><summary>Adicionar observação da revisão (opcional)</summary><label className="justification-label">Justificativa da revisão do script<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label></details><div className="inline-actions"><Button disabled={busy || !changed} onClick={()=>review('edited')}>Salvar correção do script</Button><Button variant="secondary" disabled={busy || !changed} onClick={()=>setFiles(script.files_data)}>Descartar alterações</Button><Button variant="secondary" disabled={busy} onClick={()=>review('rejected')}>Rejeitar script</Button></div><p className="muted">Confira a implementação real, asserções e esperado. Use a aprovação de todos no início da lista para seguir.</p></div>}
  </article>;
}
export default function ResearchAutomationPanel({run,busy,action,onView}) {
  const project=useResearch(`/projects/${run.project_id}`);
  const [selectedRoot,setRoot]=useState(null),[reason,setReason]=useState('');
  const [caseIds,setCaseIds]=useState(null);
  const [drafts,setDrafts]=useState(new Set());
  const onDirty=useCallback((id,dirty)=>setDrafts(previous=>{if(previous.has(id)===dirty)return previous;const next=new Set(previous);if(dirty)next.add(id);else next.delete(id);return next;}),[]);
  const version=project.data?.versions.find(v=>v.id===run.code_version_id),inspection=version?.inspection;
  const modules=inspection?.modules || [],root=selectedRoot ?? modules[0]?.root ?? '';
  const module=modules.find(m=>m.root===root),stage=run.stages.find(s=>s.agent==='automation');
  const approved=run.test_cases.filter(t=>t.review_status==='approved');
  const selectedCases=caseIds===null ? approved.map(t=>t.id) : caseIds.filter(id=>approved.some(row=>row.id===id));
  const editable=run.status==='awaiting_review' && stage?.status==='awaiting_review';
  const scripts=run.automated_tests || [];
  return <Card><div className="section-heading"><div><h2>Scripts automatizados · agente 2</h2><p>Geração a partir de casos aprovados e de um escopo inspecionado no mesmo SHA.</p></div>{stage && <ResearchStatus status={stage.status}/>}</div><ErrorMessage>{project.error}</ErrorMessage>
    {!stage && <div className="research-form"><p className="muted">{run.stages.find(item=>item.agent==='tests')?.status==='completed' ? 'Casos aprovados. Escolha o módulo; as fontes serão organizadas automaticamente para a geração.' : 'Conclua a revisão textual antes de iniciar esta subetapa.'}</p>
      <Button variant="secondary" disabled={busy || !version} onClick={()=>action(async()=>{await research.post(`/projects/${run.project_id}/versions/${run.code_version_id}/inspect`);project.reload();})}>Inspecionar fontes deste commit</Button>
      {inspection?.inspection_version==='2.0.0' && <><label>Módulo<select value={root} onChange={event=>setRoot(event.target.value)}>{modules.map(m=><option key={m.root} value={m.root}>{m.root || '(raiz)'} · {m.stack} · {m.adapter}</option>)}</select></label>
        <p className="notice compact">Módulo inteiro selecionado. A plataforma organiza as fontes em escopos compatíveis automaticamente.</p>
        <p className="muted">{inspection.files.length} arquivos lidos · {inspection.omitted.length} omitidos{inspection.read_batches && ` · ${inspection.read_batches.length} lotes de leitura`}. Leitura do código e capacidade de executar os testes são verificações distintas.</p>
        {module?.automation_plan && <div className="notice compact"><strong>{module.automation_plan.eligible_target_paths.length} fontes candidatas compatíveis · {module.automation_plan.scope_count} escopos automáticos</strong><details><summary>Fontes consideradas e restrições do módulo</summary>{module.automation_plan.scope_targets.map(scope=><div key={scope.index}><p>Escopo {scope.index+1}</p>{scope.source_paths.map(path=><p className="repository-label" key={path}>{path}</p>)}</div>)}{module.automation_plan.excluded.map(item=><div key={item.path}><p className="repository-label">{item.path}</p><p>{item.reason}</p></div>)}</details></div>}
        {(!module?.targets.length || module?.automation_plan?.scope_count===0) && <p className="notice">Nenhum fechamento de fontes deste módulo é compatível com o adaptador atual. Consulte as restrições por arquivo.</p>}
        <p className="notice compact">{selectedCases.length} de {approved.length} cenários aprovados selecionados. A geração percorre todos os selecionados em lotes automáticos, preservando os já concluídos.</p>
        <details><summary>Escolher cenários ({selectedCases.length} de {approved.length})</summary><div className="inline-actions"><Button variant="secondary" disabled={busy} onClick={()=>setCaseIds(null)}>Selecionar todos os cenários</Button><Button variant="secondary" disabled={busy} onClick={()=>setCaseIds([])}>Limpar seleção</Button></div>{approved.map(row=><label className="checkbox-label" key={row.id}><input type="checkbox" checked={selectedCases.includes(row.id)} onChange={event=>setCaseIds(event.target.checked ? [...selectedCases,row.id] : selectedCases.filter(id=>id!==row.id))}/>{row.code} · {row.content.title}</label>)}</details>
        {inspection.warnings?.map((warning,index)=><p className="notice compact" key={index}>{warning}</p>)}
        <label>Justificativa do escopo e da geração<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
        <Button disabled={busy || run.status!=='completed' || run.stages.find(s=>s.agent==='tests')?.status!=='completed' || !reason.trim() || !module?.targets.length || module?.automation_plan?.scope_count===0 || selectedCases.length===0} onClick={()=>action(()=>research.post(`/runs/${run.id}/automation`,{inspection_id:inspection.inspection_id,module_root:root,test_case_ids:selectedCases,justification:reason}))}>{selectedCases.length===approved.length ? 'Gerar scripts de todos os cenários aprovados' : `Gerar scripts dos ${selectedCases.length} cenários selecionados`}</Button>
      </>}
    </div>}
    {stage?.context?.scope_plan && <p className="notice compact">{stage.context.scope_plan.mode==='module' ? 'Módulo inteiro considerado' : 'Fontes selecionadas consideradas'} · {stage.context.scope_plan.scope_count} escopos compatíveis. Casos sem script em um escopo são considerados nos demais antes da justificativa final.</p>}
    {stage && run.automation_parts?.length>0 && <div className="notice compact"><strong>{run.automation_parts.filter(part=>part.status==='completed').length}/{run.automation_parts.length} lotes de scripts concluídos</strong><p>{run.automation_coverage.generated} scripts gerados · {run.automation_coverage.unsupported.length} cenários com justificativa de impossibilidade · {run.automation_coverage.missing.length} ainda sem resultado, de {run.automation_coverage.selected} selecionados.</p><details><summary>Lotes, cenários e erros de geração</summary>{run.automation_parts.map(part=><p key={part.id}>Lote {part.sequence}: {part.case_ids.map(id=>run.test_cases.find(row=>row.id===id)?.code || id).join(', ')} · <ResearchStatus status={part.status}/>{part.error && ` · ${part.error}`}</p>)}</details></div>}
    {editable && <div className="stage-approval"><h3>Corrija os scripts necessários e aprove todos de uma vez</h3><p>Rejeitados continuam excluídos. Esta aprovação conclui a revisão dos scripts; a execução tem autorização própria.</p>{drafts.size>0 && <p role="status">Salve ou descarte as alterações em edição antes de continuar.</p>}<Button className="mt-3" disabled={busy || drafts.size>0 || !scripts.some(script=>script.review_status!=='rejected')} onClick={()=>action(async()=>{await research.post(`/runs/${run.id}/automation/approve`,{approve_pending:true,revisions:Object.fromEntries(scripts.map(({id,revision})=>[id,revision])),justification:'Aprovação em lote pelo pesquisador dos scripts pendentes, preservando correções e rejeições.'});onView('evidence');})}>Aprovar todos os scripts e continuar →</Button></div>}
    {(run.agent_outputs?.automation?.warnings || []).map((warning,index)=><p className="notice compact" key={index}>{warning}</p>)}
    {(run.agent_outputs?.automation?.unsupported_cases || []).map(item=><p className="notice compact" key={item.test_case_id}><strong>Caso {run.test_cases.find(t=>t.id===item.test_case_id)?.code || item.test_case_id} não automatizado:</strong> {item.reason}</p>)}
    {scripts.map(script=><Script key={`${script.id}-${script.revision}`} script={script} editable={editable} busy={busy} action={action} runId={run.id} onDirty={onDirty}/>)}
    {stage?.status==='completed' && <p className="notice compact">Scripts aprovados. A autorização de execução é feita na aba Execução e requer executor validado.</p>}
  </Card>;
}
