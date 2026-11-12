import {assert} from '../../shared/errors.js';
import {validateShape} from '../../shared/validation.js';
import {evaluationRequestSchema,validateEvaluation} from './contracts.js';
import {createAgentToolRegistry} from '../../runtime/tool-registry.js';
import {nextUnreadOffset} from '../../runtime/record-reader.js';
import {EVALUATION_SECTIONS as sections} from './contracts.js';
import {EVALUATION_AGENT} from './definition.js';

export function createEvaluationAgentTools({input,definition=EVALUATION_AGENT,maxObservationChars=12000}) {
  const contexts=new Map(),texts=new Map(),ranges=new Map();
  assert(input.results.length>0,'A4 requer resultados do executor.',422);
  for(const result of input.results) {
    const test=input.test_cases.find(row=>row.id===result.test_case_id),script=input.automated_tests.find(row=>row.id===result.automated_test_id);
    const environment=input.environments.find(row=>row.evidence_id===result.evidence_id);
    assert(test && script && script.test_case_id===test.id && environment,'Contexto de execução incompleto ou sem vínculo.',422);
    const requirements=test.content.requirement_codes.map(code=>{const row=input.requirements.find(r=>r.code===code);assert(row,'Requisito aprovado ausente do contexto.',422);return row;});
    const context={result,requirements,original_sources:input.original_source_excerpts.filter(s=>test.content.requirement_codes.includes(s.requirement_code)),test_case:test,script,environment};
    contexts.set(result.id,context);texts.set(`${result.id}:context`,JSON.stringify(context));
    for(const section of sections)texts.set(`${result.id}:${section}`,JSON.stringify(context[section]));
  }
  const covered=key=>ranges.get(key)?.length===1 && ranges.get(key)[0][0]===0 && ranges.get(key)[0][1]===texts.get(key).length;
  const complete=id=>covered(`${id}:context`) || sections.every(s=>covered(`${id}:${s}`));
  function add(key,start,end){const merged=[];for(const span of [...(ranges.get(key) || []),[start,end]].sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last && span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push([...span]);}ranges.set(key,merged);}
  const declarations=structuredClone(definition.tools);
  declarations.find(t=>t.name==='submit_evaluation').parameters.properties.output=evaluationRequestSchema(input);
  const handlers={
    list_evaluation_results:async({offset,limit})=>({observation:{results:input.results.slice(offset,offset+limit).map(r=>({id:r.id,status:r.status,test_case_id:r.test_case_id,automated_test_id:r.automated_test_id,requirement_codes:contexts.get(r.id).test_case.content.requirement_codes,context_characters:texts.get(`${r.id}:context`).length,read_complete:Boolean(complete(r.id))})),total:input.results.length,next_offset:offset+limit<input.results.length?offset+limit:null}}),
    read_evaluation_context:async({result_id,section,offset,length})=>{
      const key=`${result_id}:${section}`,text=texts.get(key);assert(text!==undefined,'Resultado fora da tarefa de avaliação.',403);assert(offset<text.length,'Offset excede o contexto.',422);
      const make=end=>{const next_offset=nextUnreadOffset(ranges.get(key),text.length,[offset,end]);return {result_id,section,format:'json',offset,end,total_characters:text.length,truncated:end<text.length,next_offset,read_complete:next_offset===null,text:text.slice(offset,end)};};
      let low=offset+1,high=Math.min(offset+length,text.length),best=offset;
      while(low<=high){const middle=Math.floor((low+high)/2);if(JSON.stringify(make(middle)).length<=maxObservationChars){best=middle;low=middle+1;}else high=middle-1;}
      if(best<text.length && /[\uD800-\uDBFF]/.test(text[best-1]))best--;
      assert(best>offset,'Limite de observação não comporta o contexto.',422);add(key,offset,best);
      return {observation:make(best),state:{evaluation_ranges:Object.fromEntries(ranges)}};
    },
    submit_evaluation:async({output})=>{
      const pending=input.results.filter(r=>!complete(r.id));
      assert(!pending.length,'Consulte integralmente os contextos de todos os resultados atribuídos. Retome read_evaluation_context com section=context e offset=next_offset: '+JSON.stringify(pending.slice(0,3).map(r=>({result_id:r.id,next_offset:nextUnreadOffset(ranges.get(`${r.id}:context`),texts.get(`${r.id}:context`).length)}))),422);
      validateEvaluation(output,input);
      return {observation:{accepted:true,findings:output.findings.length,requires_human_review:true},terminal:{output,input}};
    },
  };
  const validateCall=call=>{assert(typeof call?.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);const tool=declarations.find(t=>t.name===call.name);assert(tool,'Ferramenta não permitida para A4.',403);validateShape(call.args,tool.parameters,'argumentos');};
  return {declarations,task:{result_ids:input.results.map(r=>r.id)},execute:createAgentToolRegistry({task:{},handlers,maxObservationChars,validateCall}),
    async restore(state){for(const [key,list] of Object.entries(state?.evaluation_ranges || {})){assert(texts.has(key),'Contexto restaurado fora da tarefa.',409);for(const [start,end] of list){assert(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>start&&end<=texts.get(key).length,'Faixa restaurada inválida.',409);add(key,start,end);}}}};
}
