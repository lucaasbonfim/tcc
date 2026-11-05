import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResearch } from '../hooks/useResearch';
import { research } from '../services/research.service';
import { date, shortId } from '../utils/research';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ResearchStatus from '../components/ResearchStatus';
import ResearchInspectionView from '../components/ResearchInspectionView';

export default function ResearchProjectPage() {
  const {projectId} = useParams();
  const {data:project,error,loading,reload} = useResearch(`/projects/${projectId}`);
  const navigate = useNavigate();
  const [actionError,setActionError] = useState('');
  const [busy,setBusy] = useState(false);
  const [document,setDocument] = useState(null);
  const [selectedVersion,setVersion] = useState('');
  const [selectedDocuments,setDocuments] = useState(null);
  const [file,setFile] = useState(null);
  const [automationMode,setAutomationMode] = useState('agent/v1');
  const [requirementsAgent,setRequirementsAgent] = useState(false);
  const [testsAgent,setTestsAgent] = useState(false);
  const [evaluationAgent,setEvaluationAgent] = useState(false);
  const version = selectedVersion || project?.versions[0]?.id || '';
  const names = new Set();
  const documents = selectedDocuments ?? (project?.documents || []).filter(doc => {if (names.has(doc.name)) return false; names.add(doc.name); return true;}).map(doc => doc.id);
  async function action(work) {setBusy(true);setActionError('');try {await work();}catch(cause){setActionError(cause.message);}finally{setBusy(false);}}
  const code = project?.versions.find(item => item.id===version);
  if (loading && !project) return <Loading>Carregando projeto...</Loading>;
  if (!project) return <ErrorMessage>{error}</ErrorMessage>;
  return <div className="page-stack"><div className="page-heading"><div><Link className="back-link" to="/admin/projects">← Projetos</Link><h1>{project.name}</h1><p>{project.description || 'Projeto sem descrição.'}</p><a className="repository-label" href={project.repository_url} target="_blank" rel="noreferrer">{project.repository_url} ↗</a></div><Link className="secondary-link" to={`/admin/projects/${projectId}/edit`}>Editar projeto</Link></div>
    <ErrorMessage>{error || actionError}</ErrorMessage>
    <Card><div className="section-heading"><div><h2>Preparar análise</h2><p>Selecione versões imutáveis para esta execução.</p></div><span className="eyebrow">01 / ENTRADAS</span></div>
      <div className="research-form"><label>Versão de código<select value={version} onChange={event => setVersion(event.target.value)}>{project.versions.map(item => <option key={item.id} value={item.id}>{item.requested_ref} · {shortId(item.commit_sha)} · {date(item.resolved_at)}</option>)}</select></label>
        {code && <div className="commit-row"><span>Commit registrado</span><code>{code.commit_sha}</code></div>}
        <p className="muted">Marque os documentos que serão enviados à análise. O texto complementar também será incluído.</p>
        {!project.documents.length && <p>Nenhum documento adicionado.</p>}
        {project.documents.map(doc => <label className="checkbox-label" key={doc.id}><input type="checkbox" checked={documents.includes(doc.id)} onChange={event => setDocuments(event.target.checked ? [...documents,doc.id] : documents.filter(id => id!==doc.id))}/><span>{doc.name} · v{doc.version} · {doc.page_count} páginas</span><button type="button" className="text-button" disabled={busy} onClick={() => action(async () => setDocument(await research.get(`/projects/${projectId}/documents/${doc.id}`)))}>Consultar extração</button></label>)}
        {project.complementary_text && <details><summary>Texto complementar incluído</summary><p className="preserve-text">{project.complementary_text}</p></details>}
        <label className="checkbox-label"><input type="checkbox" checked={requirementsAgent} disabled={busy} onChange={event=>setRequirementsAgent(event.target.checked)}/>Análise de requisitos com ferramentas</label>
        <label className="checkbox-label"><input type="checkbox" checked={testsAgent} disabled={busy} onChange={event=>setTestsAgent(event.target.checked)}/>Geração de casos com ferramentas</label>
        <label className="checkbox-label"><input type="checkbox" checked={evaluationAgent} disabled={busy} onChange={event=>setEvaluationAgent(event.target.checked)}/>Avaliação de evidências com ferramentas</label>
        <label>Geração de scripts<select value={automationMode} disabled={busy} onChange={event=>setAutomationMode(event.target.value)}><option value="fixed/v1">Fluxo com etapas predefinidas</option><option value="agent/v1">Agente com ferramentas</option></select></label>
        <p className="muted">No modo agente, a IA escolhe quais fontes consultar para elaborar os scripts. A escolha fica registrada nesta análise; os artefatos exigem revisão.</p>
        <Button disabled={busy || !version || (!documents.length && !project.complementary_text)} onClick={() => action(async () => {const run=await research.post(`/projects/${projectId}/runs`,{code_version_id:version,document_ids:documents,agent_policy:{modes:{requirements:requirementsAgent?'agent/v1':'fixed/v1',tests:testsAgent?'agent/v1':'fixed/v1',evaluation:evaluationAgent?'agent/v1':'fixed/v1',automation:automationMode}}});navigate(`/admin/runs/${run.id}`);})}>{busy ? 'Processando solicitação...' : 'Iniciar análise de requisitos →'}</Button>
        <small className="muted">Os resultados do primeiro agente deverão ser revisados antes da geração de casos.</small>
      </div>
    </Card>
    <div className="two-columns"><Card><div className="section-heading"><div><h2>Documentos de requisitos</h2><p>PDF com texto, TXT ou MD em UTF-8.</p></div></div><form className="research-form" onSubmit={event => {event.preventDefault();if(file) action(async () => {await research.upload(projectId,file);setFile(null);reload();});}}><label>Selecionar documento<input key={project.documents.length} type="file" accept=".pdf,.txt,.md" required onChange={event => setFile(event.target.files[0])}/><small>Até 10 MiB e 200 páginas por PDF. Mesmo nome cria uma nova versão.</small></label><Button type="submit" disabled={busy || !file}>Adicionar documento</Button></form><p className="muted mt-4">Diagramas e documentos digitalizados exigem conferência e transcrição. OCR indisponível.</p></Card>
      <Card><div className="section-heading"><div><h2>Viabilidade técnica</h2><p>Inspeção de módulos e fontes no commit selecionado.</p></div></div><p className="muted">{code?.inspection.reason}</p><Button variant="secondary" className="mt-4" disabled={busy || !code} onClick={() => action(async () => {await research.post(`/projects/${projectId}/versions/${version}/inspect`);reload();})}>Inspecionar stack</Button>{code && <ResearchInspectionView inspection={code.inspection} repositoryUrl={code.repository_url} commitSha={code.commit_sha}/>}<p className="notice compact">Execução exige scripts aprovados, autorização explícita e executor dedicado validado. Consulte a disponibilidade na aba Execução.</p>{project.technical_notes && <details><summary>Informações técnicas do pesquisador</summary><p className="preserve-text">{project.technical_notes}</p></details>}</Card></div>
    {document && <Card><div className="section-heading"><h2>{document.name} · v{document.version}</h2><button className="text-button" onClick={() => setDocument(null)}>Fechar extração</button></div>{document.warnings.map((warning,index) => <p className="notice compact" key={index}>{warning}</p>)}<Button variant="secondary" disabled={busy} onClick={() => action(() => research.download(`/projects/${projectId}/documents/${document.id}/download`,document.name))}>Baixar original</Button><div className="document-pages">{document.pages.map(page => <details key={page.page}><summary>Página {page.page}</summary><p className="preserve-text">{page.text || 'Sem texto extraído.'}</p></details>)}</div></Card>}
    <Card><div className="section-heading"><h2>Histórico do projeto</h2><span>{project.runs.length} execuções</span></div>{project.runs.length ? <div className="table-scroll"><table><thead><tr><th>Execução</th><th>Estado</th><th>Modelo</th><th>Início</th></tr></thead><tbody>{project.runs.map(run => <tr key={run.id}><td><Link to={`/admin/runs/${run.id}`}>{shortId(run.id)} →</Link></td><td><ResearchStatus status={run.status}/></td><td>{run.model}</td><td>{date(run.created_at)}</td></tr>)}</tbody></table></div> : <p className="muted">Nenhuma execução iniciada.</p>}</Card>
  </div>;
}
