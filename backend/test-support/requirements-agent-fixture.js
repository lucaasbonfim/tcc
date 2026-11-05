import {fixtureTurn} from './agent-scenario.js';
export function requirementsFixtureTurn({contents}) {
  const results=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  const catalog=results.filter(r=>r.name==='list_document_sources').flatMap(r=>r.response.sources);
  if(!catalog.length)return fixtureTurn([{id:'list',name:'list_document_sources',args:{offset:0,limit:50}}]);
  const read=results.filter(r=>r.name==='read_document_sources').flatMap(r=>r.response.sources || []),seen=new Set(read.map(s=>s.source_id));
  const missing=catalog.filter(s=>!seen.has(s.source_id));
  if(missing.length)return fixtureTurn([{id:'read-'+read.length,name:'read_document_sources',args:{source_ids:missing.slice(0,20).map(s=>s.source_id)}}]);
  const requirement={code:'RF-001',title:'Somar',description:'O sistema deve somar dois números.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{source_id:read[0].source_id}]};
  return fixtureTurn([{id:'submit',name:'submit_requirements',args:{output:{requirements:[requirement],alerts:[]}}}]);
}
