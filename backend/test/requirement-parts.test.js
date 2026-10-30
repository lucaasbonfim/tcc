import test from 'node:test';
import assert from 'node:assert/strict';
import {planParts,consolidateParts,validatePart} from '../src/research/requirement-parts.js';

test('partes preservam todas as posições e páginas com entradas limitadas e sobreposição',()=>{
  const text='Regra de negócio com contexto.\n'.repeat(5000);
  const parts=planParts([{id:'doc',name:'requisitos',version:1,pages:[{page:1,text},{page:2,text:''},{page:3,text:'Fim.'}]}]);
  assert.ok(parts.length>5 && parts.every(part=>part.character_count<=16600));
  let end=0;
  for(const segment of parts.flatMap(p=>p.segments).filter(s=>s.page===1 && !s.context_only)) {assert.ok(segment.start<=end);end=segment.end;}
  assert.equal(end,text.length);
  assert.ok(parts.flatMap(p=>p.segments).some(s=>s.page===2 && s.end===0));
});
test('consolidação une somente conteúdo idêntico e mantém origens e contradições como alertas',()=>{
  const base={code:'RF-001',title:'Regra',description:'O sistema deve permitir acesso.',kind:'functional',sources:[{document_id:'a',page:1,quote:'permitir acesso'}]};
  const second={...base,sources:[{document_id:'b',page:2,quote:'permitir acesso'}]};
  const contrary={...base,description:'O sistema não deve permitir acesso.'};
  const output=consolidateParts([{id:'part1',output:{requirements:[base],alerts:[]}},{id:'part2',output:{requirements:[second,contrary],alerts:[]}}]);
  assert.equal(output.output.requirements.length,2);
  assert.equal(output.output.requirements[0].sources.length,2);
  assert.equal(output.mapping.length,3);
  assert.ok(output.output.alerts.some(a=>a.kind==='inconsistency'));
  assert.throws(()=>validatePart({requirements:[],alerts:[]},{documents:[]}),/alerta/);
});
