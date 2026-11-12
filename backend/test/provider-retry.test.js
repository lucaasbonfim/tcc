import test from 'node:test';
import assert from 'node:assert/strict';
import {providerRetryAfterMs} from '../src/research/runtime/provider-retry.js';
import {createAgentPolicy,resolveAgentPolicy} from '../src/research/runtime/policy.js';
test('RetryInfo expõe apenas duração e política antiga mantém condição original',()=>{
  const error=new Error(JSON.stringify({error:{message:'sensitive',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'55.472041506s'}]}}));
  assert.equal(providerRetryAfterMs(error),55473);assert.equal(providerRetryAfterMs(new Error('secret')),null);
  assert.equal(providerRetryAfterMs(new Error(JSON.stringify({error:{details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'-1s'}]}}))),null);
  assert.equal(createAgentPolicy().model_retry.respect_retry_after,true);
  assert.equal(resolveAgentPolicy({agent_policy:{version:'1.1.0'}}).model_retry.respect_retry_after,undefined);
});
