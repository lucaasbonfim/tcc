import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordReader,nextUnreadOffset} from '../src/research/agent-records.js';
test('leitura parcial informa a lacuna real e só libera submissão após todos os trechos',async()=>{
  const records=[{id:'evidence-1',data:{text:'"linha\\\n'.repeat(500)}}],reader=createRecordReader({records,maxObservationChars:1500,idField:'result_id'});
  const first=reader.read('evidence-1',0,10000);assert.equal(first.observation.read_complete,false);assert.equal(first.observation.next_offset,first.observation.end);assert.ok(JSON.stringify(first.observation).length<=1500);
  assert.throws(()=>reader.assertComplete(),e=>e.message.includes('evidence-1')&&e.message.includes('"next_offset":'+first.observation.end));
  const restored=createRecordReader({records,maxObservationChars:1500,idField:'result_id'});await restored.restore(first.state);let current=first;
  while(!current.observation.read_complete)current=restored.read('evidence-1',current.observation.next_offset,10000);
  assert.equal(current.observation.next_offset,null);restored.assertComplete();
  assert.equal(nextUnreadOffset([[0,10],[20,30]],30),10);assert.equal(nextUnreadOffset([[20,30]],30),0);assert.equal(nextUnreadOffset([[0,10],[20,30]],30,[10,20]),null);
});
