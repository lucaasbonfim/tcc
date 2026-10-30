import {timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {validateBundle,sha256,ensure,isUuid,validateExecutionResult} from '../../shared/execution-protocol.js';
import {executeContainer,docker} from './docker.js';

export async function verifyRepositoryMembership(bundle,fetchImpl=fetch) {
  const path=bundle.repository_url.replace('https://github.com/','');
  const response=await fetchImpl(`https://api.github.com/repos/${path}/git/trees/${bundle.commit_sha}?recursive=1`,{
    redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/vnd.github+json','User-Agent':'tcc-isolated-executor'}});
  ensure(response.ok,'Immutable repository verification unavailable');
  const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;ensure(bytes<=1048576,'Repository tree too large');chunks.push(Buffer.from(chunk));}
  const tree=JSON.parse(Buffer.concat(chunks).toString('utf8'));ensure(!tree.truncated && Array.isArray(tree.tree),'Incomplete repository tree');
  for(const file of bundle.source_files)ensure(tree.tree.some(entry=>entry.path===file.path && entry.sha===file.git_sha && entry.type==='blob' && ['100644','100755'].includes(entry.mode)),'Source not present in requested Git commit');
}

export function authorized(header,secret) {
  if(typeof header!=='string' || typeof secret!=='string' || secret.length<32)return false;
  const a=Buffer.from(header),b=Buffer.from(`Bearer ${secret}`);
  return a.length===b.length && timingSafeEqual(a,b);
}
export function createExecutionService({token,status,policy,root,execute=executeContainer,verify=verifyRepositoryMembership,
  cleanup=async id=>ensure((await docker(['rm','-f',`research-${id}`])).code===0,'Orphan cleanup failed')}) {
  ensure(typeof token==='string' && token.length>=32,'Executor authentication token too short');
  const directory=resolve(root),jobs=new Map();let active=false,closed=false;
  const environmentFor=image=>({deployment_id:status.deployment_id,policy_sha256:status.policy_sha256,image_id:image.image_id,limits:status.limits,
    isolation_profile:status.isolation_profile || 'dedicated-vm',development_only:status.development_only===true,runtime:status.runtime});
  async function persist(job) {
    await mkdir(directory,{recursive:true,mode:0o700});
    const file=resolve(directory,`${job.bundle.job_id}.json`);ensure(dirname(file)===directory,'Invalid job journal path');
    await writeFile(file,JSON.stringify({...job,controller:undefined}),{mode:0o600});
  }
  function unavailable(bundle,statusName,message,environment,start) {
    return {protocol_version:1,job_id:bundle.job_id,request_sha256:sha256(bundle),adapter:bundle.adapter,commit_sha:bundle.commit_sha,status:statusName,
      environment,started_at:start,finished_at:new Date().toISOString(),duration_ms:Date.now()-Date.parse(start),exit_code:null,commands:[],stdout:'',stderr:message.slice(0,20000),
      tests:bundle.generated_tests.map(t=>({artifact_id:t.id,test_case_id:t.test_case_id,test_name:t.files[0].path,status:statusName,observed:message.slice(0,20000)})),
      limitations:['Nenhum resultado de infraestrutura constitui prova de defeito funcional.']};
  }
  async function drain() {
    if(active || closed || !status.ready || Date.now()-Date.parse(status.validated_at)>=3600000)return;
    const job=[...jobs.values()].find(j=>j.status==='pending');if(!job)return;
    active=true;job.status='running';job.controller=new AbortController();
    const started=new Date().toISOString(),image=status.images[job.bundle.adapter];
    const environment=environmentFor(image);
    try {
      await persist(job);
      await verify(job.bundle);
      if(job.cancelled)throw new Error('Execution cancelled');
      const outcome=await execute(job.bundle,image.reference,{signal:job.controller.signal});
      if(outcome.status==='reported') {
        const report=outcome.report;
        job.result={protocol_version:1,job_id:job.bundle.job_id,request_sha256:job.hash,adapter:job.bundle.adapter,
          commit_sha:job.bundle.commit_sha,status:job.cancelled ? 'cancelled' : 'completed',environment,
          started_at:report.started_at,finished_at:report.finished_at,duration_ms:report.duration_ms,exit_code:report.exit_code,
          commands:report.commands,tests:report.tests,stdout:report.stdout,stderr:report.stderr,framework_reports:report.framework_reports,
          limitations:['Resultados limitados aos testes gerados selecionados; não comprovam cobertura integral.','Asserções dependem da revisão humana do esperado e do código.']};
      }
      else {
        job.result=unavailable(job.bundle,outcome.status,'Execução interrompida pelo limite ou cancelamento.',environment,started);
        job.result.stdout=(outcome.stdout || '').slice(0,150000);
        job.result.stderr=(outcome.stderr || job.result.stderr).slice(0,150000);
        job.result.limitations.push('Runner interrompido: comandos/eventos internos podem não ter sido recuperados; ausência de eventos não comprova início de cada teste.');
      }
      validateExecutionResult(job.result,job.bundle,job.hash);
    } catch(error) {
      if(error.message?.includes('cleanup')){status.ready=false;status.reason='Cleanup failure; operator intervention required';}
      job.result=unavailable(job.bundle,job.cancelled ? 'cancelled' : 'infrastructure_error','Preparação/execução falhou; nenhum defeito funcional foi inferido.',environment,started);
    } finally {
      job.status='finished';job.controller=null;
      try{await persist(job);}catch{status.ready=false;status.reason='Journal storage failed';}
      active=false;queueMicrotask(drain);
    }
  }
  return {
    async recover() {
      await mkdir(directory,{recursive:true,mode:0o700});
      const files=await readdir(directory);ensure(files.length<=128,'Job journal quota reached; archive completed journals before restarting');
      for(const file of files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f))) {
        const job=JSON.parse(await readFile(resolve(directory,file),'utf8'));validateBundle(job.bundle);
        if(job.status!=='finished') {
          try{await cleanup(job.bundle.job_id);}catch{status.ready=false;status.reason='Orphan container cleanup failed';throw new Error(status.reason);}
          // On restart, never rerun a previously accepted untrusted job automatically.
          const image=status.images?.[job.bundle.adapter];
          if(!image)continue;
          job.status='finished';job.result=unavailable(job.bundle,'infrastructure_error','Executor reiniciado; resultado anterior indisponível.',environmentFor(image),new Date().toISOString());
        }
        jobs.set(job.bundle.job_id,job);
      }
    },
    async handle(request,response) {
      response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
      const send=(code,data)=>{response.statusCode=code;response.end(JSON.stringify(data));};
      if(!authorized(request.headers.authorization,token))return send(401,{error:'Unauthorized'});
      if(request.method==='GET' && request.url==='/v1/health')return send(200,{...status,ready:status.ready && !closed && Date.now()-Date.parse(status.validated_at)<3600000});
      const match=request.url.match(/^\/v1\/jobs\/([a-f0-9-]{36})$/);
      if(request.method==='GET' && match)return jobs.has(match[1]) ? send(200,{status:jobs.get(match[1]).status,result:jobs.get(match[1]).result || null}) : send(404,{error:'Job not found'});
      if(request.method==='DELETE' && match) {
        const job=jobs.get(match[1]);if(!job)return send(404,{error:'Job not found'});
        job.cancelled=true;job.controller?.abort();
        if(job.status==='pending')queueMicrotask(drain);
        return send(202,{status:'cancellation_requested'});
      }
      if(request.method!=='POST' || request.url!=='/v1/jobs')return send(404,{error:'Not found'});
      if(!status.ready || closed || Date.now()-Date.parse(status.validated_at)>=3600000)return send(503,{error:'Isolation not validated'});
      try {
        const chunks=[];let bytes=0;for await(const chunk of request){bytes+=chunk.length;ensure(bytes<=1100000,'Request too large');chunks.push(Buffer.from(chunk));}
        const {bundle,request_sha256}=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateBundle(bundle);const hash=sha256(bundle);ensure(hash===request_sha256,'Request hash mismatch');
        ensure(status.images[bundle.adapter],'Adapter image unavailable');
        const current=jobs.get(bundle.job_id);
        if(current)return current.hash===hash ? send(202,{job_id:bundle.job_id,status:current.status}) : send(409,{error:'Job identity already used for another bundle'});
        ensure(jobs.size<128 && [...jobs.values()].filter(j=>j.status!=='finished').length<8,'Executor queue/storage quota reached');
        const job={bundle,hash,status:'pending',result:null,cancelled:false};jobs.set(bundle.job_id,job);
        try{await persist(job);}catch(error){jobs.delete(bundle.job_id);throw error;}
        send(202,{job_id:bundle.job_id,status:'pending'});queueMicrotask(drain);
      }catch{send(422,{error:'Invalid or unsupported execution request'});}
    },
    async close(){closed=true;for(const job of jobs.values())job.controller?.abort();},
  };
}
