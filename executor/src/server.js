import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createServer as createTlsServer} from 'node:https';
import {createExecutionService} from './service.js';
import {validateIsolation} from './isolation.js';

const policy=JSON.parse(await readFile(process.env.EXECUTOR_POLICY_FILE || './policy.local.json','utf8'));
let status;
try{status=await validateIsolation(policy);}catch{status={ready:false,reason:'VM dedicada/rootless/cgroups/imagens/probes não validados.',images:{}};}
const service=createExecutionService({policy,status,token:process.env.EXECUTOR_TOKEN,root:process.env.EXECUTOR_JOURNAL_DIR || './journal'});
if(status.ready)await service.recover();
const listener=(req,res)=>service.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Executor failed"}');});
const tls=process.env.EXECUTOR_TLS_CERT && process.env.EXECUTOR_TLS_KEY;
const server=tls ? createTlsServer({cert:await readFile(process.env.EXECUTOR_TLS_CERT),key:await readFile(process.env.EXECUTOR_TLS_KEY)},listener) : createServer(listener);
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.EXECUTOR_PORT || 8091),process.env.EXECUTOR_BIND || '127.0.0.1',()=>console.log(status.ready ? 'Executor validado; requer autorização autenticada.' : 'Executor bloqueado: isolamento não validado.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();server.close();});
