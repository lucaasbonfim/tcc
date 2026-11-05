import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRunAction,workStageStatus,summarizeResults} from '../src/utils/run-journey.js';
test('contagem não converte bloqueio, erro de compilação ou teste omitido em caso executado',()=>{
  const results=[{test_case_id:'c1',status:'passed'},{test_case_id:'c1',status:'failed'},{test_case_id:'c2',status:'compilation_error'},{test_case_id:'c3',status:'skipped'},{test_case_id:'c4',status:'unsupported'},{test_case_id:'c5',status:'inconclusive'}];
  const summary=summarizeResults(results);assert.equal(summary['Casos com teste concluído'],1);assert.equal(summary['Testes reprovados'],1);assert.equal(summary['Problemas técnicos'],1);assert.equal(summary['Inconclusivos'],1);
});
test('fluxo assistido distingue revisão textual, scripts e autorização',()=>{
  let run={status:'awaiting_review',stages:[{agent:'requirements',status:'awaiting_review'}]};assert.equal(nextRunAction(run).view,'requirements');
  run={status:'completed',stages:[{agent:'tests',status:'completed'}]};assert.equal(nextRunAction(run).view,'automation');
  run.stages.push({agent:'automation',status:'completed'});assert.equal(nextRunAction(run).view,'evidence');
  run.status='awaiting_review';run.stages.push({agent:'execution',status:'awaiting_review'});assert.match(nextRunAction(run).title,/autorizar/);
});
test('autonomia não pede aprovação entre etapas',()=>{
  const next=nextRunAction({workflow_mode:'autonomous/v1',status:'awaiting_review',stages:[{agent:'requirements',status:'awaiting_review'}]});assert.equal(next.view,'timeline');assert.notEqual(next.label,'Revisar agora');
});
test('falta de automação não vira resultado executado',()=>{
  const next=nextRunAction({status:'completed',stages:[{agent:'automation',status:'not_supported'}]});assert.equal(next.view,'automation');assert.match(next.description,/não foram executados/);
  assert.equal(workStageStatus({stages:[{agent:'execution',status:'not_supported'}]},'evidence'),'blocked');
});
test('falha aponta a etapa que falhou, sem reutilizar mensagem do A1',()=>{
  const next=nextRunAction({status:'failed',stages:[{agent:'requirements',status:'completed',message:'Requisitos finalizados'},{agent:'tests',status:'failed',message:'Falha nos casos'}]});assert.equal(next.description,'Falha nos casos');assert.equal(next.view,'timeline');
});
