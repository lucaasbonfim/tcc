import { useEffect, useState } from 'react';
import Button from './Button';
import ResearchStatus from './ResearchStatus';

const labels = {
  title:'Título',description:'Descrição',objective:'Objetivo',actors:'Atores',use_cases:'Casos de uso',preconditions:'Pré-condições',
  postconditions:'Pós-condições',main_flow:'Fluxo principal',alternative_flows:'Fluxos alternativos',exception_flows:'Fluxos de exceção',
  acceptance_criteria:'Critérios de aceitação',uncertainties:'Incertezas',requirement_codes:'Códigos dos requisitos relacionados',
  input_data:'Dados de entrada',steps:'Passos de execução',expected_result:'Resultado esperado',
};
const kinds = {functional:'Funcional',business_rule:'Regra de negócio',non_functional:'Não funcional',positive:'Positivo',negative:'Negativo',alternative:'Alternativo',boundary:'Limite'};

export default function ResearchReviewItem({row,kind,documents,editable,busy,onReview,onDraftChange}) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState(row.content);
  const [justification,setJustification] = useState('');
  const content = row.content;
  useEffect(()=>{onDraftChange(row.id,JSON.stringify(draft)!==JSON.stringify(row.content));return()=>onDraftChange(row.id,false);},[draft,row.content,row.id,onDraftChange]);
  function update(key,value) {setDraft({...draft,[key]:value});}
  function updateSource(index,key,value) {setDraft({...draft,sources:draft.sources.map((source,i) => i===index ? {...source,[key]:value} : source)});}
  return <article className="review-item" id={row.code}><div className="section-heading"><div><span className="item-code">{row.code}</span><h3>{content.title}</h3></div><ResearchStatus status={row.review_status}/></div>
    <p>{content.description || content.objective}</p><div className="item-tags"><span>{kinds[content.kind || content.scenario]}</span>{content.requirement_codes?.map(code => <span key={code}>{code}</span>)}{row.artifact_type && <span>Artefato textual</span>}</div>
    {content.uncertainties?.length>0 && <div className="notice compact"><strong>Incertezas identificadas</strong><ul>{content.uncertainties.map((item,index) => <li key={index}>{item}</li>)}</ul></div>}
    <details><summary>Detalhes e rastreabilidade</summary><dl className="item-details">{Object.entries(labels).filter(([key]) => !['title','description','objective','uncertainties'].includes(key) && content[key] !== undefined).map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{Array.isArray(content[key]) ? content[key].length ? <ol>{content[key].map((item,index) => <li key={index}>{item}</li>)}</ol> : 'Não informado na fonte.' : content[key]}</dd></div>)}</dl>
      {content.sources?.map((source,index) => <blockquote key={index}><strong>{documents.find(doc => doc.id===source.document_id)?.name || source.document_id} · página {source.page}</strong><p>“{source.quote}”</p></blockquote>)}
      {content.automation && <p className="notice compact"><strong>{content.automation.feasibility==='manual_only' ? 'Execução manual' : 'Automação exige inspeção técnica'}</strong><br/>{content.automation.rationale}</p>}
    </details>
    {editable && <div className="review-controls"><div className="inline-actions"><button className="text-button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Fechar edição' : 'Corrigir conteúdo'}</button><button className="text-button" disabled={busy || row.review_status==='rejected'} onClick={()=>onReview('rejected',row.content,'Item excluído pelo pesquisador antes da aprovação da etapa.')}>Rejeitar item</button></div>
      {editing && <div className="research-form edit-fields"><p className="muted">Salve a correção e depois use a aprovação de todos no início da lista. A saída original do agente será preservada.</p>{Object.entries(labels).filter(([key]) => Object.hasOwn(draft,key)).map(([key,label]) => <label key={key}>{label}<textarea rows={Array.isArray(draft[key]) ? 3 : 2} maxLength={10000} value={Array.isArray(draft[key]) ? draft[key].join('\n') : draft[key]} onChange={event => update(key,Array.isArray(draft[key]) ? event.target.value.split('\n') : event.target.value)}/>{Array.isArray(draft[key]) && <small>Um item por linha. Linhas vazias serão removidas ao salvar.</small>}</label>)}
        {kind==='requirements' && <><label>Tipo de requisito<select value={draft.kind} onChange={event => update('kind',event.target.value)}>{['functional','business_rule','non_functional'].map(value => <option key={value} value={value}>{kinds[value]}</option>)}</select></label><h4>Fontes (trechos literais das páginas)</h4>{draft.sources.map((source,index) => <div className="source-editor" key={index}><label>Documento<select value={source.document_id} onChange={event => updateSource(index,'document_id',event.target.value)}>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select></label><label>Página<input type="number" min={1} max={200} value={source.page} onChange={event => updateSource(index,'page',Number(event.target.value))}/></label><label>Trecho de origem<textarea value={source.quote} onChange={event => updateSource(index,'quote',event.target.value)}/></label></div>)}</>}
        {kind==='tests' && <><label>Tipo de cenário<select value={draft.scenario} onChange={event => update('scenario',event.target.value)}>{['positive','negative','alternative','boundary'].map(value => <option key={value} value={value}>{kinds[value]}</option>)}</select></label><label>Viabilidade de automação<select value={draft.automation.feasibility} onChange={event => update('automation',{...draft.automation,feasibility:event.target.value})}><option value="manual_only">Somente manual</option><option value="needs_inspection">Exige inspeção técnica</option></select></label><label>Justificativa técnica<textarea value={draft.automation.rationale} onChange={event => update('automation',{...draft.automation,rationale:event.target.value})}/></label></>}
        <label>Observação da correção (opcional)<textarea rows={2} maxLength={5000} value={justification} onChange={event=>setJustification(event.target.value)}/></label>
        <div className="inline-actions"><Button disabled={busy} onClick={()=>onReview('edited',draft,justification.trim() || 'Conteúdo corrigido pelo pesquisador antes da aprovação da etapa.')}>Salvar correção</Button><Button variant="secondary" disabled={busy} onClick={()=>{setDraft(row.content);setEditing(false);}}>Descartar alterações</Button></div>
      </div>}
    </div>}
  </article>;
}
