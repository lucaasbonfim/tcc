import {assert} from '../../../errors.js';
import {validateShape} from '../../../shared/validation.js';
import {validateOutput} from '../../validation.js';

import {assertTestCoverage} from './parts.js';
import {createAgentToolRegistry} from '../../../agent-tools.js';

import {TESTS_AGENT} from './definition.js';

export function createTestsAgentTools({input,definition=TESTS_AGENT,maxObservationChars=12000,requestClarification}) {
  const texts=new Map(input.requirements.map(row=>[row.code,JSON.stringify(row)])),ranges=new Map();
  const covered=code=>ranges.get(code)?.length===1 && ranges.get(code)[0][0]===0 && ranges.get(code)[0][1]===texts.get(code).length;
  function add(code,start,end) {
    const merged=[];for(const range of [...(ranges.get(code) || []),[start,end]].sort((a,b)=>a[0]-b[0])) {
      const last=merged.at(-1);if(last && range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);
    }ranges.set(code,merged);
  }
  const declarations=structuredClone(definition.tools);
  declarations.find(t=>t.name==='submit_test_cases').parameters.properties.output.properties.test_cases.items.properties.requirement_codes.items={type:'string',enum:[...texts.keys()]};
  const handlers={
    request_requirement_clarification:async(args,context)=>{
      assert(texts.has(args.requirement_code),'Requisito fora da tarefa aprovada.',403);
      assert(requestClarification,'Consulta entre agentes indisponível nesta tarefa.',422);
      return {observation:await requestClarification(args,context)};
    },
    list_test_requirements:async()=>({observation:{requirements:input.requirements.map(r=>({code:r.code,title:r.title,characters:texts.get(r.code).length,read_complete:Boolean(covered(r.code))}))}}),
    read_test_requirement:async({requirement_code,offset,length})=>{
      const text=texts.get(requirement_code);assert(text!==undefined,'Requisito fora da tarefa aprovada.',403);assert(offset<text.length,'Offset excede o requisito.',422);
      const make=end=>({requirement_code,format:'json',offset,end,total_characters:text.length,truncated:end<text.length,text:text.slice(offset,end)});
      let low=offset+1,high=Math.min(offset+length,text.length),best=offset;
      while(low<=high){const middle=Math.floor((low+high)/2);if(JSON.stringify(make(middle)).length<=maxObservationChars){best=middle;low=middle+1;}else high=middle-1;}
      if(best<text.length && /[\uD800-\uDBFF]/.test(text[best-1]))best--;
      assert(best>offset,'Limite de observação não comporta o requisito.',422);add(requirement_code,offset,best);
      return {observation:make(best),state:{requirement_ranges:Object.fromEntries(ranges)}};
    },
    submit_test_cases:async({output})=>{
      assert([...texts.keys()].every(covered),'Consulte integralmente todos os requisitos atribuídos.',422);
      validateOutput('tests',output,input);assertTestCoverage(output.test_cases,input.requirements);
      return {observation:{accepted:true,test_cases:output.test_cases.length,requires_human_review:true,coverage_kind:'declared_requirement_links'},terminal:{output,input}};
    },
  };
  const validateCall=call=>{assert(typeof call?.id==='string' && call.id.length>0 && call.id.length<=200,'Chamada sem identificador válido.',422);const tool=declarations.find(t=>t.name===call.name);assert(tool,'Ferramenta não permitida para A2 textual.',403);validateShape(call.args,tool.parameters,'argumentos');};
  return {declarations,task:{requirement_codes:[...texts.keys()]},execute:createAgentToolRegistry({task:{},handlers,maxObservationChars,validateCall}),
    async restore(state){for(const [code,list] of Object.entries(state?.requirement_ranges || {})){assert(texts.has(code),'Requisito restaurado fora da tarefa.',409);for(const [start,end] of list){assert(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>start&&end<=texts.get(code).length,'Faixa de leitura inválida.',409);add(code,start,end);}}}};
}
