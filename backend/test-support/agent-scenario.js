import {randomUUID} from 'node:crypto';
import {scenarioServices,textualScenario} from './research-scenario.js';
import {createAutomationService} from '../src/research/services/automation.js';
import {generatedPath} from '../src/research/agents/tests/scripts/contracts.js';

export async function claimedAutomationScenario(pool,store) {
  const services=scenarioServices(pool,store),{run,inspection}=await textualScenario(services);
  const automation=createAutomationService({pool,store});
  await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',justification:'Controle técnico agentivo.'});
  const stage=(await pool.query("SELECT * FROM research.stages WHERE run_id=$1 AND agent='automation'",[run.id])).rows[0];
  const part=(await pool.query('SELECT * FROM research.automation_parts WHERE run_id=$1 ORDER BY sequence LIMIT 1',[run.id])).rows[0];
  const token=randomUUID(),attemptId=randomUUID();
  await pool.query("UPDATE research.stages SET status='running',lease_token=$2,lease_until=now()+interval '3 minutes' WHERE id=$1",[stage.id,token]);
  await pool.query("INSERT INTO research.attempts(id,stage_id,number,status,automation_part_id) VALUES($1,$2,1,'running',$3)",[attemptId,stage.id,part.id]);
  const input=await automation.partInput(part);
  const artifact=(await pool.query('SELECT artifact FROM research.inspections WHERE id=$1',[inspection.inspection_id])).rows[0].artifact;
  return {job:{run,stage,token,attemptId,automationPart:part},input,inspection:await store.json(artifact)};
}
export function agentFixtureOutput(input,targetPath='src/calc.js') {
  const row=input.test_cases[0];
  return {artifacts:[{test_case_id:row.id,requirement_codes:row.content.requirement_codes,adapter:'node-test/v2',commit_sha:input.scope.commit_sha,
    files:[{path:generatedPath(row.id,'node-test/v2').path,code:`import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../${targetPath}';test('soma',()=>{assert.equal(sum(2,3),5);});`}],
    targets:[{path:targetPath,symbols:['sum']}],rationale:'Controle sintético de soma.',expected_result:row.content.expected_result,
    expected_sources:[{requirement_code:row.content.requirement_codes[0],quote:'somar dois números'}],limitations:['Fixture técnica.']}],unsupported_cases:[],warnings:[]};
}
export function fixtureTurn(calls) {
  const content={role:'model',parts:calls.map(call=>({thoughtSignature:'fixture-signature',functionCall:call}))};
  return {content,calls,raw:JSON.stringify({content}),metadata:{model_version:'fixture',usage:{totalTokenCount:10},finish_reasons:['STOP'],cost:null}};
}
