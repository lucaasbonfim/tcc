import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildScope,validateAutomation,generatedPath,partitionAutomation} from '../src/research/automation-contract.js';
import {inspectRepository} from '../src/research/inspection.js';
import {repositoryFixture} from '../test-support/repository-fixture.js';
const version={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)};

export async function nodeFixture() {
  const fixture=repositoryFixture({'package.json':'{"type":"module"}','src/calc.js':'export function sum(a,b){return a+b;}'});
  const inspection=await inspectRepository(version,fixture.fetch);
  const scope=buildScope(inspection,'',['src/calc.js']);
  const id=randomUUID();
  const row={id,content:{requirement_codes:['RF-001'],expected_result:'Retorna a soma.'}};
  const artifact={test_case_id:id,requirement_codes:['RF-001'],adapter:'node-test/v2',commit_sha:version.commit_sha,
    files:[{path:generatedPath(id,'node-test/v2').path,code:"import test from 'node:test'; import assert from 'node:assert/strict'; import {sum} from '../src/calc.js'; test('soma',()=>{assert.equal(sum(2,3),5);});"}],
    targets:[{path:'src/calc.js',symbols:['sum']}],rationale:'Verifica soma do requisito.',expected_result:row.content.expected_result,
    expected_sources:[{requirement_code:'RF-001',quote:'somar dois números'}],limitations:[]};
  return {fixture,inspection,scope,artifact,input:{scope,test_cases:[row],requirements:[{code:'RF-001',description:'O sistema deve somar dois números.',sources:[]}]}};
}
test('contrato de automação preserva esperado, SHA, símbolos e caso original',async()=>{
  const {artifact,input}=await nodeFixture();
  assert.equal(validateAutomation({artifacts:[artifact],unsupported_cases:[],warnings:[]},input).artifacts.length,1);
  for(const change of [{commit_sha:'b'.repeat(40)},{test_case_id:randomUUID()},{expected_result:'Outro esperado'},{targets:[{path:'src/calc.js',symbols:['inventado']}]}]) {
    assert.throws(()=>validateAutomation({artifacts:[{...artifact,...change}],unsupported_cases:[],warnings:[]},input));
  }
});
test('scripts rejeitam imports inventados, alteração de caminho e casos omitidos',async()=>{
  const {artifact,input}=await nodeFixture();
  assert.throws(()=>validateAutomation({artifacts:[],unsupported_cases:[],warnings:[]},input),/Cada caso/);
  for(const code of [artifact.files[0].code.replace('{sum}','{fake}'),artifact.files[0].code.replace('node:assert/strict','node:child_process')]) {
    assert.throws(()=>validateAutomation({artifacts:[{...artifact,files:[{...artifact.files[0],code}]}],unsupported_cases:[],warnings:[]},input));
  }
  assert.throws(()=>validateAutomation({artifacts:[{...artifact,files:[{path:'src/calc.js',code:'fake'}]}],unsupported_cases:[],warnings:[]},input),/Caminho/);
});

test('erro em um artefato preserva os válidos sem corrigir silenciosamente o esperado',async()=>{
  const {artifact,input}=await nodeFixture(),secondId=randomUUID();
  const second={...artifact,test_case_id:secondId,files:[{...artifact.files[0],path:generatedPath(secondId,'node-test/v2').path}],expected_result:'Esperado inventado.'};
  const context={...input,test_cases:[...input.test_cases,{...input.test_cases[0],id:secondId}]};
  const response={artifacts:[artifact,second],unsupported_cases:[],warnings:[]};
  const checked=partitionAutomation(response,context);
  assert.equal(checked.output.artifacts.length,1);assert.equal(checked.errors[0].test_case_id,secondId);
  assert.match(checked.errors[0].reason,/preservar/);assert.equal(response.artifacts[1].expected_result,'Esperado inventado.');
  assert.throws(()=>partitionAutomation({...response,artifacts:[artifact,artifact]},context),/Cada caso/);
});
test('Java seleciona fechamento local, recusa Swing/SQL/dependências externas',async()=>{
  const fixture=repositoryFixture({'pom.xml':'<project/>','src/main/java/sample/Value.java':'package sample; public class Value {public int get(){return 1;}}',
    'src/main/java/sample/Tela.java':'package sample; import javax.swing.JFrame; public class Tela extends JFrame {}',
    'src/main/java/sample/Client.java':'package sample; import org.external.Service; public class Client {Service s;}',
    'src/main/java/sample/Holder.java':'package sample; public class Holder {Value value;}' });
  const inspected=await inspectRepository(version,fixture.fetch);
  assert.equal(buildScope(inspected,'',['src/main/java/sample/Holder.java']).files.length,2);
  assert.throws(()=>buildScope(inspected,'',['src/main/java/sample/Tela.java']),/candidata/);
  assert.throws(()=>buildScope(inspected,'',['src/main/java/sample/Client.java']),/não provisionada/);
});
