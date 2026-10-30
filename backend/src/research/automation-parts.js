import {assert} from './errors.js';

export function planAutomationParts(input,{maxCases=2,budget=16000}={}) {
  const make=cases=>{
    const ids=new Set(cases.map(row=>row.id)),codes=new Set(cases.flatMap(row=>row.content.requirement_codes));
    const requirements=input.requirements.filter(row=>codes.has(row.code));
    assert([...codes].every(code=>requirements.some(row=>row.code===code)),'Caso sem requisito aprovado no contexto de automação.',422);
    return {scope:input.scope,test_cases:cases,requirements,generated_paths:input.generated_paths.filter(row=>ids.has(row.test_case_id))};
  };
  const variableSize=value=>JSON.stringify({test_cases:value.test_cases,requirements:value.requirements}).length;
  const parts=[];let current=[];
  for(const row of input.test_cases) {
    const candidate=make([...current,row]);
    if(current.length && (current.length>=maxCases || variableSize(candidate)>budget || JSON.stringify(candidate).length>170000)){parts.push(make(current));current=[];}
    const single=make([row]);
    assert(JSON.stringify(single).length<=170000,`Caso ${row.content.code || row.id} excede o contexto individual da automação. Reduza o escopo técnico sem truncamento.`,422);
    current.push(row);
  }
  if(current.length)parts.push(make(current));
  assert(parts.length>0 && input.test_cases.length<=6000,'Selecione casos aprovados dentro do limite da análise.',422);
  return parts.map((part,index)=>({...part,batch:{sequence:index+1,total:parts.length,case_ids:part.test_cases.map(row=>row.id)}}));
}

export function automationCoverage(caseIds,parts,scripts=[]) {
  const completed=parts.flatMap(part=>part.dispositions);
  const generated=new Set([...scripts.map(row=>row.test_case_id),...completed.filter(row=>row.status==='generated').map(row=>row.test_case_id)]);
  const unsupported=completed.filter(row=>row.status==='unsupported');
  const addressed=new Set([...generated,...unsupported.map(row=>row.test_case_id)]);
  return {selected:caseIds.length,generated:caseIds.filter(id=>generated.has(id)).length,
    unsupported:unsupported.filter(row=>caseIds.includes(row.test_case_id)),
    missing:caseIds.filter(id=>!addressed.has(id))};
}
