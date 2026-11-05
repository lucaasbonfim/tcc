// Explicit test target only; never infer it from the research database connection.
import dotenv from 'dotenv';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../../.local/agent-tests.env',import.meta.url)),quiet:true});
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
let url;
try {
  url=new URL(process.env.TEST_DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol) || !/^\/tcc_test_[a-zA-Z0-9_]+$/.test(url.pathname))throw new Error();
}catch{console.error('Configure TEST_DATABASE_URL para um banco separado tcc_test_*; opcionalmente use .local/agent-tests.env.');process.exitCode=1;}
if(!process.exitCode) {
  const args=process.argv.slice(2);
  const child=spawn(process.execPath,['--test','--test-concurrency=1',...(args.length?args:['test'])],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,TEST_DATABASE_URL:url.href},stdio:'inherit'});
  child.on('error',()=>{console.error('Não foi possível iniciar os testes.');process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code ?? 1;});
}
