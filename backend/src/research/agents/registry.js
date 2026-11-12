import {REQUIREMENTS_FIXED_AGENT} from './requirements/definition.js';
import {TESTS_FIXED_AGENT} from './tests/cases/definition.js';
import {EXECUTION_FIXED_AGENT} from './execution/definition.js';
import {EVALUATION_STAGE_AGENT} from './evaluation/definition.js';
const fixedDefinitions=[REQUIREMENTS_FIXED_AGENT,TESTS_FIXED_AGENT,EXECUTION_FIXED_AGENT,EVALUATION_STAGE_AGENT];
import {REQUIREMENTS_AGENT} from './requirements/definition.js';
import {TESTS_AGENT} from './tests/cases/definition.js';
import {AUTOMATION_AGENT,AUTOMATION_AGENT_TOOLS} from './tests/scripts/definition.js';
import {AUTOMATION} from './tests/scripts/definition.js';
import {EXECUTION_PLANNING_AGENT} from './execution/planning/definition.js';
import {EXECUTION_DIAGNOSIS_AGENT} from './execution/diagnosis/definition.js';
import {EVALUATION_AGENT} from './evaluation/definition.js';
import {EVALUATION} from './evaluation/definition.js';
import {CLARIFICATION_AGENT} from './requirements/subagents/clarification.js';
import {SCRIPT_REVIEW_AGENT} from './tests/subagents/script-review.js';

// Four research roles. Internal stages/phases do not create additional roles.
export const AGENT_REGISTRY = Object.freeze([
  {id:'A1',agent:'requirements',name:'Análise de requisitos',stages:['requirements'],
    profiles:{requirements:{fixed:fixedDefinitions[0],agent:REQUIREMENTS_AGENT,terminalTool:'submit_requirements'}},
    subagents:{clarification:CLARIFICATION_AGENT}},
  {id:'A2',agent:'tests',name:'Geração de testes',stages:['tests','automation'],
    profiles:{tests:{fixed:fixedDefinitions[1],agent:TESTS_AGENT,terminalTool:'submit_test_cases'},
      automation:{fixed:AUTOMATION,agent:{...AUTOMATION_AGENT,tools:AUTOMATION_AGENT_TOOLS},terminalTool:'submit_automation'}},
    subagents:{script_review:SCRIPT_REVIEW_AGENT}},
  {id:'A3',agent:'execution',name:'Planejamento e diagnóstico da execução',stages:['execution'],
    profiles:{planning:{agent:EXECUTION_PLANNING_AGENT,terminalTool:'submit_execution_plan'},
      executing:{fixed:fixedDefinitions[2]},diagnosis:{agent:EXECUTION_DIAGNOSIS_AGENT,terminalTool:'submit_execution_diagnostics'}},subagents:{}},
  {id:'A4',agent:'evaluation',name:'Avaliação de evidências',stages:['evaluation'],
    profiles:{evaluation:{fixed:EVALUATION,agent:EVALUATION_AGENT,terminalTool:'submit_evaluation'}},subagents:{}},
]);

// Keep the original serialized definitions and their property order for snapshots.
export const AGENTS = fixedDefinitions;
export function snapshotAgentProfiles() {
  return {
    requirements_agent_definition:REQUIREMENTS_AGENT,
    tests_agent_definition:TESTS_AGENT,
    evaluation_agent_definition:EVALUATION_AGENT,
    evaluation_definition:EVALUATION,
    clarification_agent_definition:CLARIFICATION_AGENT,
    script_review_agent_definition:SCRIPT_REVIEW_AGENT,
    execution_agent_definitions:{planning:EXECUTION_PLANNING_AGENT,diagnosis:EXECUTION_DIAGNOSIS_AGENT},
    automation_agent_definition:{...AUTOMATION_AGENT,tools:AUTOMATION_AGENT_TOOLS},
  };
}

export {REQUIREMENTS_AGENT,TESTS_AGENT,EVALUATION_AGENT};
