import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArtifactStore} from '../src/research/artifacts.js';
import {inspectRepository} from '../src/research/inspection.js';
import {repositoryFixture} from '../test-support/repository-fixture.js';
import {buildScope,generatedPath} from '../src/research/automation-contract.js';
import {createAutomationAgentTools} from '../src/research/automation-agent-tools.js';
import {boundedObservation} from '../src/research/agent-tools.js';
test('agente consulta fontes fixadas, prepara dependências e submete com escopo efetivo sem executar código',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent-tools-')),store=createArtifactStore(dir);
  try {
    const fixture=repositoryFixture({'package.json':'{"type":"module"}','src/a.js':"import {value} from './b.js';export function sum(a,b){return a+b+value;}",'src/b.js':'export const value=0;','src/gui.js':"import external from 'unavailable';export const ui=external;",'nested/package.json':'{"type":"module"}','nested/x.js':'export const secret=2;'});
    const inspection=await inspectRepository({repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)},fixture.fetch);
    const scope=buildScope(inspection,'',['src/b.js']),id=randomUUID();
    const input={scope,test_cases:[{id,content:{requirement_codes:['RF-001'],expected_result:'Retorna 5.'}}],requirements:[{code:'RF-001',description:'Somar dois números.',sources:[]}],generated_paths:[{test_case_id:id,...generatedPath(id,scope.module.adapter)}]};
    const tools=createAutomationAgentTools({input,inspection,store});let n=0;
    const call=(name,args)=>tools.execute({id:String(++n),name,args});
    assert.equal((await call('find_symbols',{query:'sum'})).observation.matches[0].path,'src/a.js');
    assert.match((await call('read_source',{path:'src/a.js',offset:0,length:20})).observation.content,/import/);
    assert.equal((await call('get_approved_case',{case_id:id})).observation.generated_path.path,input.generated_paths[0].path);
    for(const path of ['../.env','nested/x.js','https://example.com/file'])await assert.rejects(call('read_source',{path,offset:0,length:10}));
    await assert.rejects(call('get_approved_case',{case_id:'foreign'}),/fora/);
    await assert.rejects(call('prepare_automation_scope',{target_paths:['src/gui.js']}),/externa/);
    const prepared=(await call('prepare_automation_scope',{target_paths:['src/a.js']})).observation;
    assert.ok(prepared.files.some(file=>file.path==='src/b.js'));
    const output={artifacts:[{test_case_id:id,requirement_codes:['RF-001'],adapter:scope.module.adapter,commit_sha:scope.commit_sha,
      files:[{path:input.generated_paths[0].path,code:"import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../src/a.js';test('soma',()=>{assert.equal(sum(2,3),5);});"}],
      targets:[{path:'src/a.js',symbols:['sum']}],rationale:'Confere soma.',expected_result:'Retorna 5.',expected_sources:[{requirement_code:'RF-001',quote:'Somar dois números.'}],limitations:[]}],unsupported_cases:[],warnings:[]};
    const submitted=await call('submit_automation',{scope_id:prepared.scope_id,output});
    assert.equal(submitted.terminal.input.scope.target_paths[0],'src/a.js');assert.equal(submitted.observation.requires_human_review,true);
    const restored=createAutomationAgentTools({input,inspection,store});await restored.restore(prepared);
    await restored.execute({id:'restored',name:'submit_automation',args:{scope_id:prepared.scope_id,output}});
    await assert.rejects(call('submit_automation',{scope_id:prepared.scope_id,output:{...output,artifacts:[{...output.artifacts[0],expected_result:'Mudar para passar.'}]}}),/Esperado/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('observações longas sinalizam truncamento e respeitam o limite serializado',()=>{
  const value={text:'"\\\n'.repeat(10000)};const bounded=boundedObservation(value,1000);
  assert.equal(bounded.truncated,true);assert.ok(JSON.stringify(bounded).length<=1000);
});
