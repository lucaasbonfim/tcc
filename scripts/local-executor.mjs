import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {sha256} from '../shared/execution-protocol.js';

const exec=promisify(execFile);
export const root=fileURLToPath(new URL('../',import.meta.url));
const directory=join(root,'.local','executor-dev');
const nodeBase='node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914';
export async function provisionJava({docker=runDocker,fetchImpl=fetch}={}) {
  const lock=JSON.parse(await readFile(join(root,'executor/images/java-lock.json'),'utf8'));
  const vendor=join(root,'executor/vendor'),jar=join(vendor,'junit-platform-console-standalone.jar');
  let bytes;
  try{bytes=await readFile(jar);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!bytes || sha256(bytes)!==lock.junit_sha256) {
    console.log('Baixando JUnit do Maven Central e verificando SHA-256...');
    const response=await fetchImpl(lock.junit_url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Download do JUnit indisponível. Nenhuma imagem Java foi habilitada.');
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>8*1024*1024)throw new Error('JUnit excede o tamanho permitido.');chunks.push(chunk);}
    bytes=Buffer.concat(chunks);
    if(sha256(bytes)!==lock.junit_sha256)throw new Error('Checksum do JUnit divergente. Nenhuma imagem Java foi habilitada.');
    await mkdir(vendor,{recursive:true});await writeFile(jar,bytes);
  }
  try{await docker(['image','inspect',lock.java_base]);}catch{await docker(['pull',lock.java_base]);}
  console.log('Preparando imagem Java/JUnit do executor local...');
  await docker(['build','--network=none','--build-arg',`NODE_BASE=${nodeBase}`,'--build-arg',`JAVA_BASE=${lock.java_base}`,
    '--build-arg',`JUNIT_SHA256=${lock.junit_sha256}`,'-f','executor/images/Dockerfile.java','-t','tcc-executor-java:local-dev','.']);
  const image=await docker(['image','inspect','tcc-executor-java:local-dev','--format','{{.Id}}']);
  return {image,junit_sha256:lock.junit_sha256};
}
export function systemEnvironment() {
  const keys=new Set(['PATH','SYSTEMROOT','WINDIR','USERPROFILE','HOME','DOCKER_CONFIG','DOCKER_HOST','DOCKER_CONTEXT','XDG_RUNTIME_DIR','TEMP','TMP','APPDATA','LOCALAPPDATA','COMSPEC']);
  return Object.fromEntries(Object.entries(process.env).filter(([key])=>keys.has(key.toUpperCase())));
}
async function runDocker(args) {
  return (await exec('docker',args,{cwd:root,env:systemEnvironment(),windowsHide:true,timeout:180000,maxBuffer:2097152})).stdout.trim();
}
export async function readLocalConfiguration() {
  return JSON.parse(await readFile(join(directory,'config.json'),'utf8'));
}
export function backendEnvironment(config) {
  return {EXECUTOR_MODE:'docker-desktop-dev',EXECUTOR_URL:'http://127.0.0.1:8091',EXECUTOR_TOKEN:config.token,
    EXECUTOR_DEPLOYMENT_ID:config.policy.deployment_id,EXECUTOR_POLICY_SHA256:sha256(config.policy)};
}
export async function setupLocalExecutor() {
  if(process.env.NODE_ENV==='production')throw new Error('Use este comando somente em desenvolvimento.');
  const info=JSON.parse(await runDocker(['info','--format','{{json .}}']));
  if(info.OperatingSystem!=='Docker Desktop' || info.OSType!=='linux')throw new Error('Ligue o Docker Desktop com contêineres Linux antes de iniciar.');
  const endpoint=await runDocker(['context','inspect','--format','{{.Endpoints.docker.Host}}']);
  console.log('Preparando imagem Node do executor local...');
  try{await runDocker(['image','inspect',nodeBase]);}catch{await runDocker(['pull',nodeBase]);}
  await runDocker(['build','--network=none','--build-arg',`NODE_BASE=${nodeBase}`,'-f','executor/images/Dockerfile.node','-t','tcc-executor-node:local-dev','.']);
  const image=await runDocker(['image','inspect','tcc-executor-node:local-dev','--format','{{.Id}}']);
  const java=await provisionJava();
  let previous;
  try{previous=await readLocalConfiguration();}catch(error){if(error.code!=='ENOENT')throw error;}
  const policy={mode:'docker-desktop-dev',dedicated_vm:false,deployment_id:previous?.policy.deployment_id || `desktop-dev-${randomUUID()}`,
    images:{'node-test/v2':image,'java-junit/v1':java.image},java_junit_provisioned:true,junit_sha256:java.junit_sha256};
  const config={token:previous?.token || randomBytes(48).toString('hex'),docker_host:endpoint,policy};
  await mkdir(directory,{recursive:true,mode:0o700});
  await writeFile(join(directory,'policy.json'),JSON.stringify(policy,null,2),{mode:0o600});
  await writeFile(join(directory,'config.json'),JSON.stringify(config,null,2),{mode:0o600});
  return config;
}
export function startLocalExecutor(config) {
  return spawn(process.execPath,['src/server.js'],{cwd:join(root,'executor'),stdio:['ignore','inherit','inherit','ipc'],windowsHide:true,
    env:{...systemEnvironment(),NODE_ENV:'development',DOCKER_HOST:config.docker_host,DOCKER_CONTEXT:'',EXECUTOR_TOKEN:config.token,
      EXECUTOR_BIND:'127.0.0.1',EXECUTOR_PORT:'8091',EXECUTOR_POLICY_FILE:join(directory,'policy.json'),EXECUTOR_JOURNAL_DIR:join(directory,'journal')}});
}
export async function waitForExecutor(config,child) {
  for(let i=0;i<60;i++) {
    if(child.exitCode!==null)throw new Error('Executor local encerrou antes de ficar disponível.');
    try {
      const response=await fetch('http://127.0.0.1:8091/v1/health',{headers:{Authorization:`Bearer ${config.token}`},signal:AbortSignal.timeout(1000)});
      if(response.ok){const receipt=await response.json();if(!receipt.ready)throw Object.assign(new Error(receipt.reason || 'Executor bloqueado.'),{blocked:true});
        if(receipt.deployment_id!==config.policy.deployment_id || receipt.policy_sha256!==sha256(config.policy) || receipt.isolation_profile!=='docker-desktop-dev')throw Object.assign(new Error('Já existe outro executor na porta 8091.'),{blocked:true});
        return receipt;}
    }catch(error){if(error.blocked)throw error;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('Executor local não respondeu em 30 segundos.');
}

if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  let child;
  try {
    if(!['setup','start'].includes(process.argv[2]))throw new Error('Use npm run executor:setup ou npm run executor:local.');
    const config=await setupLocalExecutor();
    if(process.argv[2]==='start') {
      child=startLocalExecutor(config);await waitForExecutor(config,child);
      console.log('Executor Docker Desktop disponível em loopback. Ctrl+C encerra.');
      for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
      child.on('exit',code=>{process.exitCode=code || 0;});
    } else console.log('Imagem/política local preparadas. Use npm run dev:local para iniciar a aplicação.');
  }catch(error){child?.kill();console.error(error.message);process.exitCode=1;}
}
