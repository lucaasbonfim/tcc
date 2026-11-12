import {randomUUID} from 'node:crypto';
import {assert,text,uuid} from '../shared/errors.js';
import {createExecutorClient} from '../services/executor-client.js';
import {sha256} from '../../../../shared/execution-protocol.js';
import {appendRunEvent} from '../storage/run-events.js';
export const isEligible=row=>row.review_status==='approved' || (row.review_status==='pending' && row.processing_status==='eligible');
export function environmentIdentity(receipt,adapter) {return {deployment_id:receipt.deployment_id,policy_sha256:receipt.policy_sha256,image_id:receipt.images?.[adapter]?.image_id,isolation_profile:receipt.isolation_profile || 'dedicated-vm',development_only:Boolean(receipt.development_only)};}
export async function prepareWorkflowPolicy({db,store,version,input,executorClient=createExecutorClient()}) {
  const mode=input.workflow_mode ?? 'assisted/v1';assert(['assisted/v1','autonomous/v1'].includes(mode),'Modo de trabalho inválido.',422);
  if(mode==='assisted/v1')return {version:1,mode};
  const consent=input.autonomy;assert(consent && consent.authorize_execution===true,'Autorize explicitamente o escopo de execução autônoma.',422);
  uuid(consent.inspection_id);assert(typeof consent.module_root==='string' && consent.module_root.length<=240,'Escolha o módulo da autorização.',422);
  const justification=text(consent.justification,'Justificativa da autorização inicial',5000,true);
  const inspection=(await db.query('SELECT * FROM research.inspections WHERE id=$1 AND code_version_id=$2',[consent.inspection_id,version.id])).rows[0];assert(inspection,'Inspeção fora da versão autorizada.',403);
  const artifact=await store.json(inspection.artifact),module=artifact.modules.find(m=>m.root===consent.module_root);
  assert(artifact.commit_sha===version.commit_sha && artifact.repository_url===version.repository_url,'Inspeção diverge do código autorizado.',422);
  assert(module?.targets.length && ['node-test/v2','java-junit/v1'].includes(module.adapter),'Módulo não executável pelos adaptadores atuais.',422);
  const receipt=await executorClient.health();assert(receipt.ready && receipt.images?.[module.adapter],receipt.reason || 'Executor indisponível para autorização inicial.',503);
  return {version:1,mode,grant:{id:randomUUID(),actor:'admin',authorized_at:new Date().toISOString(),justification,inspection_id:inspection.id,inspection_sha256:inspection.artifact.sha256,module_root:module.root,adapter:module.adapter,commit_sha:version.commit_sha,repository_url:version.repository_url,environment:environmentIdentity(receipt,module.adapter),limits:{max_scripts:200,max_bundles:200,execution_cycles:1},proposed_revisions:'record_only'}};
}
export async function assertInitialGrant(db,run,store) {
  const snapshot=await store.json(run.snapshot),policy=snapshot.workflow_policy;
  assert(run.workflow_mode==='autonomous/v1' && policy?.mode==='autonomous/v1' && policy.grant,'Esta operação requer autorização autônoma inicial.',409);
  const row=(await db.query('SELECT * FROM research.run_grants WHERE run_id=$1 AND id=$2',[run.id,policy.grant.id])).rows[0];assert(row && sha256(await store.json(row.policy))===sha256(policy),'Autorização inicial não encontrada ou divergente.',409);
  assert(policy.grant.commit_sha===snapshot.code_version.commit_sha,'Código diverge da autorização inicial.',409);return policy.grant;
}
export async function admitProduced(db,run,stage,table,store) {
  await assertInitialGrant(db,run,store);assert(['requirements','test_cases','automated_tests'].includes(table),'Tipo de admissão inválido.',422);
  const rows=(await db.query(`UPDATE research.${table} SET processing_status='eligible' WHERE run_id=$1 AND review_status='pending' ${table==='automated_tests'?"AND compatibility='compatible'":''} RETURNING id,revision`,[run.id])).rows;
  await appendRunEvent(db,{run_id:run.id,source_key:`admission:${stage.id}`,stage_id:stage.id,kind:'artifacts_admitted',payload:{entity_type:table,ids:rows.map(r=>r.id),count:rows.length,human_approval:false,grant_id:(await store.json(run.snapshot)).workflow_policy.grant.id}});return rows;
}
export function assertEnvironmentGrant(grant,receipt,adapter) {assert(grant.adapter===adapter && sha256(environmentIdentity(receipt,adapter))===sha256(grant.environment),'Ambiente diverge da autorização inicial. Inicie outra análise.',422);}
