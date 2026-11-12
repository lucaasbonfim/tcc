import {assert} from '../errors.js';

export const AGENT_POLICY_VERSION='1.2.0';
export const DEFAULT_MODEL_RETRY=Object.freeze({max_attempts:4,initial_delay_ms:5000,max_delay_ms:20000});
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
  for(const key of Object.keys(input))assert(['version','modes','limits','run_limits','model_retry'].includes(key),'Campo desconhecido na política.',422);
  const version=input.version ?? AGENT_POLICY_VERSION;
  assert(['1.0.0','1.1.0',AGENT_POLICY_VERSION].includes(version),'Versão da política não suportada.',422);
  assert(version!=='1.0.0' || input.model_retry===undefined,'Política antiga não admite retentativas.',422);
  const retryDefaults={...DEFAULT_MODEL_RETRY,...(version==='1.2.0'?{respect_retry_after:true}:{})};
  const retry={...retryDefaults,...(input.model_retry ?? {})};
  if(input.model_retry!==undefined)object(input.model_retry,'Retentativas');
  for(const key of Object.keys(retry))assert(Object.hasOwn(retryDefaults,key),'Campo desconhecido nas retentativas.',422);
  if(version==='1.2.0')assert(typeof retry.respect_retry_after==='boolean','Política de espera do provedor inválida.',422);
  assert(Number.isSafeInteger(retry.max_attempts) && retry.max_attempts>=1 && retry.max_attempts<=4,'Limite de retentativas inválido.',422);
  for(const key of ['initial_delay_ms','max_delay_ms'])assert(Number.isSafeInteger(retry[key]) && retry[key]>=1 && retry[key]<=60000,'Espera de retentativa inválida.',422);
  assert(retry.max_delay_ms>=retry.initial_delay_ms,'Espera máxima inferior à inicial.',422);
  const requested=input.modes ?? {};object(requested,'Modos');
  for(const [stage,mode] of Object.entries(requested)) {
    assert(STAGE_NAMES.includes(stage),'Etapa desconhecida na política.',422);
    assert(mode==='fixed/v1' || mode==='agent/v1','Modo não suportado para esta etapa.',422);
  }
  const modes=Object.freeze(Object.fromEntries(STAGE_NAMES.map(stage=>[stage,requested[stage] ?? 'fixed/v1'])));
  const session=limits(input.limits ?? {},DEFAULT_AGENT_LIMITS,'Limites da sessão');
  const run=limits(input.run_limits ?? {},DEFAULT_RUN_LIMITS,'Limites da análise');
  for(const key of Object.keys(run))assert(run[key]>=session[key],`Orçamento da análise inferior ao da sessão: ${key}.`,422);
  return Object.freeze({version,modes,limits:session,run_limits:run,...(version==='1.0.0'?{}:{model_retry:Object.freeze(retry)})});
}

// Old snapshots have no agent_policy. Reading them never changes the stored artifact.
export function resolveAgentPolicy(snapshot={}) {return createAgentPolicy({version:'1.0.0',...(snapshot.agent_policy ?? {})});}
export function agentMode(snapshot,stage) {
  assert(STAGE_NAMES.includes(stage),'Etapa desconhecida.',422);
  return resolveAgentPolicy(snapshot).modes[stage];
}
