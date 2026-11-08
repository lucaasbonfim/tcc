import {Link} from 'react-router-dom';
import {useResearch} from '../hooks/useResearch';
import {date} from '../utils/research';
import ResearchStatus from '../components/ResearchStatus';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import Card from '../components/Card';

export default function ResearchDashboardPage() {
  const summary=useResearch('/summary'),runs=useResearch('/runs'),projects=useResearch('/projects');
  const list=runs.data || [],active=list.filter(r=>['pending','running','awaiting_review'].includes(r.status));
  return <div className="page-stack">
    <div className="page-heading"><div><h1>Início</h1><p>Escolha um projeto para analisar requisitos e gerar testes.</p></div><Link className="action-link" to="/admin/projects">Preparar análise</Link></div>
    <ErrorMessage>{runs.error || projects.error || summary.error}</ErrorMessage>
    <Card><div className="section-heading"><h2>Seu próximo passo</h2></div>
      {runs.loading && !runs.data?<Loading>Carregando análises…</Loading>:active.length?<div className="action-list">{active.map(run=><div className="action-row" key={run.id}><div><Link to={`/admin/runs/${run.id}`}>{run.project_name}</Link><p>{run.status==='awaiting_review'?'Confira os itens que aguardam sua decisão.':'Os agentes estão processando esta análise.'}</p></div><ResearchStatus status={run.status}/><Link className="secondary-link" to={`/admin/runs/${run.id}`}>{run.status==='awaiting_review'?'Revisar':'Acompanhar'}</Link></div>)}</div>:<div className="getting-started"><h3>{projects.data?.length?'Tudo pronto para uma nova análise.':'Comece pelo seu projeto.'}</h3><p>{projects.data?.length?'Abra um projeto, selecione os documentos e inicie a análise.':'Cadastre o repositório do GitHub e adicione os documentos de requisitos.'}</p><Link to={projects.data?.length?'/admin/projects':'/admin/projects/new'}>{projects.data?.length?'Escolher projeto':'Cadastrar primeiro projeto'}</Link></div>}
    </Card>
    {!!projects.data?.length && <section><div className="section-heading"><h2>Projetos disponíveis</h2><Link to="/admin/projects/new">Cadastrar projeto</Link></div><div className="project-shortlist">{projects.data.slice(0,4).map(p=><Link key={p.id} to={`/admin/projects/${p.id}`}><strong>{p.name}</strong><span>{p.repository_url.replace('https://github.com/','')}</span><span>Abrir projeto →</span></Link>)}</div></section>}
    <Card><div className="section-heading"><h2>Análises recentes</h2><Link to="/admin/runs">Ver todas</Link></div>{!list.length?<p className="muted">As análises aparecerão aqui quando você iniciar o primeiro projeto.</p>:<div className="table-scroll"><table><thead><tr><th>Projeto</th><th>Estado</th><th>Início</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{list.slice(0,6).map(run=><tr key={run.id}><td><Link to={`/admin/runs/${run.id}`}>{run.project_name}</Link></td><td><ResearchStatus status={run.status}/></td><td>{date(run.created_at)}</td><td><Link to={`/admin/runs/${run.id}`}>Abrir análise</Link></td></tr>)}</tbody></table></div>}</Card>
    <details className="secondary-section"><summary>Indicadores e relatórios da pesquisa</summary><p>{summary.data?.projects ?? '—'} projetos · {summary.data?.runs ?? '—'} análises · {summary.data?.awaiting_review ?? '—'} aguardando revisão</p><Link to="/admin/reports">Exportar registros por análise</Link></details>
  </div>;
}
