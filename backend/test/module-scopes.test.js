import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRepository,INSPECTION_LIMITS} from '../src/research/inspection.js';
import {planModuleScopes} from '../src/research/module-scopes.js';
import {repositoryFixture} from '../test-support/repository-fixture.js';
const version={repository_url:'https://github.com/example/repo',commit_sha:'a'.repeat(40)};

test('módulo com mais de oito fontes é dividido automaticamente, sem excluir alvos compatíveis',async()=>{
  const sources=Object.fromEntries(Array.from({length:20},(_,i)=>[`src/f${i}.js`,`export function f${i}(){return ${i};}`]));
  const fixture=repositoryFixture({'package.json':'{"type":"module"}',...sources,'src/external.js':'import pg from "pg";export function external(){return pg;}'});
  const inspected=await inspectRepository(version,fixture.fetch),plan=planModuleScopes(inspected,'');
  assert.equal(plan.scopes.length,3);assert.equal(plan.summary.eligible_target_paths.length,20);assert.equal(plan.summary.excluded.length,1);assert.match(plan.summary.excluded[0].reason,/não provisionada/);
  assert.deepEqual(new Set(plan.scopes.flatMap(scope=>scope.target_paths)),new Set(Object.keys(sources)));
  assert(plan.scopes.every(scope=>scope.files.length<=16 && scope.target_paths.length<=8));
  assert.throws(()=>planModuleScopes(inspected,'',['unknown.js']),/Seleção/);
  assert.equal(planModuleScopes(inspected,'',Object.keys(sources)).summary.eligible_target_paths.length,20);
});

test('leitura em lotes cobre 36 fontes e reaproveita cache somente após conferir hashes',async()=>{
  const fixture=repositoryFixture({'package.json':'{"type":"module"}',...Object.fromEntries(Array.from({length:35},(_,i)=>[`src/f${i}.js`,`export const f${i}=${i};`]))});
  let running=0,peak=0;
  const fetch=async(...args)=>{if(args[0].includes('/git/blobs/')){running++;peak=Math.max(peak,running);await new Promise(resolve=>setTimeout(resolve,2));try{return await fixture.fetch(...args);}finally{running--;}}return fixture.fetch(...args);};
  const original=await inspectRepository(version,fetch);assert.equal(original.files.length,36);assert.equal(original.omitted.length,0);assert.equal(original.read_batches.length,2);assert(peak>1 && peak<=4);
  fixture.requests.length=0;const cached=await inspectRepository(version,fixture.fetch,INSPECTION_LIMITS,original.files);
  assert.equal(cached.read_batches.reduce((n,batch)=>n+batch.cached,0),36);assert.equal(fixture.requests.length,1);assert.deepEqual(cached.files,original.files);
  fixture.requests.length=0;const corrupt=structuredClone(original.files);corrupt[0].content='conteúdo alterado';
  const recovered=await inspectRepository(version,fixture.fetch,INSPECTION_LIMITS,corrupt);assert.equal(fixture.requests.filter(row=>row.url.includes('/git/blobs/')).length,1);assert.deepEqual(recovered.files,original.files);
});

test('planejamento distingue arquivo lido de classe executável e detecta dependência indireta de banco',async()=>{
  const fixture=repositoryFixture({'pom.xml':'<project/>','src/main/java/sample/Value.java':'package sample;public class Value{public int get(){return 1;}}','src/main/java/sample/Tela.java':'package sample;import javax.swing.JFrame;public class Tela extends JFrame{}','src/main/java/sample/Store.java':'package sample;import java.sql.Connection;public class Store{Connection connection;}','src/main/java/sample/Controller.java':'package sample;public class Controller{Store store;}'});
  const inspected=await inspectRepository(version,fixture.fetch),plan=planModuleScopes(inspected,'');assert.equal(inspected.files.length,5);assert.equal(inspected.omitted.length,0);assert.deepEqual(plan.summary.eligible_target_paths,['src/main/java/sample/Value.java']);assert.equal(plan.summary.excluded.length,3);assert(plan.summary.excluded.some(row=>row.path.endsWith('Controller.java') && /GUI\/banco/.test(row.reason)));
});
