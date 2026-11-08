import {Link, useSearchParams} from 'react-router-dom';

import {RUN_VIEWS} from '../utils/run-views';

export default function ResearchRunNavigation({view,run}) {
  const [params,setParams]=useSearchParams();
  const count=view==='requirements'?run.requirements.filter(row=>row.review_status==='pending').length:view==='tests'?run.test_cases.filter(row=>row.review_status==='pending').length:0;
  function destination(value) {const next=new URLSearchParams(params);next.set('view',value);return `?${next}`;}
  return <div className="run-navigation">
    <div className="mobile-view-picker"><label htmlFor="run-view-picker">Etapa da análise</label>
      <select id="run-view-picker" value={view} onChange={event=>setParams(destination(event.target.value).slice(1))}>
        {RUN_VIEWS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <nav className="result-tabs" aria-label="Resultados da execução">
      {RUN_VIEWS.slice(0,6).map(([value,label])=><Link key={value} to={destination(value)} aria-current={view===value?'page':undefined} className={view===value?'selected':''}>{label}</Link>)}
    </nav>
    <nav className="run-secondary-nav" aria-label="Histórico da análise">
      {RUN_VIEWS.slice(6).map(([value,label])=><Link key={value} to={destination(value)} aria-current={view===value?'page':undefined}>{label}</Link>)}
    </nav>
    {count>0 && <p className="review-count" role="status">{count} {count===1?'item aguarda':'itens aguardam'} sua revisão nesta etapa.</p>}
  </div>;
}
