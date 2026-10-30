import { Link } from 'react-router-dom';
import { useResearch } from '../hooks/useResearch';
import { date, shortId } from '../utils/research';
import ResearchStatus from '../components/ResearchStatus';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import Card from '../components/Card';

export default function ResearchDashboardPage() {
  const projects = useResearch('/projects');
  const runs = useResearch('/runs');
  const list = runs.data || [];
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>Da especificação à evidência.</h1><p>Organize projetos e acompanhe as análises da pesquisa.</p></div><Link className="action-link" to="/admin/projects/new">+ Cadastrar projeto</Link></div>
    <ErrorMessage>{projects.error || runs.error}</ErrorMessage>
    <div className="metric-grid">{[['Projetos cadastrados',projects.data?.length ?? '—'],['Execuções registradas',runs.data ? list.length : '—'],['Aguardando revisão',runs.data ? list.filter(item => item.status==='awaiting_review').length : '—'],['Gerações concluídas',runs.data ? list.filter(item => item.status==='completed').length : '—']].map(([label,value]) => <Card key={label}><p className="metric-label">{label}</p><p className="metric-value">{value}</p></Card>)}</div>
    <div className="research-flow">{['Documentos e versão','Requisitos revisados','Casos rastreáveis','Evidências de execução'].map((label,index) => <div key={label}><span>{String(index+1).padStart(2,'0')}</span><strong>{label}</strong><small>{index===3 ? 'Executor ainda indisponível' : 'Preservado por execução'}</small></div>)}</div>
    <Card><div className="section-heading"><div><h2>Execuções recentes</h2><p>Estados e resultados reais dos processamentos.</p></div><Link to="/admin/runs">Ver histórico →</Link></div>
      {runs.loading && !runs.data ? <Loading>Carregando execuções...</Loading> : list.length ? <div className="table-scroll"><table><thead><tr><th>Projeto / execução</th><th>Estado</th><th>Modelo</th><th>Início</th></tr></thead><tbody>{list.slice(0,6).map(run => <tr key={run.id}><td><Link to={`/admin/runs/${run.id}`}>{run.project_name}</Link><small>{shortId(run.id)} · {shortId(run.commit_sha)}</small></td><td><ResearchStatus status={run.status}/></td><td>{run.model}</td><td>{date(run.created_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Sua pesquisa começa com um projeto.</strong><p>Cadastre o repositório e adicione os documentos de requisitos para iniciar a análise.</p><Link to="/admin/projects/new">Cadastrar primeiro projeto →</Link></div>}
    </Card>
    <div className="notice"><strong>Escopo desta versão</strong><p>Análise de requisitos e geração de casos textuais com revisão humana. Execução de código e avaliação de divergências aguardam um ambiente isolado validado e evidências independentes.</p></div>
  </div>;
}
