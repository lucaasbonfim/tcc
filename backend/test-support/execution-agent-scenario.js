import {randomUUID} from 'node:crypto';
import {scenarioServices,textualScenario} from './research-scenario.js';
import {executionAgentFixtureTurn} from './execution-agent-fixture.js';
import {createAutomationService} from '../src/research/automation.js';
import {createExecutionService} from '../src/research/execution.js';
import {generatedPath} from '../src/research/automation-contract.js';
import {fixtureResult} from '../../shared/execution-fixture.js';
export async function executionAgentScenario(pool,store,{count=1,generateTurn=executionAgentFixtureTurn,status='passed',limits={}}={}) {
  const sent=[],receipt={ready:true,deployment_id:'a3-fixture',policy_sha256:'a'.repeat(64),images:{'node-test/v2':{image_id:'sha256:'+'b'.repeat(64)}}};
  const executorClient={health:async()=>receipt,execute:async bundle=>{sent.push(bundle);const result=fixtureResult(bundle,status);result.environment={image_id:receipt.images[bundle.adapter].image_id,deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256};return result;}};
  const services=scenarioServices(pool,store,{executorClient,generateTurn}),{run,inspection}=await textualScenario(services,{agent_policy:{modes:{execution:'agent/v1'},limits}}),automation=createAutomationService({pool,store});
  await automation.start(run.id,{inspection_id:inspection.inspection_id,module_root:'',target_paths:['src/calc.js'],justification:'Controle de A3.'});await services.processor.processOne();const [script]=await automation.list(run.id);
  await automation.review(run.id,script.id,{revision:script.revision,decision:'approved',justification:'Script de controle.'});await automation.approve(run.id,{justification:'Fixture aprovada.'});
  const original=(await services.runs.detail(run.id)).test_cases[0];
  for(let i=1;i<count;i++){const id=randomUUID(),content={...original.content,code:'CT-'+String(i+1).padStart(3,'0')};await pool.query("INSERT INTO research.test_cases(id,run_id,code,content,review_status) VALUES($1,$2,$3,$4,'approved')",[id,run.id,content.code,content]);const files=script.files_data.map(f=>({...f,path:generatedPath(id,script.adapter).path}));
    await pool.query("INSERT INTO research.automated_tests(id,run_id,test_case_id,generation_attempt_id,adapter,content,files,compatibility,review_status) VALUES($1,$2,$3,$4,$5,$6,$7,'compatible','approved')",[randomUUID(),run.id,id,script.generation_attempt_id,script.adapter,{...script.content,test_case_id:id,files},await store.put(files)]);}
  return {services,run,sent,receipt,executorClient,execution:createExecutionService({pool,store,client:executorClient})};
}
