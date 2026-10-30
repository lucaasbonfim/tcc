import {readFileSync,existsSync,statSync,writeFileSync,unlinkSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export function probe() {
  const status=readFileSync('/proc/self/status','utf8');
  const mounts=readFileSync('/proc/mounts','utf8').split('\n').map(line=>line.split(' '));
  const root=mounts.find(parts=>parts[1]==='/');
  const memory=readFileSync('/sys/fs/cgroup/memory.max','utf8').trim();
  const pids=readFileSync('/sys/fs/cgroup/pids.max','utf8').trim();
  const cpu=readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim();
  let projectWriteDenied=false;
  try{writeFileSync('/project/.write-probe','probe');unlinkSync('/project/.write-probe');}catch(error){projectWriteDenied=['EACCES','EROFS','EPERM'].includes(error.code);}
  const projectStat=statSync('/project');
  const checks={non_root:process.getuid()===1000,read_only_root:root?.[3].split(',').includes('ro'),
    project_write_denied:projectWriteDenied && projectStat.uid===0 && (projectStat.mode & 0o022)===0,
    no_capabilities:/CapEff:\s+0+\s/.test(status),no_new_privileges:/NoNewPrivs:\s+1/.test(status),seccomp:/Seccomp:\s+2/.test(status),
    memory:memory==='268435456',pids:pids==='64',cpu:cpu==='100000 100000',
    network_none:Object.keys(networkInterfaces()).every(name=>name==='lo'),no_socket:!existsSync('/var/run/docker.sock'),
    private_work:mounts.some(p=>p[1]==='/work' && p[2]==='tmpfs' && p[3].includes('size=65536k')),
    private_tmp:mounts.some(p=>p[1]==='/tmp' && p[2]==='tmpfs' && p[3].includes('size=16384k')),
    no_application_secrets:!['GEMINI_API_KEY','DB_PASSWORD','AUTH_SECRET','EXECUTOR_TOKEN'].some(key=>process.env[key])};
  if(!Object.values(checks).every(Boolean))throw new Error('Isolation probe failed: '+Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(','));
  const java={};
  if(existsSync('/opt/research/junit.jar')) {
    const javac=spawnSync('javac',['-version'],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH}});
    const junit=spawnSync('java',['-Xmx64m','-jar','/opt/research/junit.jar','--version'],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH}});
    if(javac.status!==0 || junit.status!==0)throw new Error('JDK/JUnit provisioning probe failed');
    java.junit_sha256=createHash('sha256').update(readFileSync('/opt/research/junit.jar')).digest('hex');
    java.javac_version=(javac.stdout+javac.stderr).trim().slice(0,200);java.junit_version=(junit.stdout+junit.stderr).trim().slice(0,200);
  }
  return {checks,node:process.version,...java};
}
if(process.argv[1]?.endsWith('/probe.mjs'))process.stdout.write(JSON.stringify(probe()));
