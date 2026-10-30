import { Link } from 'react-router-dom';
import { useResearch } from '../hooks/useResearch';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ResearchStatus from '../components/ResearchStatus';
import { shortId } from '../utils/research';

export default function ResearchProjectsPage() {
  const {data,error,loading} = useResearch('/projects');
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">ACERVO DA PESQUISA</p><h1>Projetos</h1><p>Repositórios públicos, versões de código e documentos de requisitos.</p></div><Link className="action-link" to="/admin/projects/new">+ Cadastrar projeto</Link></div>
    <ErrorMessage>{error}</ErrorMessage>{loading && !data ? <Loading>Carregando projetos...</Loading> : !data?.length ? <Card><div className="empty-state"><strong>Nenhum projeto cadastrado.</strong><p>Adicione um projeto acadêmico existente para iniciar sua pesquisa.</p></div></Card> : <div className="project-grid">{data.map(project => <Card key={project.id}><div className="project-card-heading"><span className="project-initial">{project.name.charAt(0).toUpperCase()}</span><ResearchStatus status={project.latest_status}/></div><h2><Link to={`/admin/projects/${project.id}`}>{project.name}</Link></h2><p className="project-description">{project.description || 'Sem descrição complementar.'}</p><p className="repository-label">{project.repository_url.replace('https://github.com/','')}</p><div className="project-card-footer"><span><code>{shortId(project.commit_sha)}</code> · {project.run_count} execuções</span><Link to={`/admin/projects/${project.id}`}>Abrir →</Link></div></Card>)}</div>}
  </div>;
}
