import {assert} from '../errors.js';

export const AGENT_CONTRACT_VERSION='1.0.0';
export const SESSION_STATES=Object.freeze(['pending','running','interrupted','completed','failed','cancelled','exhausted']);
const transitions={pending:['running','cancelled'],running:['interrupted','completed','failed','cancelled','exhausted'],interrupted:['running','failed','cancelled','exhausted'],completed:[],failed:[],cancelled:[],exhausted:[]};
export function assertSessionTransition(from,to) {
  assert(transitions[from]?.includes(to),'Transição de sessão inválida.',409);
}
export function stageStatusForSession(status) {
  assert(SESSION_STATES.includes(status),'Estado de sessão inválido.',422);
  return ({pending:'pending',running:'running',interrupted:'failed',completed:'awaiting_review',failed:'failed',cancelled:'cancelled',exhausted:'failed'})[status];
}
