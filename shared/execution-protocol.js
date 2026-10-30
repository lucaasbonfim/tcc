import {createHash} from 'node:crypto';

export const PROTOCOL_VERSION=1;
export const TEST_STATUSES=['passed','failed','test_error','compilation_error','infrastructure_error','dependency_unavailable','timeout','cancelled','unsupported','inconclusive','skipped'];
export const JOB_STATUSES=['completed','infrastructure_error','timeout','cancelled','unsupported'];
export function ensure(condition,message) {if(!condition)throw new Error(message);}
export function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const sha256=value=>createHash('sha256').update(typeof value==='string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
export const isUuid=value=>typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function codePath(path) {
  ensure(typeof path==='string' && path.length<=240 && /^[A-Za-z0-9_./@-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(s=>!s || s==='.' || s==='..'),'Invalid code path');
  ensure(!/(?:^|\/)(?:\.git|node_modules|\.env|target|dist|build)(?:\/|$)/.test(path),'Forbidden project path');
  return path;
}
export function validateBundle(bundle) {
  ensure(bundle?.protocol_version===1 && isUuid(bundle.job_id) && isUuid(bundle.run_id),'Invalid execution identity');
  ensure(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(bundle.repository_url) && /^[a-f0-9]{40}$/.test(bundle.commit_sha),'Invalid repository version');
  ensure(['node-test/v2','java-junit/v1'].includes(bundle.adapter),'Unsupported adapter');
  ensure(Array.isArray(bundle.source_files) && bundle.source_files.length>0 && bundle.source_files.length<=16,'Invalid source file count');
  ensure(Array.isArray(bundle.generated_tests) && bundle.generated_tests.length>0 && bundle.generated_tests.length<=20,'Invalid generated tests');
  const paths=new Set(),ids=new Set();
  for(const file of bundle.source_files) {
    codePath(file.path);ensure(!file.path.startsWith('__research_generated__/') && !paths.has(file.path),'Source collision');paths.add(file.path);
    ensure(typeof file.content==='string' && Buffer.byteLength(file.content)<=30000 && sha256(file.content)===file.sha256,'Source hash/size mismatch');
    ensure(/^[a-f0-9]{40}$/.test(file.git_sha) && createHash('sha1').update(`blob ${Buffer.byteLength(file.content)}\0`).update(file.content).digest('hex')===file.git_sha,'Git blob mismatch');
  }
  for(const test of bundle.generated_tests) {
    ensure(isUuid(test.id) && isUuid(test.test_case_id) && !ids.has(test.id) && Number.isInteger(test.version) && test.version>0,'Invalid artifact identity');ids.add(test.id);
    ensure(Array.isArray(test.files) && test.files.length===1,'One file per generated artifact required');
    const compact=test.test_case_id.replaceAll('-','');
    const expected=bundle.adapter==='node-test/v2' ? `__research_generated__/ct_${compact}.test.mjs` : `__research_generated__/Research${compact}.java`;
    const file=test.files[0];codePath(file.path);
    ensure(file.path===expected && !paths.has(file.path),'Invalid generated file path');paths.add(file.path);
    ensure(typeof file.code==='string' && Buffer.byteLength(file.code)<=40000 && sha256(file.code)===file.sha256,'Generated hash/size mismatch');
  }
  ensure(Buffer.byteLength(JSON.stringify(bundle))<=1048576,'Bundle too large');
  return bundle;
}
export function validateExecutionResult(result,bundle,requestHash) {
  ensure(result?.protocol_version===1 && result.job_id===bundle.job_id && result.request_sha256===requestHash && result.commit_sha===bundle.commit_sha && result.adapter===bundle.adapter,'Evidence does not belong to authorized job');
  ensure(JOB_STATUSES.includes(result.status),'Invalid execution status');
  ensure(typeof result.environment==='object' && result.environment && /^sha256:[a-f0-9]{64}$/.test(result.environment.image_id),'Missing immutable environment');
  ensure(Number.isFinite(Date.parse(result.started_at)) && Number.isFinite(Date.parse(result.finished_at)) && Date.parse(result.finished_at)>=Date.parse(result.started_at),'Invalid execution dates');
  ensure(Number.isInteger(result.duration_ms) && result.duration_ms>=0 && (result.exit_code===null || Number.isInteger(result.exit_code)),'Invalid timing/exit code');
  ensure(typeof result.stdout==='string' && result.stdout.length<=200000 && typeof result.stderr==='string' && result.stderr.length<=200000,'Execution logs exceed limit');
  ensure(Array.isArray(result.commands) && result.commands.length<=50 && result.commands.every(c=>Array.isArray(c.argv) && c.argv.length<=50 && c.argv.every(v=>typeof v==='string' && v.length<=300)),'Invalid command evidence');
  ensure(Array.isArray(result.tests) && result.tests.length>0 && result.tests.length<=200,'Missing individual results');
  const seen=new Set();
  for(const row of result.tests) {
    const original=bundle.generated_tests.find(t=>t.id===row.artifact_id && t.test_case_id===row.test_case_id);
    ensure(original && TEST_STATUSES.includes(row.status) && typeof row.test_name==='string' && typeof row.observed==='string' && row.observed.length<=20000,'Unbound test evidence');seen.add(row.artifact_id);
  }
  ensure(bundle.generated_tests.every(t=>seen.has(t.id)),'Generated artifact missing from results');
  ensure(Array.isArray(result.limitations) && result.limitations.every(s=>typeof s==='string'),'Missing execution limitations');
  ensure(Buffer.byteLength(JSON.stringify(result))<=2097152,'Evidence exceeds limit');
  return result;
}
