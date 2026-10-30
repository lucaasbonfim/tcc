import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {docker,containerArguments,immutableImage} from './docker.js';
import {ensure,sha256} from '../../shared/execution-protocol.js';
const exec=promisify(execFile);

export async function validateIsolation(policy,{runDocker=docker,virtualization}={}) {
  ensure(policy?.dedicated_vm===true && typeof policy.deployment_id==='string' && policy.deployment_id.length>=8,'Dedicated VM policy missing');
  ensure(process.platform==='linux' || virtualization,'Executor requires a dedicated Linux VM');
  const vm=virtualization || (await exec('systemd-detect-virt',['--vm'],{timeout:5000,env:{PATH:process.env.PATH}})).stdout.trim();
  ensure(vm && !['none','docker','podman','lxc','wsl'].includes(vm),'Dedicated virtual machine not detected');
  const info=await runDocker(['info','--format','{{json .}}']);
  ensure(info.code===0,'Docker unavailable');
  const runtime=JSON.parse(info.stdout);
  ensure(runtime.OSType==='linux' && runtime.CgroupVersion==='2' && runtime.CgroupDriver==='systemd' &&
    runtime.SecurityOptions?.some(s=>s.includes('rootless')) && runtime.SecurityOptions?.some(s=>s.includes('seccomp')),
    'Rootless Docker, seccomp and delegated cgroup v2/systemd are required');
  const images={};
  for(const [adapter,image] of Object.entries(policy.images || {})) {
    ensure(['node-test/v2','java-junit/v1'].includes(adapter) && immutableImage(image),'Unknown adapter or unpinned image');
    const found=await runDocker(['image','inspect',image,'--format','{{.Id}}']);
    ensure(found.code===0 && /^sha256:[a-f0-9]{64}$/.test(found.stdout.trim()),'Provisioned image missing');
    const name=`research-${randomUUID()}`;
    try {
      ensure((await runDocker(containerArguments(name,image,'/opt/research/probe.mjs'))).code===0,'Probe creation failed');
      const probe=await runDocker(['start','-a',name],{timeout:15000});
      ensure(probe.code===0 && !probe.terminated,'Isolation probe failed');
      const report=JSON.parse(probe.stdout);
      ensure(report.checks && Object.keys(report.checks).length>=12 && Object.values(report.checks).every(v=>v===true),'Isolation controls not verified');
      if(adapter==='java-junit/v1') {
        // Image has the exact same isolation probe; compilation/JUnit availability is verified again by each actual job.
        ensure(policy.java_junit_provisioned===true,'JUnit image provisioning not acknowledged');
      }
      images[adapter]={reference:image,image_id:found.stdout.trim(),probe:report};
    } finally {ensure((await runDocker(['rm','-f',name])).code===0,'Probe cleanup failed');}
  }
  ensure(Object.keys(images).length>0,'No supported image provisioned');
  return {ready:true,protocol_version:1,deployment_id:policy.deployment_id,policy_sha256:sha256(policy),vm,
    validated_at:new Date().toISOString(),images,limits:{cpu:1,memory_bytes:268435456,pids:64,timeout_ms:60000,network:'none',project_tmpfs_bytes:2097152,work_tmpfs_bytes:67108864}};
}
