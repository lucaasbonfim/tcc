import {fixtureTurn} from './agent-scenario.js';
import {testCasesFixtureTurn} from './tests-agent-fixture.js';
export function collaborationFixtureTurn(request) {
  const responses=request.contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  if(request.tools.some(t=>t.name==='respond_clarification')) {
    const task=JSON.parse(request.contents[0].parts[0].text).untrusted_task;
    const read=responses.filter(r=>r.name==='read_clarification_sources').flatMap(r=>r.response.sources || []);
    const missing=task.source_catalog.filter(s=>!read.some(r=>r.source_id===s.source_id));
    if(missing.length)return fixtureTurn([{id:'sources-'+read.length,name:'read_clarification_sources',args:{source_ids:missing.slice(0,20).map(s=>s.source_id)}}]);
    return fixtureTurn([{id:'reply',name:'respond_clarification',args:{output:{status:'ambiguous',answer:'As fontes não especificam o tratamento de entradas inválidas. Não inventar esperado para esse caso.',source_ids:[read[0].source_id]}}}]);
  }
  const next=testCasesFixtureTurn(request),terminal=next.calls.find(c=>c.name==='submit_test_cases');
  if(!terminal)return next;
  const clarification=responses.find(r=>r.name==='request_requirement_clarification');
  if(!clarification)return fixtureTurn([{id:'clarify',name:'request_requirement_clarification',args:{requirement_code:terminal.args.output.test_cases[0].requirement_codes[0],question:'As fontes especificam o tratamento de entradas inválidas?'}}]);
  const output=terminal.args.output;output.warnings=[clarification.response.answer];return fixtureTurn([{id:'submit',name:'submit_test_cases',args:{output}}]);
}
