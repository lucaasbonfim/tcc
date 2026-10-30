import {existsSync,readFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {basename} from 'node:path';
import {dirname} from 'node:path';
import {probe} from './probe.mjs';
import {validateBundle,sha256} from './protocol.mjs';
if(!existsSync('/opt/research/container-only'))throw new Error('This runner can only run in its provisioned container.');
probe();
let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>1048576)throw new Error('Bundle too large');}
const bundle=validateBundle(JSON.parse(input));
for(const file of [...bundle.source_files,...bundle.generated_tests.flatMap(t=>t.files)]) {
  if(sha256(readFileSync(`/project/${file.path}`))!==file.sha256)throw new Error('Immutable source mismatch');
  let path=`/project/${file.path}`;
  while(path!=='/') {
    const stat=statSync(path);
    if(stat.uid!==0 || (stat.mode & 0o022)!==0)throw new Error('Project files must be root-owned and not writable by the test user');
    if(path==='/project')break;path=dirname(path);
  }
}
const commands=[],tests=[],reports=[];
let stdout='',stderr='';const started_at=new Date().toISOString(),start=Date.now();
function command(argv) {
  const remaining=45000-(Date.now()-start);
  if(remaining<=0)return {status:null,stdout:'',stderr:'Execution timeout',signal:'SIGKILL'};
  const result=spawnSync(argv[0],argv.slice(1),{encoding:'utf8',cwd:'/project',timeout:Math.min(25000,remaining),maxBuffer:512000,
    env:{PATH:process.env.PATH,HOME:'/work',TMPDIR:'/tmp',LANG:'C.UTF-8'}});
  commands.push({argv,exit_code:result.status});stdout+=(result.stdout || '').slice(0,30000);stderr+=(result.stderr || '').slice(0,30000);
  return result;
}
function fallback(test,status,observed){tests.push({artifact_id:test.id,test_case_id:test.test_case_id,test_name:basename(test.files[0].path),status,observed:observed.slice(0,20000)});}
if(bundle.adapter==='node-test/v2') {
  for(const test of bundle.generated_tests) {
    const result=command(['/usr/local/bin/node','--test','--test-reporter=/opt/research/node-reporter.mjs',`/project/${test.files[0].path}`]);
    if(result.signal || result.error){fallback(test,result.error?.code==='ETIMEDOUT' || result.signal ? 'timeout' : 'infrastructure_error',result.stderr || result.error?.message || 'Runner interrupted');continue;}
    let events;
    try{events=(result.stdout || '').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{fallback(test,'inconclusive','Framework report could not be parsed');continue;}
    reports.push({artifact_id:test.id,format:'node-test-events/v1',events});
    const outcomes=events.filter(e=>['test:pass','test:fail'].includes(e.type));
    if(!outcomes.length){fallback(test,'inconclusive','No test event reported');continue;}
    for(const row of outcomes) {
      const status=row.skip || row.todo ? 'skipped' : row.type==='test:pass' ? 'passed' : row.error_code==='ERR_ASSERTION' ? 'failed' :
        ['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(row.error_code) ? 'dependency_unavailable' : 'test_error';
      tests.push({artifact_id:test.id,test_case_id:test.test_case_id,test_name:row.name,status,observed:(row.message || (status==='passed' ? 'Node test assertion completed without failure.' : 'See framework report.')).slice(0,20000)});
    }
  }
} else {
  mkdirSync('/work/classes',{recursive:true});
  const sources=bundle.source_files.filter(f=>f.path.endsWith('.java')).map(f=>`/project/${f.path}`);
  const compile=command(['javac','-J-Xmx128m','-proc:none','-cp','/opt/research/junit.jar','-d','/work/classes',...sources,...bundle.generated_tests.map(t=>`/project/${t.files[0].path}`)]);
  if(compile.status!==0)for(const test of bundle.generated_tests)fallback(test,compile.signal ? 'timeout' : 'compilation_error',compile.stderr || 'Java compilation failed');
  else for(const test of bundle.generated_tests) {
    const name=basename(test.files[0].path,'.java');
    const result=command(['java','-Xmx128m','-Djava.awt.headless=true','-jar','/opt/research/junit.jar','execute','--disable-banner','--disable-ansi-colors','--class-path','/work/classes','--select-class',name,'--fail-if-no-tests']);
    reports.push({artifact_id:test.id,format:'junit-console/v1',stdout:(result.stdout || '').slice(0,30000),stderr:(result.stderr || '').slice(0,30000)});
    // The initial Java adapter reports a generated class as its individual case; 1 is a JUnit test failure, not proof of defect.
    fallback(test,result.signal ? 'timeout' : result.status===0 ? 'passed' : result.status===1 ? 'failed' : 'test_error',(result.stdout || '')+'\n'+(result.stderr || ''));
  }
}
process.stdout.write(JSON.stringify({started_at,finished_at:new Date().toISOString(),duration_ms:Date.now()-start,
  exit_code:tests.every(t=>t.status==='passed') ? 0 : 1,commands,tests,stdout:stdout.slice(0,150000),stderr:stderr.slice(0,150000),framework_reports:reports}));
