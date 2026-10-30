import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutSession } from '../services/auth.service';
import ErrorMessage from './ErrorMessage';

const links = [
  ['Visão geral','/admin','01'],['Projetos','/admin/projects','02'],['Requisitos','/admin/requirements','03'],
  ['Casos de teste','/admin/test-cases','04'],['Execuções','/admin/runs','05'],['Análise','/admin/analysis','06'],['Relatórios','/admin/reports','07'],
];
export default function ResearchLayout() {
  const navigate = useNavigate();
  const [error,setError] = useState('');
  async function logout() {
    try { await logoutSession(); navigate('/admin/login',{replace:true}); } catch(cause) { setError(cause.message); }
  }
  return <div className="research-shell">
    <aside className="research-sidebar">
      <NavLink to="/admin" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>Requisita<span className="brand-subtitle">LABORATÓRIO MULTIAGENTE</span></span></NavLink>
      <p className="nav-caption">ÁREA DE PESQUISA</p>
      <nav aria-label="Navegação principal">{links.map(([label,to,number]) => <NavLink key={to} to={to} end={to==='/admin'} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><span aria-hidden="true">{number}</span>{label}</NavLink>)}</nav>
      <div className="sidebar-note"><span className="live-dot" /> Revisão humana obrigatória<p>Requisitos e testes com origem preservada em cada execução.</p></div>
      <button className="logout-button" onClick={logout}>Sair da sessão <span aria-hidden="true">↗</span></button>
    </aside>
    <div className="research-body"><header className="research-topbar"><span>Plataforma de análise de requisitos e testes</span><span className="researcher-chip">Pesquisador</span></header>
      <main className="research-main"><ErrorMessage>{error}</ErrorMessage><Outlet /></main>
      <footer className="research-footer">Pesquisa acadêmica · TCC <span>Resultados de IA sujeitos à validação humana</span></footer>
    </div>
  </div>;
}
