import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const output=join(resolve(option('--output',join(root,'var/vvv-pilot'))),randomUUID()),schemaRoot=resolve(option('--schema',join(root,'var/vvv-schema')));
const javaImage=option('--java-image','tcc-executor-java:local-dev'),pgImage=option('--postgres-image','postgres:16-alpine');
const control=option('--control','original');
const hash=(body,algorithm='sha256')=>createHash(algorithm).update(body).digest('hex');
const pgName='tcc-vvv-pg-'+randomUUID(),javaName='tcc-vvv-java-'+randomUUID();
const report={kind:'technical-pilot/not-scientific-collection',started_at:new Date().toISOString(),status:'preparing',limitations:[
  'Controle manual JDBC; nao demonstra geracao ou avaliacao por agentes.',
  'Exercita DAO e persistencia; nao exercita Swing, mensagens ou redirecionamento.',
  'Estado do esquema capturado atualmente; nao prova qual esquema existia na data do commit.'
]};
function docker(argv,input,timeout=60000) {
  return new Promise((resolvePromise,reject)=>{
    const process=spawn('docker',argv,{windowsHide:true,stdio:['pipe','pipe','pipe']}),stdout=[],stderr=[];
    const timer=setTimeout(()=>{process.kill();reject(new Error('DOCKER_TIMEOUT'));},timeout);
    process.stdout.on('data',data=>stdout.push(data));process.stderr.on('data',data=>stderr.push(data));
    process.on('error',()=>{clearTimeout(timer);reject(new Error('DOCKER_UNAVAILABLE'));});
    process.on('close',code=>{clearTimeout(timer);resolvePromise({code,stdout:Buffer.concat(stdout).toString(),stderr:Buffer.concat(stderr).toString()});});
    process.stdin.on('error',()=>{});process.stdin.end(input);
  });
}
function ensure(condition,code){if(!condition)throw new Error(code);}
async function image(reference) {const response=await docker(['image','inspect',reference,'--format','{{.Id}}']);ensure(response.code===0,'IMAGE_NOT_AVAILABLE');return response.stdout.trim();}
try {
  ensure(['original','without-uniqueness'].includes(control),'UNKNOWN_CONTROL');report.control=control;
  await mkdir(output,{recursive:true});
  const metadata=JSON.parse(await readFile(join(root,'.local/module-scope/inspection-summary.json'),'utf8'));
  report.repository_url=metadata.repository_url;report.commit_sha=metadata.commit_sha;
  ensure(metadata.repository_url==='https://github.com/lucaasbonfim/vvv' && /^[a-f0-9]{40}$/.test(metadata.commit_sha),'INVALID_SOURCE_IDENTITY');
  const paths=['src/main/java/vvv/model/Passageiro.java','src/main/java/vvv/model/DAOs/PassageiroDAO.java'];
  const sources=[];
  for(const path of paths) {
    const entry=metadata.files.find(file=>file.path===path);ensure(entry,'MISSING_SOURCE_METADATA');
    const response=await fetch(`${metadata.repository_url.replace('github.com','raw.githubusercontent.com')}/${metadata.commit_sha}/${path}`,{signal:AbortSignal.timeout(15000)});
    ensure(response.ok,'SOURCE_DOWNLOAD_FAILED');const body=Buffer.from(await response.arrayBuffer());
    ensure(hash(body)===entry.sha256 && hash(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body]),'sha1')===entry.git_sha,'SOURCE_HASH_MISMATCH');
    sources.push({path,code:body.toString('utf8')});
  }
  report.sources=sources.map(source=>({path:source.path,sha256:hash(source.code)}));
  await writeFile(join(output,'sources.json'),JSON.stringify(sources,null,2),{mode:0o600});
  const originalSchema=await readFile(join(schemaRoot,'schema.sql'),'utf8'),schemaMetadata=JSON.parse(await readFile(join(schemaRoot,'metadata.json'),'utf8'));
  ensure(hash(originalSchema)===schemaMetadata.schema_sha256,'SCHEMA_HASH_MISMATCH');
  // pg_dump 17 emits a session setting unknown to the original PostgreSQL 16 engine.
  let schema=originalSchema.replace(/^SET transaction_timeout = 0;\r?\n/m,'');
  report.schema={original_sha256:hash(originalSchema),applied_sha256:hash(schema),adaptations:originalSchema===schema?[]:['Removed pg_dump 17 SET transaction_timeout=0 for PostgreSQL 16; DDL unchanged.']};
  if(control==='without-uniqueness') {
    const blocks=schema.match(/ALTER TABLE ONLY public\.passageiro\s+ADD CONSTRAINT passageiro_(?:cpf|email)_key UNIQUE \((?:cpf|email)\);/g);
    ensure(blocks?.length===2,'CONTROL_REQUIRES_BOTH_CONSTRAINTS');
    for(const block of blocks)schema=schema.replace(block,'');
    report.schema.adaptations.push('Technical negative control: removed CPF/email UNIQUE only in the disposable database.');
    report.schema.applied_sha256=hash(schema);
  }
  await writeFile(join(output,'original-schema.sql'),originalSchema);await writeFile(join(output,'applied-schema.sql'),schema);
  const jdbcVersion='42.5.4',url=`https://repo.maven.apache.org/maven2/org/postgresql/postgresql/${jdbcVersion}/postgresql-${jdbcVersion}.jar`;
  const [jarResponse,checksumResponse]=await Promise.all([fetch(url),fetch(url+'.sha1')]);ensure(jarResponse.ok && checksumResponse.ok,'JDBC_DOWNLOAD_FAILED');
  const jar=Buffer.from(await jarResponse.arrayBuffer());ensure(hash(jar,'sha1')===(await checksumResponse.text()).trim(),'JDBC_CHECKSUM_MISMATCH');
  report.jdbc={version:jdbcVersion,url,sha256:hash(jar),publisher_checksum:'sha1'};
  await writeFile(join(output,'postgresql.jar'),jar);
  const pgId=await image(pgImage),javaId=await image(javaImage);report.images={postgres:pgId,java:javaId};
  const created=await docker(['run','--detach','--name',pgName,'--network','none','--user','70:70','--read-only','--cap-drop','ALL',
    '--security-opt','no-new-privileges','--memory','256m','--cpus','1','--pids-limit','128',
    '--tmpfs','/var/lib/postgresql/data:rw,size=160m,uid=70,gid=70,mode=0700','--tmpfs','/var/run/postgresql:rw,size=8m,uid=70,gid=70',
    '--tmpfs','/tmp:rw,size=16m,uid=70,gid=70','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=tcc_test_vvv',pgId,
    'postgres','-c','listen_addresses=127.0.0.1','-c','shared_buffers=16MB','-c','max_connections=10']);
  ensure(created.code===0,'DATABASE_CONTAINER_FAILED');
  let ready=false;for(let i=0;i<40;i++){const result=await docker(['exec',pgName,'pg_isready','-h','127.0.0.1','-U','postgres','-d','tcc_test_vvv']);if(result.code===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}
  ensure(ready,'DATABASE_NOT_READY');
  const restored=await docker(['exec','-i',pgName,'psql','-h','127.0.0.1','-U','postgres','-d','tcc_test_vvv','-v','ON_ERROR_STOP=1'],schema);
  await writeFile(join(output,'restore.log'),restored.stdout+restored.stderr);ensure(restored.code===0,'SCHEMA_RESTORE_FAILED');
  const harness=await readFile(join(root,'scripts/pilots/VvvUniquenessProbe.java'),'utf8');report.harness_sha256=hash(harness);
  await writeFile(join(output,'VvvUniquenessProbe.java'),harness);
  const payload={sources,harness,jar:jar.toString('base64')};
  const runner=`const fs=require('node:fs'),cp=require('node:child_process');const p=JSON.parse(fs.readFileSync(0,'utf8'));fs.mkdirSync('/work/classes',{recursive:true});const paths=p.sources.map((s,i)=>{const path='/work/Source'+i+'/'+s.path.split('/').pop();fs.mkdirSync(require('node:path').dirname(path),{recursive:true});fs.writeFileSync(path,s.code);return path;});fs.writeFileSync('/work/VvvUniquenessProbe.java',p.harness);fs.writeFileSync('/work/postgresql.jar',Buffer.from(p.jar,'base64'));cp.execFileSync('javac',['-J-Xmx128m','-proc:none','-d','/work/classes',...paths,'/work/VvvUniquenessProbe.java'],{stdio:['ignore','pipe','pipe']});const r=cp.spawnSync('java',['-Xmx128m','-cp','/work/classes:/work/postgresql.jar','VvvUniquenessProbe'],{encoding:'utf8',timeout:30000});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exitCode=r.status??1;`;
  const result=await docker(['run','--name',javaName,'--network',`container:${pgName}`,'--user','1000:1000','--read-only','--cap-drop','ALL',
    '--security-opt','no-new-privileges','--memory','256m','--cpus','1','--pids-limit','64','--tmpfs','/work:rw,size=64m,uid=1000,gid=1000',
    '--entrypoint','/usr/local/bin/node','-i',javaId,'-e',runner],JSON.stringify(payload));
  await writeFile(join(output,'jdbc-stderr.log'),result.stderr);
  report.execution=JSON.parse(result.stdout);report.exit_code=result.code;
  report.status=result.code===0?'completed':'failed';
  if(control==='without-uniqueness') {
    const tests=report.execution.tests;
    report.status=result.code===2 && tests.length===5 && tests[0].status==='passed' && tests.slice(1).every(test=>test.status==='failed')?'control_detected':'control_not_detected';
  }
} catch(error) {report.status='blocked';report.reason=error.message?.match(/^[A-Z_]+$/)?.[0] || 'PILOT_TECHNICAL_FAILURE';process.exitCode=1;}
finally {
  report.cleanup=[];for(const name of [javaName,pgName]) {const result=await docker(['rm','-f',name]).catch(()=>({code:1,stderr:''}));report.cleanup.push({name,removed:result.code===0,not_created:result.stderr.includes('No such container')});}
  if(report.cleanup.some(row=>!row.removed&&!row.not_created)){report.status='cleanup_failed';process.exitCode=1;}
  report.finished_at=new Date().toISOString();await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,reason:report.reason,output,tests:report.execution?.tests,cleanup:report.cleanup}));
  if(!['completed','control_detected'].includes(report.status))process.exitCode=1;
}
