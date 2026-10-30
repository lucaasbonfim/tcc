import test from 'node:test';
import assert from 'node:assert/strict';
import {citationRequest,resolveCitations,preservedOutput} from '../src/research/citations.js';
import {requirementsOutputSchema,validateOutput} from '../src/research/agents.js';

test('catálogo resolve a citação literal sem pedir que o modelo a reescreva',()=>{
  const text='Se o usuário for um funcionário ou cliente, ele terá acesso às seguintes opções:\n- Editar informações da reserva.\n- Realizar o pagamento.';
  const request=citationRequest({documents:[{id:'doc',pages:[{page:76,text}]}],part:{segments:[{document_id:'doc',page:76,start:300}]}},requirementsOutputSchema);
  const raw={requirements:[{code:'RF-001',title:'Reserva',description:'Editar reserva.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{source_id:'S0001'}]}],alerts:[]};
  const output=resolveCitations(raw,request.input,request.schema);validateOutput('requirements',output,request.input);
  assert.deepEqual(output.requirements[0].sources,[{document_id:'doc',page:76,quote:text}]);
  assert.equal(request.input.source_catalog[0].start,300);
  assert.deepEqual(raw.requirements[0].sources,[{source_id:'S0001'}]);
  const invalid=structuredClone(raw);invalid.requirements[0].sources[0].source_id='inventado';
  assert.throws(()=>resolveCitations(invalid,request.input,request.schema));
  invalid.requirements[0].sources=[{source_id:'S0001',quote:'ele ...'}];assert.throws(()=>resolveCitations(invalid,request.input,request.schema),/desconhecido/);
  assert.equal(preservedOutput({raw:JSON.stringify(raw),validated_output:output}),output);
});

test('catálogo cobre texto extenso e Unicode sem cortar pares ou modificar a página',()=>{
  const text='Regra com acentos e emoji 🚍.\n'.repeat(200),input={documents:[{id:'a',pages:[{page:1,text},{page:2,text:''}]}]};
  const {input:prepared}=citationRequest(input,requirementsOutputSchema);
  assert.equal(prepared.source_catalog.map(s=>s.quote).join(''),text);
  assert.ok(prepared.source_catalog.every(s=>s.quote===text.slice(s.start,s.end)));
  assert.equal(requirementsOutputSchema.properties.requirements.items.properties.sources.items.properties.source_id,undefined);
});
