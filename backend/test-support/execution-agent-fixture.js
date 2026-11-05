import {fixtureTurn} from './agent-scenario.js';
export function executionPlanningFixtureTurn({contents}) {
  const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  if(!responses.some(r=>r.name==='get_execution_capabilities'))return fixtureTurn([{id:'caps',name:'get_execution_capabilities',args:{}},{id:'list-0',name:'list_execution_scripts',args:{offset:0,limit:10}}]);
  const pages=responses.filter(r=>r.name==='list_execution_scripts').map(r=>r.response);
  if(pages.at(-1).next_offset!==null)return fixtureTurn([{id:'list-'+pages.length,name:'list_execution_scripts',args:{offset:pages.at(-1).next_offset,limit:10}}]);
  const scripts=pages.flatMap(p=>p.scripts);
  for(const script of scripts){const chunks=responses.filter(r=>r.name==='read_execution_script' && r.response.script_id===script.id).map(r=>r.response).sort((a,b)=>a.offset-b.offset);let end=0;for(const chunk of chunks)if(chunk.offset===end)end=chunk.end;
    if(end<script.characters)return fixtureTurn([{id:'read-'+script.id+'-'+end,name:'read_execution_script',args:{script_id:script.id,offset:end,length:10000}}]);}
  const groups=scripts.slice().reverse().map(s=>({script_ids:[s.id],rationale:'Ordem/agrupamento controlado da fixture.'}));
  if(!responses.some(r=>r.name==='validate_execution_groups' && r.response.valid))return fixtureTurn([{id:'validate',name:'validate_execution_groups',args:{groups}}]);
  return fixtureTurn([{id:'submit',name:'submit_execution_plan',args:{output:{groups,rationale:'Plano sintético para verificar decisões, validação e autorização separadas.',limitations:['Fixture programada; não é avaliação de qualidade de um LLM.']}}}]);
}
export function executionDiagnosisFixtureTurn({contents}) {
  const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse),pages=responses.filter(r=>r.name==='list_execution_results').map(r=>r.response);
  if(!pages.length || pages.at(-1).next_offset!==null)return fixtureTurn([{id:'list-'+pages.length,name:'list_execution_results',args:{offset:pages.at(-1)?.next_offset || 0,limit:10}}]);
  const contexts=[];
  for(const result of pages.flatMap(p=>p.results)){const chunks=responses.filter(r=>r.name==='read_execution_evidence'&&r.response.result_id===result.id).map(r=>r.response).sort((a,b)=>a.offset-b.offset);let end=0,text='';for(const chunk of chunks)if(chunk.offset===end){end=chunk.end;text+=chunk.text;}
    if(end<result.characters)return fixtureTurn([{id:'read-'+result.id+'-'+end,name:'read_execution_evidence',args:{result_id:result.id,offset:end,length:10000}}]);contexts.push(JSON.parse(text));}
  return fixtureTurn([{id:'diagnosis',name:'submit_execution_diagnostics',args:{output:{diagnostics:contexts.map(({result,script,test_case})=>({result_id:result.id,script_id:script.id,script_version:script.version,kind:result.omitted_characters>0?'inconclusive':result.status==='passed'?'compatible':result.status==='failed'?'assertion_failure':['test_error','compilation_error'].includes(result.status)?'test_issue':'inconclusive',action:result.omitted_characters>0?'inconclusive':result.status==='passed'?'no_change':['failed','test_error','compilation_error'].includes(result.status)?'review_script':'inconclusive',expected_behavior:test_case.content.expected_result,observed_behavior:result.observed_excerpt,evidence_quote:result.observed_excerpt,rationale:'Controle de diagnóstico da fixture; não é inferência científica.',limitations:['Resposta programada.']})),summary:'Diagnóstico técnico sintético.',limitations:['Fixture, sem julgamento independente.']}}}]);
}
export function executionAgentFixtureTurn(request) {return request.tools.some(t=>t.name==='submit_execution_diagnostics')?executionDiagnosisFixtureTurn(request):executionPlanningFixtureTurn(request);}
