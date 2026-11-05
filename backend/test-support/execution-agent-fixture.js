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
