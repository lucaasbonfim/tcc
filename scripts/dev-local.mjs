import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {root,setupLocalExecutor,startLocalExecutor,waitForExecutor,backendEnvironment} from './local-executor.mjs';

const children=[];let stopping=false;
function stop(code=0) {
  if(stopping)return;stopping=true;process.exitCode=code;
  for(const child of children)if(child.exitCode===null) {
    if(child.connected){child.send({type:'shutdown'},()=>{});const timer=setTimeout(()=>child.kill(),15000);timer.unref();}
    else child.kill();
  }
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
function track(child) {
  children.push(child);child.on('error',error=>{console.error(error.message);stop(1);});
  child.on('exit',code=>{if(!stopping){console.error('Um processo encerrou. Encerrando o ambiente local.');stop(code || 1);}});
  return child;
}
async function freePort(port) {
  for(const host of ['127.0.0.1','::1'])await new Promise((resolve,reject)=>{
    const server=createServer();server.once('error',error=>error.code==='EADDRNOTAVAIL' ? resolve() : reject(new Error(`Porta ${port} ocupada. Encerre o processo existente e execute novamente.`)));
    server.listen(port,host,()=>server.close(resolve));
  });
}
try {
  for(const port of [8091,3000,5173])await freePort(port);
  for(const file of ['backend/.env','backend/node_modules/express/package.json','frontend/node_modules/vite/bin/vite.js']) {
    try{await access(join(root,file));}catch{throw new Error(`Arquivo necessário ausente: ${file}. Instale as dependências/configure backend/.env conforme README.`);}
  }
  const config=await setupLocalExecutor();
  const executor=track(startLocalExecutor(config));await waitForExecutor(config,executor);
  const env={...process.env,...backendEnvironment(config),NODE_ENV:'development',FRONTEND_URL:'http://localhost:5173',PORT:'3000',HOST:'127.0.0.1'};
  const backend=join(root,'backend');
  track(spawn(process.execPath,['--env-file=.env','src/server.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore','inherit','inherit']}));
  for(let i=0;i<40;i++) {
    if(stopping)throw new Error('API não iniciou. Confira banco/configuração.');
    try{const response=await fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(1000)});if(response.ok)break;}catch{}
    if(i===39)throw new Error('API não respondeu. Confira banco/migrações.');
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  track(spawn(process.execPath,['--env-file=.env','src/research/worker.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore','inherit','inherit']}));
  track(spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost','--port','5173','--strictPort'],{
    cwd:join(root,'frontend'),env:{...process.env,NODE_ENV:'development',VITE_API_URL:'http://localhost:3000/api'},windowsHide:true,stdio:['ignore','inherit','inherit']}));
  console.log('\nAplicação: http://localhost:5173\nAPI: http://127.0.0.1:3000/api\nExecutor: Docker Desktop, desenvolvimento local.\nCtrl+C encerra os quatro processos.\n');
}catch(error){console.error(error.message);stop(1);}
