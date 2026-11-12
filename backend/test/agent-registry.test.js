import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AGENT_REGISTRY,AGENTS,snapshotAgentProfiles} from '../src/research/agents/registry.js';

test('catálogo relaciona quatro papéis às cinco etapas e às consultas filhas',()=>{
  assert.deepEqual(AGENT_REGISTRY.map(role=>role.id),['A1','A2','A3','A4']);
  assert.deepEqual(AGENT_REGISTRY.flatMap(role=>role.stages),['requirements','tests','automation','execution','evaluation']);
  assert.equal(AGENT_REGISTRY[1].profiles.automation.agent.agent,'automation');
  assert.equal(AGENT_REGISTRY[0].subagents.clarification.agent,'requirements');
  assert.equal(AGENT_REGISTRY[1].subagents.script_review.agent,'automation');
});

test('reorganização preserva os bytes das definições usadas nos snapshots',async()=>{
  const baseline=JSON.parse(await readFile(new URL('./fixtures/agent-definition-digests.json',import.meta.url),'utf8'));
  const snapshot=JSON.stringify({agent_definitions:AGENTS,...snapshotAgentProfiles()});
  assert.equal(createHash('sha256').update(snapshot).digest('hex'),baseline.sha256);
});
