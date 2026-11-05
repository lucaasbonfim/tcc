// Explicit test target only; never infer it from the research database connection.
import dotenv from 'dotenv';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../../.local/agent-tests.env',import.meta.url)),quiet:true});
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
let url;
const browser=process.argv[2]==='--browser';
try {
  url=new URL(browser?process.env.TEST_BROWSER_DATABASE_URL:process.env.TEST_DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol) || !/^\/tcc_test_[a-zA-Z0-9_]+$/.test(url.pathname))throw new Error();
  if(browser && process.env.TEST_DATABASE_URL && new URL(process.env.TEST_DATABASE_URL).pathname===url.pathname)throw new Error();
}catch{console.error('Configure TEST_DATABASE_URL e, para --browser, TEST_BROWSER_DATABASE_URL em bancos tcc_test_* distintos; opcionalmente use .local/agent-tests.env.');process.exitCode=1;}
if(!process.exitCode) {
  const args=process.argv.slice(browser?3:2);
  const command=browser?[fileURLToPath(new URL('../../frontend/node_modules/@playwright/test/cli.js',import.meta.url)),'test',...args]:['--test','--test-concurrency=1',...(args.length?args:['test'])];
  const child=spawn(process.execPath,command,{
    cwd:fileURLToPath(new URL(browser?'../../frontend/':'../',import.meta.url)),env:{...process.env,TEST_DATABASE_URL:url.href},stdio:'inherit'});
  child.on('error',()=>{console.error('Não foi possível iniciar os testes.');process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code ?? 1;});
}
