import {describeAgentFailure} from '../utils/agent-failure';
export default function SnapshotContent({data}) {
  if(!data)return <p>Sem conteúdo adicional.</p>;
  const failure=data.failure?describeAgentFailure(data.failure):null;
  return <>{failure && <div className="notice"><strong>{failure.title}</strong><p>{failure.description}</p><p>{failure.next}</p></div>}<p>{data.question || data.answer || data.summary || data.justification}</p>
    {data.status==='unavailable' && <p className="notice">A consulta não produziu resposta válida do agente.</p>}
    {data.artifacts?.map((row,index)=><article className="review-item" key={row.id || index}><h3>{row.code || row.content?.title || 'Artefato'}{row.content?.title && row.code?` · ${row.content.title}`:''}</h3><p>{row.content?.description || row.content?.objective || row.content?.justification}</p>{row.version!=null && <p>Versão {row.version} · revisão {row.revision}</p>}{row.content?.expected_result && <p>Esperado: {row.content.expected_result}</p>}{row.files_data?.map(file=><div key={file.path}><strong className="artifact-path">{file.path}</strong><pre className="code-panel">{file.code}</pre></div>)}<details><summary>Dados completos do artefato</summary><pre className="code-panel">{JSON.stringify(row,null,2)}</pre></details></article>)}
    {data.files?.map(file=><div key={file.path}><strong className="artifact-path">{file.path}</strong><pre className="code-panel">{file.code}</pre></div>)}
    {data.sources?.map((source,index)=><blockquote key={index}>{source.document_id} · p. {source.page}: {source.quote}</blockquote>)}
    {data.raw_only && <p className="notice">{data.limitation}</p>}
    <details><summary>Conteúdo preservado completo</summary><pre className="code-panel">{JSON.stringify(data,null,2)}</pre></details>
  </>;
}
