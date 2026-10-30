import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createServer as createTlsServer} from 'node:https';
import {createExecutionService} from './service.js';
import {validateIsolation} from './isolation.js';
import {ensure} from '../../shared/execution-protocol.js';

const policy=JSON.parse(await readFile(process.env.EXECUTOR_POLICY_FILE || './policy.local.json','utf8'));
let status;
const bind=process.env.EXECUTOR_BIND || '127.0.0.1';
if(policy.mode==='docker-desktop-dev')ensure(['127.0.0.1','::1'].includes(bind),'Development executor must bind to loopback');
try{status=await validateIsolation(policy);}catch(error){status={ready:false,reason:error.message.slice(0,600),isolation_profile:policy.mode || 'dedicated-vm',development_only:policy.mode==='docker-desktop-dev',images:{}};}
const service=createExecutionService({policy,status,token:process.env.EXECUTOR_TOKEN,root:process.env.EXECUTOR_JOURNAL_DIR || './journal'});
if(status.ready)await service.recover();
const listener=(req,res)=>service.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Executor failed"}');});
const tls=process.env.EXECUTOR_TLS_CERT && process.env.EXECUTOR_TLS_KEY;
const server=tls ? createTlsServer({cert:await readFile(process.env.EXECUTOR_TLS_CERT),key:await readFile(process.env.EXECUTOR_TLS_KEY)},listener) : createServer(listener);
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.EXECUTOR_PORT || 8091),bind,()=>console.log(status.ready ? `Executor validado (${status.isolation_profile}); requer autorização autenticada.` : `Executor bloqueado: ${status.reason}`));
let closing=false;
async function shutdown(){if(closing)return;closing=true;await service.close();server.close(()=>{if(process.connected)process.disconnect();});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
process.on('message',message=>{if(message?.type==='shutdown')shutdown();});
process.on('disconnect',shutdown);
