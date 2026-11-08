import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResearch } from '../hooks/useResearch';
import { research } from '../services/research.service';
import { date, shortId } from '../utils/research';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ResearchStatus from '../components/ResearchStatus';

const views = {
  runs:['Análises','Acompanhe o trabalho, revise as saídas e consulte os resultados.','overview'],
  requirements:['Requisitos','Selecione uma execução para consultar fontes, lacunas e revisões.','requirements'],
  tests:['Casos de teste','Consulte os casos textuais e seus vínculos com requisitos aprovados.','tests'],
  analysis:['Análise de evidências','A avaliação depende de testes executados em ambiente isolado.','analysis'],
  reports:['Relatórios','Exporte os registros completos de cada execução para a avaliação acadêmica.','history'],
};
export default function ResearchRunsPage({view='runs'}) {
  const {data,error,loading} = useResearch('/runs');
  const [failure,setFailure] = useState('');
  const [busy,setBusy] = useState('');
  const [params,setParams] = useSearchParams();
  const filter=params.get('q') || '';
  const setFilter=value=>setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set('q',value);else next.delete('q');return next;},{replace:true});
  const filtered=(data || []).filter(run=>run.project_name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
  const [title,description,tab] = views[view];
  async function download(id,format) {
    setBusy(`${id}-${format}`);setFailure('');
    try {await research.download(`/runs/${id}/export/${format}`,`research-${id}.${format}`);} catch(cause){setFailure(cause.message);} finally{setBusy('');}
  }
  return <div className="page-stack"><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><Link className="action-link" to="/admin/projects">Preparar análise</Link></div><ErrorMessage>{error || failure}</ErrorMessage>
    {view==='analysis' && <div className="notice"><strong>Avaliação condicionada às evidências</strong><p>Abra uma execução para consultar sua análise e decisões humanas. Sem executor validado e evidências independentes, nenhum resultado é proposto como divergência funcional ou comportamento compatível.</p></div>}
    {view==='reports' && <div className="notice"><strong>Exportação por execução</strong><p>JSON preserva a estrutura completa. CSV contém linhas por entidade com vínculos e payload estruturado, incluindo scripts, trabalhos, resultados e revisões quando existentes. Consulte o estado de cada agente: conclusão textual não significa execução de testes.</p></div>}
    <Card><div className="section-heading"><h2>Histórico de análises</h2><label className="sr-only" htmlFor="run-search">Buscar projeto</label><input className="search-input" id="run-search" name="q" autoComplete="off" placeholder="Buscar por projeto…" value={filter} onChange={event => setFilter(event.target.value)}/></div>
      {loading && !data ? <Loading>Carregando histórico...</Loading> : !data?.length ? <div className="empty-state"><strong>Nenhuma execução registrada.</strong><p>Inicie a análise na página de um projeto.</p><Link to="/admin/projects">Ir para projetos</Link></div> : !filtered.length ? <div className="empty-state" role="status"><strong>Nenhuma análise encontrada.</strong><p>Tente outro nome de projeto ou remova a busca.</p><button className="secondary-link" onClick={()=>setFilter('')}>Limpar busca</button></div> : <div className="table-scroll"><table><thead><tr><th>Projeto / execução</th><th>Estado</th><th>Versão / modelo</th><th>Início</th><th>{view==='reports' ? 'Exportar' : 'Resultados'}</th></tr></thead><tbody>{filtered.map(run => <tr key={run.id}><td><Link to={`/admin/runs/${run.id}?view=${tab}`}>{run.project_name}</Link><small>{shortId(run.id)}</small></td><td><ResearchStatus status={run.status}/></td><td><code>{shortId(run.commit_sha)}</code><small>{run.model}</small></td><td>{date(run.created_at)}</td><td>{view==='reports' ? <div className="inline-actions">{['json','csv'].map(format => <button className="text-button" disabled={Boolean(busy)} key={format} onClick={() => download(run.id,format)}>{busy===`${run.id}-${format}` ? 'Exportando...' : format.toUpperCase()}</button>)}</div> : <Link to={`/admin/runs/${run.id}?view=${tab}`}>Consultar</Link>}</td></tr>)}</tbody></table></div>}
    </Card></div>;
}
