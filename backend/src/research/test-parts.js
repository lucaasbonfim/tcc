import {randomUUID} from 'node:crypto';
import {assert} from './errors.js';
import {AGENTS} from './agents.js';

export function testCoverage(requirements,cases) {
  const approved=requirements.filter(row=>row.review_status==='approved');
  const accepted=cases.filter(row=>row.review_status!=='rejected');
  const rows=approved.map(row=>({code:row.code,title:row.content.title,
    case_codes:accepted.filter(item=>item.content.requirement_codes.includes(row.code)).map(item=>item.code),
    approved_case_codes:accepted.filter(item=>item.review_status==='approved' && item.content.requirement_codes.includes(row.code)).map(item=>item.code)}));
  return {total:rows.length,linked:rows.filter(row=>row.case_codes.length).length,
    approved_linked:rows.filter(row=>row.approved_case_codes.length).length,
    missing:rows.filter(row=>!row.case_codes.length).map(row=>row.code),
    missing_approved:rows.filter(row=>!row.approved_case_codes.length).map(row=>row.code),rows,
    limitation:'Vínculos demonstram rastreabilidade declarada, não cobertura semântica, qualidade ou execução dos cenários.'};
}

export function assertTestCoverage(cases,requirements) {
  const linked=new Set(cases.flatMap(item=>item.requirement_codes));
  const missing=requirements.filter(item=>!linked.has(item.code)).map(item=>item.code);
  assert(!missing.length,`Resposta incompleta: ${missing.length} requisito(s) sem caso de teste: ${missing.slice(0,25).join(', ')}. O lote não foi aceito.`,422);
}

export function planTestParts(requirements,{maxRequirements=4,budget=10000}={}) {
  const parts=[];let current=[],size=0;
  for(const requirement of requirements) {
    const length=JSON.stringify(requirement).length;
    assert(length<=120000,`Requisito ${requirement.code} excede o contexto individual de testes. Revise o conteúdo sem truncamento.`,422);
    if(current.length && (current.length>=maxRequirements || size+length>budget)){parts.push(current);current=[];size=0;}
    current.push(requirement);size+=length;
  }
  if(current.length)parts.push(current);
  assert(parts.length<=2000,'Geração excede 2000 lotes de casos de teste.',422);
  return parts;
}

export async function createTestParts(db,run,store,{missingOnly=false}={}) {
  const requirements=(await db.query("SELECT code,content,review_status FROM research.requirements WHERE run_id=$1 AND review_status='approved' ORDER BY code",[run.id])).rows;
  const cases=(await db.query('SELECT code,content,review_status FROM research.test_cases WHERE run_id=$1 ORDER BY code',[run.id])).rows;
  const coverage=testCoverage(requirements,cases),selected=missingOnly ? requirements.filter(row=>coverage.missing.includes(row.code)) : requirements;
  assert(selected.length,'Todos os requisitos já possuem casos não rejeitados.',409);
  const snapshot=await store.json(run.snapshot),version=snapshot.code_version;
  const groups=planTestParts(selected.map(row=>row.content)),offset=(await db.query('SELECT COALESCE(max(sequence),0)::int AS n FROM research.test_parts WHERE run_id=$1',[run.id])).rows[0].n;
  assert(offset+groups.length<=2000,'Execução excede 2000 lotes de casos. Preserve o histórico e crie outra análise.',422);
  const definition=AGENTS.find(agent=>agent.agent==='tests');
  for(let i=0;i<groups.length;i++) {
    const requirement_codes=groups[i].map(item=>item.code),sequence=offset+i+1;
    const input=await store.put({project_name:snapshot.project.name,
      code_version:{repository_url:version.repository_url,commit_sha:version.commit_sha,requested_ref:version.requested_ref},
      requirements:groups[i],batch:{sequence,total:offset+groups.length,requirement_codes}});
    await db.query("INSERT INTO research.test_parts(id,run_id,sequence,status,input,requirement_codes) VALUES($1,$2,$3,'pending',$4,$5)",[randomUUID(),run.id,sequence,input,JSON.stringify(requirement_codes)]);
  }
  await db.query("UPDATE research.stages SET instruction=$2,instruction_version=$3,context=$4 WHERE run_id=$1 AND agent='tests'",[run.id,definition.instruction,definition.version,{coverage_mode:'all-requirements/v1'}]);
  return {parts:groups.length,requirements:selected.length,already_linked:coverage.linked};
}

export async function persistTestPart(db,runId,output) {
  const existing=(await db.query('SELECT code FROM research.test_cases WHERE run_id=$1',[runId])).rows;
  assert(existing.length+output.test_cases.length<=6000,'Geração excede 6000 casos de teste. Revise o escopo explicitamente.',422);
  const used=new Set(existing.map(row=>row.code)),mapping=[];let next=1;
  for(const candidate of output.test_cases) {
    while(used.has(`CT-${String(next).padStart(3,'0')}`))next++;
    const code=`CT-${String(next++).padStart(3,'0')}`,id=randomUUID(),content={...candidate,code};used.add(code);
    await db.query('INSERT INTO research.test_cases(id,run_id,code,content) VALUES($1,$2,$3,$4)',[id,runId,code,JSON.stringify(content)]);
    for(const requirement of content.requirement_codes)await db.query(`INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id)
      SELECT $1,$2,id FROM research.requirements WHERE run_id=$1 AND code=$3 AND review_status='approved'`,[runId,id,requirement]);
    mapping.push({local_code:candidate.code,code,test_case_id:id});
  }
  return mapping;
}
