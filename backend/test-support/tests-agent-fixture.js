import {fixtureTurn} from './agent-scenario.js';
export function testCasesFixtureTurn({contents}) {
  const results=contents.flatMap(c=>c.parts).filter(p=>p.functionResponse).map(p=>p.functionResponse);
  const catalog=results.find(r=>r.name==='list_test_requirements')?.response.requirements;
  if(!catalog)return fixtureTurn([{id:'list',name:'list_test_requirements',args:{}}]);
  const requirements=[];
  for(const entry of catalog) {
    const chunks=results.filter(r=>r.name==='read_test_requirement' && r.response.requirement_code===entry.code).map(r=>r.response).sort((a,b)=>a.offset-b.offset);
    let end=0,text='';for(const chunk of chunks)if(chunk.offset===end){text+=chunk.text;end=chunk.end;}
    if(end<entry.characters)return fixtureTurn([{id:`read-${entry.code}-${end}`,name:'read_test_requirement',args:{requirement_code:entry.code,offset:end,length:10000}}]);
    requirements.push(JSON.parse(text));
  }
  return fixtureTurn([{id:'submit',name:'submit_test_cases',args:{output:{test_cases:requirements.map((r,i)=>({code:`CT-${String(i+1).padStart(3,'0')}`,title:`Cenário para ${r.code}`,objective:'Controle técnico dos vínculos do requisito.',requirement_codes:[r.code],preconditions:[],input_data:[],steps:['Verificar o comportamento documentado.'],expected_result:r.acceptance_criteria[0] || r.description,scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Código ainda não inspecionado nesta etapa.'}})),warnings:[]}}}]);
}
