import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { research } from '../services/research.service';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const empty = {name:'',description:'',repository_url:'',requested_ref:'',technical_notes:'',complementary_text:''};
export default function ResearchProjectFormPage() {
  const {projectId} = useParams();
  const navigate = useNavigate();
  const [form,setForm] = useState(empty);
  const [loading,setLoading] = useState(Boolean(projectId));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    research.get(`/projects/${projectId}`,{signal:controller.signal}).then(project => {if (!controller.signal.aborted) setForm(Object.fromEntries(Object.keys(empty).map(key => [key,project[key]])));})
      .catch(cause => {if (!controller.signal.aborted) setError(cause.message);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  },[projectId]);
  const field = key => ({value:form[key],onChange:event => setForm({...form,[key]:event.target.value})});
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const project = projectId ? await research.put(`/projects/${projectId}`,form) : await research.post('/projects',form); navigate(`/admin/projects/${project.id}`); }
    catch(cause) {setError(cause.message);} finally {setBusy(false);}
  }
  return <div className="page-stack form-page"><div className="page-heading"><div><Link className="back-link" to={projectId ? `/admin/projects/${projectId}` : '/admin/projects'}>← Projetos</Link><h1>{projectId ? 'Editar projeto' : 'Cadastrar projeto'}</h1><p>Adicione o repositório. Os documentos podem ser enviados na próxima etapa.</p></div></div>
    <ErrorMessage>{error}</ErrorMessage>{loading ? <Loading>Carregando projeto...</Loading> : <Card><form className="research-form" onSubmit={submit}><fieldset disabled={busy}>
      <div className="form-grid"><label>Nome do projeto<input required maxLength={180} {...field('name')} autoComplete="off"/></label><label>Repositório público do GitHub<input type="url" required placeholder="https://github.com/autor/projeto" maxLength={300} {...field('repository_url')}/></label></div>
      <label>Descrição (opcional)<textarea rows={3} maxLength={10000} {...field('description')}/></label>
      <details className="secondary-section"><summary>Versão do código e informações adicionais</summary><div className="research-form">
      <label>Branch, tag ou commit<input maxLength={255} placeholder="Vazio: branch padrão do repositório" {...field('requested_ref')}/><small>Uma alteração salva cria um novo registro de versão. Execuções anteriores preservam seu SHA.</small></label>
      <label>Informações técnicas do ambiente<textarea rows={3} maxLength={10000} placeholder="Stack, serviços externos e configurações necessárias. Não inclua senhas ou tokens." {...field('technical_notes')}/></label>
      <label>Requisitos complementares em texto<textarea rows={6} maxLength={50000} {...field('complementary_text')}/><small>O texto será preservado no snapshot de cada nova execução. PDFs podem ser adicionados após salvar.</small></label>
      </div></details>
      <p className="muted">Usaremos a branch padrão quando nenhuma versão específica for informada.</p>
      <div className="inline-actions"><Button type="submit" disabled={busy}>{busy ? 'Salvando projeto…' : 'Salvar projeto'}</Button><Link to={projectId?`/admin/projects/${projectId}`:'/admin/projects'}>Cancelar</Link></div>
    </fieldset></form></Card>}
  </div>;
}
