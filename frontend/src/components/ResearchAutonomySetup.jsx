import {useState} from 'react';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
export default function ResearchAutonomySetup({projectId,version,code,busy,action,reload,onStart,hasInputs}) {
  const capabilities=useResearch('/capabilities'),[selectedRoot,setRoot]=useState(null),[authorized,setAuthorized]=useState(false),[reason,setReason]=useState('');
  const inspection=code?.inspection,modules=(inspection?.modules || []).filter(m=>m.targets.length && ['node-test/v2','java-junit/v1'].includes(m.adapter)),root=selectedRoot ?? modules[0]?.root ?? '',module=modules.find(m=>m.root===root),receipt=capabilities.data?.execution;
  return <div className="autonomy-setup research-form"><h3>Autorizar uma execução autônoma</h3><p>Os agentes avançam sem aprovações intermediárias. Você acompanha a trajetória e avalia as saídas depois. Admitir um artefato pela plataforma não significa que ele está correto.</p>
    <ErrorMessage>{capabilities.error}</ErrorMessage>
    <div className="inline-actions"><Button variant="secondary" disabled={busy} onClick={()=>action(async()=>{setAuthorized(false);setRoot(null);await research.post(`/projects/${projectId}/versions/${version}/inspect`);reload();})}>Inspecionar escopo para autonomia</Button><Button variant="secondary" disabled={busy} onClick={()=>{setAuthorized(false);capabilities.reload();}}>Verificar ambiente autorizado</Button></div>
    {inspection?.inspection_id && <label>Módulo autorizado<select value={root} disabled={busy} onChange={event=>{setRoot(event.target.value);setAuthorized(false);}}>{modules.map(m=><option key={m.root} value={m.root}>{m.root || '(raiz)'} · {m.adapter}</option>)}</select></label>}
    {!modules.length && <p className="notice compact">Inspecione o commit e escolha um módulo compatível antes de iniciar.</p>}
    <p className="notice compact">{receipt?.ready?`Ambiente: ${receipt.deployment_id} · ${receipt.development_only?'Docker Desktop local':'perfil dedicado'}.` : receipt?.reason || 'Verificando executor…'}</p>
    {receipt?.ready && <details><summary>Identidade do ambiente e limites</summary><p>Política: <code className="artifact-path">{receipt.policy_sha256}</code></p><p>Imagem: <code className="artifact-path">{receipt.images?.[module?.adapter]?.image_id}</code></p><p>Um ciclo de execução, até 200 scripts e 200 lotes. Agentes têm orçamento limitado de chamadas, ferramentas e tokens, preservado na configuração. Propostas de revisão ficam como rascunhos, sem aplicação ou reexecução automática.</p></details>}
    <label>Justificativa da autorização inicial<textarea value={reason} disabled={busy} rows={2} maxLength={5000} onChange={event=>setReason(event.target.value)}/></label>
    <label className="checkbox-label"><input type="checkbox" checked={authorized} disabled={busy || !module || !receipt?.ready} onChange={event=>setAuthorized(event.target.checked)}/>Autorizo os agentes a gerar e executar testes neste SHA, módulo e ambiente, dentro dos limites registrados.</label>
    <Button disabled={busy || !hasInputs || !version || !authorized || !reason.trim() || !inspection?.inspection_id || !receipt?.ready || !receipt.images?.[module?.adapter]} onClick={()=>onStart({authorize_execution:true,inspection_id:inspection.inspection_id,module_root:root,justification:reason})}>Iniciar execução autônoma →</Button>
  </div>;
}
