import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRepository,javascriptSymbols,javaSymbols,safePath,INSPECTION_LIMITS} from '../src/research/inspection.js';
import {repositoryFixture} from '../test-support/repository-fixture.js';
const version={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)};
test('inspeção encontra módulos internos, testes antigos e omissões sem truncamento silencioso',async()=>{
  const fixture=repositoryFixture({'apps/api/package.json':'{"type":"module"}','apps/api/src/a.mjs':'export function soma(a,b){return a+b;}','apps/api/test/a.test.mjs':'import test from "node:test";','java/pom.xml':'<artifactId>postgresql</artifactId>','java/src/main/java/Value.java':'public class Value {public int get(){return 1;}}'});
  const inspected=await inspectRepository(version,fixture.fetch);
  assert.equal(inspected.modules.length,2);
  assert.equal(inspected.files.find(f=>f.path.includes('a.test')).role,'existing_test');
  assert.ok(inspected.modules.find(m=>m.root==='apps/api').targets.includes('apps/api/src/a.mjs'));
  const limited=await inspectRepository(version,fixture.fetch,{...INSPECTION_LIMITS,maxFiles:1});
  assert.ok(limited.omitted.length>0 && limited.warnings.length>0);
});
test('símbolos são extraídos estaticamente, com bloqueio de caminhos e alertas Java',()=>{
  assert.deepEqual(javascriptSymbols('exports.soma=(a,b)=>a+b;').exports,['soma']);
  assert.ok(javascriptSymbols('export {x} from "./x.js";').imports.includes('./x.js'));
  assert.equal(javaSymbols('import javax.swing.JFrame; public class Tela extends JFrame {}').requires_gui,true);
  for(const path of ['../a.js','/a.js','a//b.js','a\\b.js'])assert.throws(()=>safePath(path));
});
