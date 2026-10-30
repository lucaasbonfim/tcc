import {useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import Card from './Card';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import ResearchStatus from './ResearchStatus';

function Script({script,editable,busy,action,runId}) {
  const [files,setFiles]=useState(script.files_data),[reason,setReason]=useState('');
  const changed=JSON.stringify(files)!==JSON.stringify(script.files_data);
  function review(decision){return action(()=>research.post(`/runs/${runId}/automated-tests/${script.id}/review`,{decision,revision:script.revision,justification:reason,...(changed ? {files} : {})}));}
  return <article className="review-item"><div className="section-heading"><div><span className="item-code">{script.content.test_case_id}</span><h3>Script {script.adapter} · versão {script.version}</h3></div><ResearchStatus status={script.review_status}/></div>
    <p>{script.content.rationale}</p><div className="item-tags">{script.content.requirement_codes.map(code=><span key={code}>{code}</span>)}<span>Contrato compatível; compilação/execução ainda exigem validação</span></div>
    <p className="muted mt-3">Esperado: {script.content.expected_result}</p>
    <details><summary>Alvos, fontes e limitações</summary><pre className="code-panel">{JSON.stringify({alvos:script.content.targets,fontes:script.content.expected_sources,limitações:script.content.limitations},null,2)}</pre></details>
    {files.map((file,index)=><div key={file.path}><p className="repository-label">{file.path}</p>{editable ? <label className="justification-label">Código do teste<textarea className="code-editor" spellCheck={false} rows={12} maxLength={10000} value={file.code} onChange={event=>setFiles(files.map((f,i)=>i===index ? {...f,code:event.target.value} : f))}/></label> : <pre className="code-panel">{file.code}</pre>}</div>)}
    {editable && <div className="review-controls"><label className="justification-label">Justificativa da revisão do script<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label><div className="inline-actions"><Button disabled={busy || !reason.trim()} onClick={()=>review('approved')}>Aprovar script</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={()=>review('rejected')}>Rejeitar script</Button></div><p className="muted">Confira a implementação real, asserções e esperado. Aprovar o script não autoriza execução automaticamente.</p></div>}
  </article>;
}
export default function ResearchAutomationPanel({run,busy,action,onView}) {
  const project=useResearch(`/projects/${run.project_id}`);
  const [selectedRoot,setRoot]=useState(null),[targets,setTargets]=useState([]),[reason,setReason]=useState('');
  const [caseIds,setCaseIds]=useState(null);
  const version=project.data?.versions.find(v=>v.id===run.code_version_id),inspection=version?.inspection;
  const modules=inspection?.modules || [],root=selectedRoot ?? modules[0]?.root ?? '';
  const module=modules.find(m=>m.root===root),stage=run.stages.find(s=>s.agent==='automation');
  const approved=run.test_cases.filter(t=>t.review_status==='approved');
  const selectedCases=caseIds ?? approved.slice(0,20).map(t=>t.id);
  const editable=run.status==='awaiting_review' && stage?.status==='awaiting_review';
  const scripts=run.automated_tests || [];
  return <Card><div className="section-heading"><div><h2>Scripts automatizados · agente 2</h2><p>Geração a partir de casos aprovados e de um escopo inspecionado no mesmo SHA.</p></div>{stage && <ResearchStatus status={stage.status}/>}</div><ErrorMessage>{project.error}</ErrorMessage>
    {!stage && <div className="research-form"><p className="muted">Conclua a revisão textual antes de iniciar esta subetapa. Os testes existentes no repositório não substituem os testes gerados.</p>
      <Button variant="secondary" disabled={busy || !version} onClick={()=>action(async()=>{await research.post(`/projects/${run.project_id}/versions/${run.code_version_id}/inspect`);project.reload();})}>Inspecionar fontes deste commit</Button>
      {inspection?.inspection_version==='2.0.0' && <><label>Módulo<select value={root} onChange={event=>{setRoot(event.target.value);setTargets([]);}}>{modules.map(m=><option key={m.root} value={m.root}>{m.root || '(raiz)'} · {m.stack} · {m.adapter}</option>)}</select></label>
        <p className="muted">Selecione até oito alvos. Dependências locais são verificadas; GUI, banco e bibliotecas não provisionadas serão recusados pelo adaptador.</p>
        {module?.targets.map(path=><label className="checkbox-label" key={path}><input type="checkbox" checked={targets.includes(path)} onChange={event=>setTargets(event.target.checked ? [...targets,path] : targets.filter(p=>p!==path))}/><span>{path}</span></label>)}
        {!module?.targets.length && <p className="notice">Nenhuma fonte candidata foi identificada neste módulo.</p>}
        <details><summary>Casos selecionados para automação ({selectedCases.length}/20)</summary>{approved.map(row=><label className="checkbox-label" key={row.id}><input type="checkbox" checked={selectedCases.includes(row.id)} onChange={event=>setCaseIds(event.target.checked ? [...selectedCases,row.id] : selectedCases.filter(id=>id!==row.id))}/>{row.code} · {row.content.title}</label>)}</details>
        {inspection.warnings?.map((warning,index)=><p className="notice compact" key={index}>{warning}</p>)}
        <label>Justificativa do escopo e da geração<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
        <Button disabled={busy || run.status!=='completed' || run.stages.find(s=>s.agent==='tests')?.status!=='completed' || !reason.trim() || targets.length===0 || targets.length>8 || selectedCases.length===0 || selectedCases.length>20} onClick={()=>action(()=>research.post(`/runs/${run.id}/automation`,{inspection_id:inspection.inspection_id,module_root:root,target_paths:targets,test_case_ids:selectedCases,justification:reason}))}>Gerar scripts dos casos aprovados</Button>
      </>}
    </div>}
    {(run.agent_outputs?.automation?.warnings || []).map((warning,index)=><p className="notice compact" key={index}>{warning}</p>)}
    {(run.agent_outputs?.automation?.unsupported_cases || []).map(item=><p className="notice compact" key={item.test_case_id}><strong>Caso {run.test_cases.find(t=>t.id===item.test_case_id)?.code || item.test_case_id} não automatizado:</strong> {item.reason}</p>)}
    {scripts.map(script=><Script key={`${script.id}-${script.revision}`} script={script} editable={editable} busy={busy} action={action} runId={run.id}/>)}
    {editable && <div className="stage-approval"><label>Justificativa da aprovação dos scripts<textarea rows={2} maxLength={5000} value={reason} onChange={event=>setReason(event.target.value)}/></label><Button className="mt-3" disabled={busy || !reason.trim() || scripts.some(s=>s.review_status==='pending') || !scripts.some(s=>s.review_status==='approved')} onClick={()=>action(async()=>{await research.post(`/runs/${run.id}/automation/approve`,{justification:reason});onView('evidence');})}>Concluir revisão dos scripts</Button></div>}
    {stage?.status==='completed' && <p className="notice compact">Scripts aprovados. A autorização de execução é feita na aba Execução e requer executor validado.</p>}
  </Card>;
}
