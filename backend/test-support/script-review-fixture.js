import {fixtureTurn} from './agent-scenario.js';
import {executionAgentFixtureTurn} from './execution-agent-fixture.js';
export function scriptReviewFixtureTurn(request) {
  const responses=request.contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  if(request.tools.some(t=>t.name==='respond_script_review')) {
    const chunks=responses.filter(r=>r.name==='read_script_review_context').map(r=>r.response).sort((a,b)=>a.offset-b.offset);let end=0,text='';for(const chunk of chunks)if(chunk.offset===end){end=chunk.end;text+=chunk.text;}
    if(!chunks.length || end<chunks.at(-1).total_characters)return fixtureTurn([{id:'context-'+end,name:'read_script_review_context',args:{offset:end,length:10000}}]);
    const context=JSON.parse(text);return fixtureTurn([{id:'reply',name:'respond_script_review',args:{output:{status:'proposed_revision',answer:'Rascunho de controle preserva asserção/esperado; não foi aplicado nem executado.',expected_result:context.test_case.content.expected_result,files:context.script.files_data.map(f=>({...f,code:f.code+'\n// Proposta técnica da fixture, sem alegação de corrigir defeito real.\n'}))}}}]);
  }
  const next=executionAgentFixtureTurn(request),submission=next.calls.find(c=>c.name==='submit_execution_diagnostics');if(!submission)return next;
  const row=submission.args.output.diagnostics.find(d=>d.kind==='assertion_failure'||d.kind==='test_issue');if(!row)return next;
  const reply=responses.find(r=>r.name==='request_script_review');
  if(!reply)return fixtureTurn([{id:'review',name:'request_script_review',args:{result_id:row.result_id,reason:'Investigar possível problema no script sem alterar o esperado.'}}]);
  row.rationale='Consulta ao A2: '+reply.response.answer;return fixtureTurn([{id:'diagnosis',name:'submit_execution_diagnostics',args:{output:submission.args.output}}]);
}
