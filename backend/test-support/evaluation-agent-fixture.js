import {fixtureTurn} from './agent-scenario.js';
export function evaluationFixtureTurn({contents}) {
  const responses=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  const pages=responses.filter(r=>r.name==='list_evaluation_results').map(r=>r.response);
  if(!pages.length || pages.at(-1).next_offset!==null)return fixtureTurn([{id:'list-'+pages.length,name:'list_evaluation_results',args:{offset:pages.at(-1)?.next_offset || 0,limit:20}}]);
  const contexts=[];
  for(const result of pages.flatMap(p=>p.results)) {
    const chunks=responses.filter(r=>r.name==='read_evaluation_context' && r.response.result_id===result.id && r.response.section==='context').map(r=>r.response).sort((a,b)=>a.offset-b.offset);
    let end=0,text='';for(const chunk of chunks)if(chunk.offset===end){text+=chunk.text;end=chunk.end;}
    if(end<result.context_characters)return fixtureTurn([{id:'read-'+result.id+'-'+end,name:'read_evaluation_context',args:{result_id:result.id,section:'context',offset:end,length:10000}}]);
    contexts.push(JSON.parse(text));
  }
  const findings=contexts.flatMap(({result,test_case})=>test_case.content.requirement_codes.map(code=>({test_result_id:result.id,requirement_code:code,test_case_id:result.test_case_id,automated_test_id:result.automated_test_id,
    classification:result.omitted_characters>0?'inconclusive':result.status==='passed'?'compatible':result.status==='failed'?'possible_functional_divergence':'inconclusive',
    expected_behavior:test_case.content.expected_result,observed_behavior:result.observed_excerpt,evidence_quote:result.observed_excerpt,
    justification:'Controle de ferramentas e persistência com evidência sintética; não é avaliação científica.',limitations:['Fixture técnica, sem julgamento independente.']})));
  return fixtureTurn([{id:'submit',name:'submit_evaluation',args:{output:{findings,warnings:[]}}}]);
}
