import {assert} from './errors.js';

export const AGENT_POLICY_VERSION='1.0.0';
export const STAGE_NAMES=Object.freeze(['requirements','tests','automation','execution','evaluation']);
export const DEFAULT_AGENT_LIMITS=Object.freeze({max_model_turns:12,max_tool_calls:16,max_duration_ms:180000,
  max_observation_chars:12000,max_context_chars:150000,max_total_tokens:60000});
export const DEFAULT_RUN_LIMITS=Object.freeze({max_model_turns:128,max_tool_calls:256,max_total_tokens:500000});
const ceilings={max_model_turns:512,max_tool_calls:1024,max_duration_ms:600000,max_observation_chars:30000,
  max_context_chars:180000,max_total_tokens:2000000};
function object(value,name) {
  assert(value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype,`${name}: objeto inválido.`,422);
}
function limits(value,defaults,name) {
  object(value,name);
  for(const key of Object.keys(value))assert(Object.hasOwn(defaults,key),`${name}: limite desconhecido ${key}.`,422);
  const result={...defaults,...value};
  for(const [key,n] of Object.entries(result))assert(Number.isSafeInteger(n) && n>0 && n<=ceilings[key],`${name}.${key}: limite inválido.`,422);
  return Object.freeze(result);
}

export function createAgentPolicy(input={}) {
  object(input,'Política');
  for(const key of Object.keys(input))assert(['version','modes','limits','run_limits'].includes(key),'Campo desconhecido na política.',422);
  assert(input.version===undefined || input.version===AGENT_POLICY_VERSION,'Versão da política não suportada.',422);
  const requested=input.modes ?? {};object(requested,'Modos');
  for(const [stage,mode] of Object.entries(requested)) {
    assert(STAGE_NAMES.includes(stage),'Etapa desconhecida na política.',422);
    assert(mode==='fixed/v1' || (['automation','requirements','tests'].includes(stage) && mode==='agent/v1'),'Modo não suportado para esta etapa.',422);
  }
  const modes=Object.freeze(Object.fromEntries(STAGE_NAMES.map(stage=>[stage,requested[stage] ?? 'fixed/v1'])));
  const session=limits(input.limits ?? {},DEFAULT_AGENT_LIMITS,'Limites da sessão');
  const run=limits(input.run_limits ?? {},DEFAULT_RUN_LIMITS,'Limites da análise');
  for(const key of Object.keys(run))assert(run[key]>=session[key],`Orçamento da análise inferior ao da sessão: ${key}.`,422);
  return Object.freeze({version:AGENT_POLICY_VERSION,modes,limits:session,run_limits:run});
}

// Old snapshots have no agent_policy. Reading them never changes the stored artifact.
export function resolveAgentPolicy(snapshot={}) {return createAgentPolicy(snapshot.agent_policy ?? {});}
export function agentMode(snapshot,stage) {
  assert(STAGE_NAMES.includes(stage),'Etapa desconhecida.',422);
  return resolveAgentPolicy(snapshot).modes[stage];
}
