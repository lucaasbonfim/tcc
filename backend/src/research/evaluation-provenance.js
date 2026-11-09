import {assert} from './errors.js';
import {sha256} from '../../../shared/execution-protocol.js';

// Check the immutable authorization and bundle again at the evaluation boundary.
// A valid current script is not sufficient evidence that this version was executed.
export function verifyEvaluationProvenance({runId,result,script,job,bundle,plan,manifest,evidence}) {
  assert(job && job.run_id===runId && bundle.run_id===runId && bundle.job_id===job.id && result.job_id===job.id,'Trabalho fora da execução avaliada.',409);
  assert(sha256(bundle)===job.request_sha256,'Bundle da avaliação diverge do trabalho autorizado.',409);
  assert(evidence && evidence.job_id===job.id && evidence.request_sha256===job.request_sha256 && evidence.commit_sha===bundle.commit_sha,'Evidência diverge do bundle executado.',409);
  const executed=bundle.generated_tests.find(row=>row.id===result.automated_test_id);
  assert(script && executed && executed.test_case_id===result.test_case_id && script.test_case_id===executed.test_case_id && script.version===executed.version,'Versão do script diverge da execução; avaliação bloqueada.',409);
  const files=rows=>rows.map(({path,code})=>({path,code})).sort((a,b)=>a.path.localeCompare(b.path));
  assert(sha256(files(script.files_data))===sha256(files(executed.files)) && executed.files.every(file=>file.sha256===sha256(file.code)),'Código do script diverge do executado; avaliação bloqueada.',409);
  assert(plan && plan.run_id===runId && plan.id===job.plan_id,'Plano da avaliação não encontrado.',409);
  if(plan.format_version===1) {
    const pinned=manifest.scripts?.find(row=>row.id===script.id),group=manifest.bundles?.find(row=>row.job_id===job.id);
    assert(manifest.run_id===runId && manifest.commit_sha===bundle.commit_sha && group?.sha256===job.request_sha256 && group.script_ids.includes(script.id),'Bundle fora do manifesto autorizado.',409);
    assert(pinned?.test_case_id===script.test_case_id && pinned.version===script.version && pinned.revision===script.revision && pinned.files.sha256===script.files.sha256,'Script/revisão diverge do manifesto; avaliação bloqueada.',409);
  } else assert(plan.format_version===0,'Formato de plano desconhecido.',409);
  return {job_id:job.id,plan_id:plan.id,request_sha256:job.request_sha256,commit_sha:bundle.commit_sha,script_version:executed.version,manifest_format:plan.format_version};
}
