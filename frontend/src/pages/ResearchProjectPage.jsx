import {useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useResearch} from '../hooks/useResearch';
import {research} from '../services/research.service';
import {date,shortId} from '../utils/research';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ResearchStatus from '../components/ResearchStatus';
import ResearchInspectionView from '../components/ResearchInspectionView';
import ResearchAutonomySetup from '../components/ResearchAutonomySetup';

export default function ResearchProjectPage() {
  const {projectId}=useParams(),{data:project,error,loading,reload}=useResearch(`/projects/${projectId}`),navigate=useNavigate();
  const [actionError,setActionError]=useState(''),[busy,setBusy]=useState(false),[document,setDocument]=useState(null),[selectedVersion,setVersion]=useState(''),[selectedDocuments,setDocuments]=useState(null),[file,setFile]=useState(null);
  const [automationMode,setAutomationMode]=useState('agent/v1'),[requirementsAgent,setRequirementsAgent]=useState(false),[testsAgent,setTestsAgent]=useState(false),[evaluationAgent,setEvaluationAgent]=useState(false),[executionAgent,setExecutionAgent]=useState(false),[workflow,setWorkflow]=useState('assisted/v1');
  const version=selectedVersion || project?.versions[0]?.id || '',names=new Set();
  const documents=selectedDocuments ?? (project?.documents || []).filter(doc=>{if(names.has(doc.name))return false;names.add(doc.name);return true;}).map(doc=>doc.id);
  const code=project?.versions.find(v=>v.id===version),active=project?.runs.find(r=>['pending','running','awaiting_review'].includes(r.status));
  async function action(work){setBusy(true);setActionError('');try{await work();}catch(e){setActionError(e.message);}finally{setBusy(false);}}
  async function start(autonomy){return action(async()=>{const run=await research.post(`/projects/${projectId}/runs`,{code_version_id:version,document_ids:documents,workflow_mode:workflow,...(autonomy?{autonomy}:{}),agent_policy:{modes:{requirements:requirementsAgent?'agent/v1':'fixed/v1',tests:testsAgent?'agent/v1':'fixed/v1',evaluation:evaluationAgent?'agent/v1':'fixed/v1',execution:executionAgent?'agent/v1':'fixed/v1',automation:automationMode}}});navigate(`/admin/runs/${run.id}`);});}
  if(loading&&!project)return <Loading>Carregando projeto…</Loading>;
  if(!project)return <ErrorMessage>{error}</ErrorMessage>;
  return <div className="page-stack preparation-page">
    <div className="page-heading"><div><Link className="back-link" to="/admin/projects">← Projetos</Link><h1>{project.name}</h1>{project.description&&<p>{project.description}</p>}<a className="repository-label" href={project.repository_url} target="_blank" rel="noreferrer">{project.repository_url.replace('https://github.com/','')} ↗</a></div><Link className="secondary-link" to={`/admin/projects/${projectId}/edit`}>Editar projeto</Link></div>
    <ErrorMessage>{error||actionError}</ErrorMessage>
    {active&&<div className="next-action"><div><h2>Este projeto já tem uma análise aberta</h2><p>Conclua ou encerre a análise antes de iniciar outra.</p></div><Link className="action-link" to={`/admin/runs/${active.id}`}>Abrir análise</Link></div>}
    <Card><div className="section-heading"><div><span className="preparation-step">Etapa 1 de 3</span><h2>Entradas da análise</h2><p>Adicione e selecione os documentos que os agentes devem analisar.</p></div><span>{documents.length} selecionados</span></div>
      <div className="document-selection">{!project.documents.length?<p className="muted">Nenhum documento adicionado. Envie um arquivo ou use o texto complementar do projeto.</p>:project.documents.map(doc=><div className="document-row" key={doc.id}><label className="checkbox-label"><input type="checkbox" disabled={busy} checked={documents.includes(doc.id)} onChange={e=>setDocuments(e.target.checked?[...documents,doc.id]:documents.filter(id=>id!==doc.id))}/><span>{doc.name} · v{doc.version} · {doc.page_count} páginas</span></label><button className="text-button" disabled={busy} onClick={()=>action(async()=>setDocument(await research.get(`/projects/${projectId}/documents/${doc.id}`)))}>Consultar extração</button></div>)}</div>
      <form className="document-upload research-form" onSubmit={e=>{e.preventDefault();if(file)action(async()=>{await research.upload(projectId,file);setFile(null);reload();});}}><label>Selecionar documento<input key={project.documents.length} type="file" accept=".pdf,.txt,.md" required disabled={busy} onChange={e=>setFile(e.target.files[0])}/><small>PDF com texto, TXT ou MD. Até 10 MiB; PDF até 200 páginas. Não há OCR.</small></label><Button variant="secondary" type="submit" disabled={busy||!file}>Adicionar documento</Button></form>
      {project.complementary_text&&<details><summary>Texto complementar incluído</summary><p className="preserve-text">{project.complementary_text}</p></details>}
      {document&&<div className="extraction-panel"><div className="section-heading"><h3>{document.name} · v{document.version}</h3><button className="text-button" onClick={()=>setDocument(null)}>Fechar extração</button></div>{document.warnings.map((w,i)=><p className="notice compact" key={i}>{w}</p>)}<Button variant="secondary" disabled={busy} onClick={()=>action(()=>research.download(`/projects/${projectId}/documents/${document.id}/download`,document.name))}>Baixar original</Button><div className="document-pages">{document.pages.map(p=><details key={p.page}><summary>Página {p.page}</summary><p className="preserve-text">{p.text||'Sem texto extraído.'}</p></details>)}</div></div>}
    </Card>
    <Card><div className="section-heading"><div><span className="preparation-step">Etapa 2 de 3</span><h2>Modo de análise</h2><p>Confirme os documentos e escolha como acompanhar o trabalho.</p></div></div><div className="research-form">
      <label>Modo de trabalho<select aria-label="Modo de trabalho" disabled={busy} value={workflow} onChange={e=>{setWorkflow(e.target.value);if(e.target.value==='autonomous/v1'){setRequirementsAgent(true);setTestsAgent(true);setEvaluationAgent(true);setExecutionAgent(true);setAutomationMode('agent/v1');}}}><option value="assisted/v1">Assistido · revisar entre etapas</option><option value="autonomous/v1">Autônomo · autorizar antes e avaliar ao final</option></select></label>
      <p>{workflow==='assisted/v1'?'Você revisa requisitos, casos e scripts antes de continuar. Executar código exige autorização própria.':'Os quatro agentes usam ferramentas e avançam dentro do escopo autorizado. Você avalia os artefatos depois; não há aprovação humana intermediária.'}</p>
      <details className="secondary-section"><summary>Configurações avançadas da análise</summary><div className="research-form">
        <label>Versão de código<select disabled={busy} value={version} onChange={e=>setVersion(e.target.value)}>{project.versions.map(v=><option key={v.id} value={v.id}>{v.requested_ref} · {shortId(v.commit_sha)} · {date(v.resolved_at)}</option>)}</select></label>
        {code&&<p className="muted">Commit preservado: <code className="artifact-path">{code.commit_sha}</code></p>}
        <p className="muted">A condição de cada agente será registrada nesta análise. Estas opções não alteram análises anteriores.</p>
        <label className="checkbox-label"><input type="checkbox" disabled={busy} checked={requirementsAgent} onChange={e=>setRequirementsAgent(e.target.checked)}/>Análise de requisitos com ferramentas</label>
        <label className="checkbox-label"><input type="checkbox" disabled={busy} checked={testsAgent} onChange={e=>setTestsAgent(e.target.checked)}/>Geração de casos com ferramentas</label>
        <label className="checkbox-label"><input type="checkbox" disabled={busy} checked={executionAgent} onChange={e=>setExecutionAgent(e.target.checked)}/>Planejamento de execução com ferramentas</label>
        <label className="checkbox-label"><input type="checkbox" disabled={busy} checked={evaluationAgent} onChange={e=>setEvaluationAgent(e.target.checked)}/>Avaliação de evidências com ferramentas</label>
        <label>Geração de scripts<select disabled={busy} value={automationMode} onChange={e=>setAutomationMode(e.target.value)}><option value="fixed/v1">Etapas predefinidas (fixed/v1)</option><option value="agent/v1">Agente com ferramentas (agent/v1)</option></select></label>
        <small>Opções desmarcadas usam fixed/v1. Opções marcadas usam agent/v1.</small>
      </div></details>
    </div></Card>
    <Card className="preparation-confirmation"><div className="section-heading"><div><span className="preparation-step">Etapa 3 de 3</span><h2>Conferir e iniciar</h2><p>Estas entradas serão preservadas na nova análise.</p></div></div>
      <dl className="preparation-summary"><div><dt>Documentos selecionados</dt><dd>{documents.length?project.documents.filter(doc=>documents.includes(doc.id)).map(doc=><span key={doc.id}>{doc.name} (v{doc.version})</span>):'Nenhum documento selecionado'}</dd></div><div><dt>Texto complementar</dt><dd>{project.complementary_text?'Incluído':'Não informado'}</dd></div><div><dt>Versão do código</dt><dd>{code?<><span>{code.requested_ref}</span><code>{shortId(code.commit_sha)}</code></>:'Nenhuma versão disponível'}</dd></div><div><dt>Revisão humana</dt><dd>{workflow==='assisted/v1'?'Entre as etapas; execução autorizada separadamente':'Após a análise; execução autorizada antes de iniciar'}</dd></div></dl>
      <div className="research-form">
      {workflow==='autonomous/v1'?<ResearchAutonomySetup key={version} projectId={projectId} version={version} code={code} busy={busy||Boolean(active)} action={action} reload={reload} onStart={start} hasInputs={documents.length>0||Boolean(project.complementary_text)}/>:<><Button disabled={busy||Boolean(active)||!version||(!documents.length&&!project.complementary_text)} onClick={()=>start()}>{busy?'Preparando…':'Iniciar análise de requisitos →'}</Button>{!documents.length&&!project.complementary_text&&<p role="status" className="muted">Adicione um documento ou texto complementar para iniciar.</p>}</>}
    </div></Card>
    <details className="secondary-section"><summary>Viabilidade e detalhes técnicos do projeto</summary><div className="research-form"><p className="muted">{code?.inspection.reason}</p><Button variant="secondary" disabled={busy||!code} onClick={()=>action(async()=>{await research.post(`/projects/${projectId}/versions/${version}/inspect`);reload();})}>Inspecionar stack</Button>{code&&<ResearchInspectionView inspection={code.inspection} repositoryUrl={code.repository_url} commitSha={code.commit_sha}/>}<p>Gerar scripts não executa testes. A disponibilidade do executor será conferida antes da autorização.</p>{project.technical_notes&&<p className="preserve-text">{project.technical_notes}</p>}</div></details>
    <Card><div className="section-heading"><h2>Histórico do projeto</h2><span>{project.runs.length} análises</span></div>{project.runs.length?<div className="table-scroll"><table><thead><tr><th>Análise</th><th>Estado</th><th>Início</th></tr></thead><tbody>{project.runs.map(r=><tr key={r.id}><td><Link to={`/admin/runs/${r.id}`}>{shortId(r.id)} →</Link></td><td><ResearchStatus status={r.status}/></td><td>{date(r.created_at)}</td></tr>)}</tbody></table></div>:<p className="muted">Nenhuma análise iniciada.</p>}</Card>
  </div>;
}
