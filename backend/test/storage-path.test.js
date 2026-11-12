import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ARTIFACTS_DIRECTORY} from '../src/research/storage/artifacts.js';

test('movimentação do armazenamento conserva backend/artifacts como diretório padrão',()=>{
  assert.equal(DEFAULT_ARTIFACTS_DIRECTORY,fileURLToPath(new URL('../artifacts/',import.meta.url)));
});
