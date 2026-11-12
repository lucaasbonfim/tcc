import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalReason} from '../src/research/services/operational-record.js';
test('registro operacional é identificado como sistema e não inventa razão humana',()=>{
  assert.equal(operationalReason({operation_record:'system/v1'},'Preparar plano.'),'[Registro operacional do sistema] Preparar plano.');
  assert.equal(operationalReason({justification:'Minha decisão.'},'Preparar plano.'),'Minha decisão.');
  assert.throws(()=>operationalReason({},'Preparar plano.'),/Justificativa/);
  assert.throws(()=>operationalReason({operation_record:'system/v1',justification:'Não descartar esta razão.'},'Preparar plano.'),/Separe/);
});
