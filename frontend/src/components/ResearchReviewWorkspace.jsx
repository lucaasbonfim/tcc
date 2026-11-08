import {Link, useSearchParams} from 'react-router-dom';
import ResearchReviewItem from './ResearchReviewItem';
import ResearchStatus from './ResearchStatus';

export default function ResearchReviewWorkspace({items,kind,documents,requirements,editable,busy,onDraftChange,onReview}) {
  const [params]=useSearchParams();
  const selected=items.find(row=>row.id===params.get('item')) || items[0];
  if(!selected)return null;
  const related=kind==='tests'?requirements.filter(row=>selected.content.requirement_codes?.includes(row.code)):[];
  const sources=kind==='requirements'?selected.content.sources || []:related.flatMap(row=>row.content.sources || []);
  function destination(id) {const next=new URLSearchParams(params);next.set('item',id);return `?${next}`;}
  return <div className="review-workspace">
    <nav className="review-item-list" aria-label={kind==='requirements'?'Selecionar requisito':'Selecionar caso de teste'}>
      {items.map(row=><Link key={row.id} to={destination(row.id)} aria-current={row.id===selected.id?'true':undefined}>
        <span className="item-code" translate="no">{row.code}</span><strong>{row.content.title}</strong><ResearchStatus status={row.review_status} context="review"/>
      </Link>)}
    </nav>
    <div className="review-selected">
      <ResearchReviewItem key={`${selected.id}-${selected.revision}`} row={selected} kind={kind} documents={documents} editable={editable} busy={busy} onDraftChange={onDraftChange} onReview={(...args)=>onReview(selected,...args)}/>
    </div>
    <aside className="review-source-panel" aria-label="Fontes do item selecionado">
      <h3>{kind==='tests'?'Requisitos e fontes vinculadas':'Fonte do requisito'}</h3>
      {related.map(row=><div className="related-requirement" key={row.id}><Link to={`?view=requirements&item=${encodeURIComponent(row.id)}`}>{row.code}: {row.content.title}</Link><p>{row.content.description}</p></div>)}
      {sources.length?sources.map((source,index)=>{
        const document=documents.find(doc=>doc.id===source.document_id);
        const page=document?.pages?.find(page=>page.page===source.page);
        return <div className="source-citation" key={`${source.document_id}-${source.page}-${index}`}>
          <p className="source-location">{document?.name || source.document_id}<span>Página {source.page}{document?.version?` / versão ${document.version}`:''}</span></p>
          <blockquote>{source.quote}</blockquote>
          {page?.text && <details><summary>Ler contexto da página</summary><p className="preserve-text">{page.text}</p></details>}
        </div>;
      }):<p className="muted">Nenhuma citação documental vinculada a este item. Confira os requisitos e as entradas da análise antes de aprovar.</p>}
      <p className="muted">Citações preservadas na análise. Confira se o trecho sustenta o conteúdo proposto.</p>
    </aside>
  </div>;
}
