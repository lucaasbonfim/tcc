import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutSession } from '../services/auth.service';
import ErrorMessage from './ErrorMessage';

const links = [
  ['Início','/admin'],['Projetos','/admin/projects'],['Análises','/admin/runs'],
];
export default function ResearchLayout() {
  const navigate = useNavigate();
  const [error,setError] = useState('');
  async function logout() {
    try { await logoutSession(); navigate('/admin/login',{replace:true}); } catch(cause) { setError(cause.message); }
  }
  return <div className="research-shell">
    <aside className="research-sidebar">
      <NavLink to="/admin" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>Requisita<span className="brand-subtitle">Requisitos e testes</span></span></NavLink>
      <nav aria-label="Navegação principal">{links.map(([label,to]) => <NavLink key={to} to={to} end={to==='/admin'} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}</nav>
      <button className="logout-button" onClick={logout}>Sair da sessão <span aria-hidden="true">↗</span></button>
    </aside>
    <div className="research-body"><header className="research-topbar"><span>Análise de requisitos e testes</span><span>Área do pesquisador</span></header>
      <main className="research-main"><ErrorMessage>{error}</ErrorMessage><Outlet /></main>
      <footer className="research-footer">Requisita <span>Fontes, decisões e evidências preservadas por análise.</span></footer>
    </div>
  </div>;
}
