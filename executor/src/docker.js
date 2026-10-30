import {spawn} from 'node:child_process';
import {ensure,codePath} from '../../shared/execution-protocol.js';

export const LIMITS=Object.freeze({cpus:1,memory:268435456,pids:64,work_bytes:67108864,tmp_bytes:16777216,timeout_ms:60000,output_bytes:2097152});
export const immutableImage=value=>typeof value==='string' && /^(?:sha256:[a-f0-9]{64}|[a-zA-Z0-9][a-zA-Z0-9_./:-]*@sha256:[a-f0-9]{64})$/.test(value);
export function containerArguments(name,image,entrypoint='/opt/research/run.mjs') {
  ensure(/^research-[a-f0-9-]{36}$/.test(name) && immutableImage(image),'Invalid container/image');
  return ['create','--name',name,'--pull','never','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    '--network','none','--ipc','none','--pids-limit','64','--cpus','1','--memory','256m','--memory-swap','256m',
    '--ulimit','nofile=128:128','--user','1000:1000','--workdir','/project','--hostname','isolated-test',
    '--tmpfs','/work:rw,noexec,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=0700',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16m,uid=1000,gid=1000,mode=0700',
    '--tmpfs','/project:rw,noexec,nosuid,nodev,size=2m,uid=0,gid=0,mode=0555',
    '--log-driver','none','--stop-timeout','1','--label','tcc.research.executor=v1','-i','--entrypoint','/usr/local/bin/node',image,entrypoint];
}
export function docker(args,{input,timeout=10000,signal,maxBytes=LIMITS.output_bytes}={}) {
  return new Promise((resolve,reject)=>{
    // Only the service process can use Docker. No secrets are passed to this child.
    const child=spawn('docker',args,{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{PATH:process.env.PATH,HOME:process.env.HOME,XDG_RUNTIME_DIR:process.env.XDG_RUNTIME_DIR,DOCKER_HOST:process.env.DOCKER_HOST}});
    const stdout=[],stderr=[];let bytes=0,ended=false;
    const abort=()=>{child.kill('SIGKILL');};
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeout);
    function collect(which,chunk){bytes+=chunk.length;if(bytes>maxBytes){abort();return;}(which==='stdout' ? stdout : stderr).push(Buffer.from(chunk));}
    child.stdout.on('data',chunk=>collect('stdout',chunk));child.stderr.on('data',chunk=>collect('stderr',chunk));
    child.on('error',error=>{if(!ended){ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(error);}});
    child.on('close',(code,termination)=>{if(!ended){ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve({code,stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8'),terminated:Boolean(termination || signal?.aborted || bytes>maxBytes)});}});
    child.stdin.on('error',()=>{});child.stdin.end(input);
    if(signal?.aborted)abort();
  });
}

// Handcrafted regular-file tar: no extraction of untrusted archive metadata, symlinks, devices or permissions.
export function projectTar(bundle) {
  const chunks=[];
  for(const file of [...bundle.source_files,...bundle.generated_tests.flatMap(t=>t.files)]) {
    codePath(file.path);
    const content=Buffer.from(file.content ?? file.code,'utf8'),header=Buffer.alloc(512);
    const name=file.path;
    ensure(Buffer.byteLength(name)<=255,'Tar path too long');
    const split=name.lastIndexOf('/');
    const leaf=Buffer.byteLength(name)<=100 ? name : name.slice(split+1);
    const prefix=Buffer.byteLength(name)<=100 ? '' : name.slice(0,split);
    ensure(Buffer.byteLength(leaf)<=100 && Buffer.byteLength(prefix)<=155,'Tar path unsupported');
    header.write(leaf,0,100,'utf8');header.write('0000444\0',100,8);header.write('0000000\0',108,8);header.write('0000000\0',116,8);
    header.write(content.length.toString(8).padStart(11,'0')+'\0',124,12);header.write('00000000000\0',136,12);
    header.fill(32,148,156);header.write('0',156);header.write('ustar\0',257,6);header.write('00',263,2);header.write(prefix,345,155,'utf8');
    const checksum=header.reduce((n,b)=>n+b,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8);
    chunks.push(header,content,Buffer.alloc((512-content.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

export async function executeContainer(bundle,image,{runDocker=docker,signal}={}) {
  const name=`research-${bundle.job_id}`;
  let created=false;
  try {
    const creation=await runDocker(containerArguments(name,image));
    ensure(creation.code===0 && !creation.terminated,'Container creation failed');created=true;
    // Trusted runner waits for its bounded stdin. Sources are copied into a root-owned tmpfs,
    // never a host mount; the non-root test process has no write permission to files/parents.
    const started=await runDocker(['start',name]);
    ensure(started.code===0,'Container startup failed');
    const copied=await runDocker(['cp','-',`${name}:/project`],{input:projectTar(bundle)});
    ensure(copied.code===0 && !copied.terminated,'Read-only project preparation failed');
    const result=await runDocker(['attach','--sig-proxy=false',name],{input:JSON.stringify(bundle),timeout:LIMITS.timeout_ms,signal});
    if(result.terminated)return {status:signal?.aborted ? 'cancelled' : 'timeout',stdout:result.stdout,stderr:result.stderr};
    ensure(result.code===0,'Trusted runner failed');
    return {status:'reported',report:JSON.parse(result.stdout)};
  } finally {
    // Remove the entire container even when the attached docker client times out or disconnects.
    if(created) {
      const removed=await runDocker(['rm','-f',name],{timeout:10000});
      ensure(removed.code===0,'Container cleanup failed; executor must be disabled');
    }
  }
}
