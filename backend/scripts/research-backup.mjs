import 'dotenv/config';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createArtifactStore} from '../src/research/artifacts.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const hash=body=>createHash('sha256').update(body).digest('hex');
function ensure(ok,message){if(!ok)throw new Error(message);}
function command(executable,argv,{input,env=process.env,timeout=120000}={}) {
  return new Promise((done,reject)=>{const child=spawn(executable,argv,{env,windowsHide:true,stdio:['pipe','pipe','pipe']}),out=[],err=[];
    const timer=setTimeout(()=>{child.kill();reject(new Error('COMMAND_TIMEOUT'));},timeout);
    child.stdout.on('data',data=>out.push(data));child.stderr.on('data',data=>err.push(data));child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(new Error('COMMAND_UNAVAILABLE'));});
    child.on('close',code=>{clearTimeout(timer);done({code,stdout:Buffer.concat(out),stderr:Buffer.concat(err)});});child.stdin.end(input);
  });
}
function references(value,found=new Map()) {
  if(!value || typeof value!=='object')return found;
  if(typeof value.key==='string' && /^[a-f0-9-]{36}\.(json|bin)$/.test(value.key) && /^[a-f0-9]{64}$/.test(value.sha256 || '') && Number.isSafeInteger(value.byte_size)) {
    const previous=found.get(value.key);ensure(!previous || previous.sha256===value.sha256,'CONFLICTING_ARTIFACT_REFERENCES');found.set(value.key,value);
  }
  for(const item of Object.values(value))references(item,found);return found;
}
async function verifyFiles(directory,manifest) {
  const dump=await readFile(join(directory,'research.dump'));ensure(hash(dump)===manifest.database_sha256,'DUMP_HASH_MISMATCH');
  const store=createArtifactStore(join(directory,'artifacts'));for(const ref of manifest.artifacts)await store.read(ref);
  return dump;
}
let pool,client,container;
try {
  if(args.includes('--restore-check')) {
    const directory=resolve(option('--restore-check')),manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
    ensure(manifest.format==='research-backup/v1' && manifest.tables && Array.isArray(manifest.artifacts),'INVALID_BACKUP_MANIFEST');
    const dump=await verifyFiles(directory,manifest),image=option('--postgres-image','postgres:18-alpine');
    const identity=await command('docker',['image','inspect',image,'--format','{{.Id}}']);ensure(identity.code===0,'RESTORE_IMAGE_UNAVAILABLE');
    container='tcc-restore-'+randomUUID();
    const start=await command('docker',['run','--detach','--name',container,'--network','none','--user','70:70','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
      '--memory','512m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql:rw,size=320m,uid=70,gid=70,mode=0700',
      '--tmpfs','/var/run/postgresql:rw,size=8m,uid=70,gid=70','--tmpfs','/tmp:rw,size=16m,uid=70,gid=70',
      '-e','PGDATA=/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=tcc_test_restore',identity.stdout.toString().trim(),'postgres','-c','listen_addresses=127.0.0.1','-c','shared_buffers=32MB']);
    ensure(start.code===0,'RESTORE_CONTAINER_FAILED');
    let ready=false;for(let i=0;i<40;i++){const result=await command('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','tcc_test_restore']);if(result.code===0){ready=true;break;}await new Promise(done=>setTimeout(done,500));}ensure(ready,'RESTORE_DATABASE_NOT_READY');
    const restore=await command('docker',['exec','-i',container,'pg_restore','-h','127.0.0.1','-U','postgres','-d','tcc_test_restore','--no-owner','--no-privileges','--exit-on-error'],{input:dump});
    ensure(restore.code===0,'RESTORE_FAILED');
    const tables=Object.keys(manifest.tables);ensure(tables.every(name=>/^[a-z_]+$/.test(name)),'INVALID_TABLE_NAME');
    const sql=tables.map(name=>`SELECT '${name}' || ':' || count(*) FROM research."${name}"`).join(';');
    const counts=await command('docker',['exec',container,'psql','-h','127.0.0.1','-U','postgres','-d','tcc_test_restore','-Atc',sql]);ensure(counts.code===0,'RESTORE_COUNT_FAILED');
    const actual=Object.fromEntries(counts.stdout.toString().trim().split(/\r?\n/).map(line=>{const [key,value]=line.split(':');return [key,Number(value)];}));
    ensure(tables.every(name=>actual[name]===manifest.tables[name]),'RESTORE_COUNT_MISMATCH');
    const restoredRefs=new Map();
    for(const table of tables) {
      const rows=await command('docker',['exec',container,'psql','-h','127.0.0.1','-U','postgres','-d','tcc_test_restore','-Atc',`SELECT to_jsonb(t) FROM research."${table}" t`]);
      ensure(rows.code===0,'RESTORE_REFERENCE_QUERY_FAILED');
      for(const line of rows.stdout.toString().split(/\r?\n/).filter(Boolean))references(JSON.parse(line),restoredRefs);
    }
    const store=createArtifactStore(join(directory,'artifacts'));
    for(const [key,ref] of restoredRefs) {
      const body=await store.read(ref);if(key.endsWith('.json'))references(JSON.parse(body.toString('utf8')),restoredRefs);
    }
    ensure(restoredRefs.size===manifest.artifacts.length && manifest.artifacts.every(ref=>restoredRefs.get(ref.key)?.sha256===ref.sha256),'RESTORE_ARTIFACT_REFERENCE_MISMATCH');
    await writeFile(join(directory,'restore-check.json'),JSON.stringify({verified_at:new Date().toISOString(),postgres_image:identity.stdout.toString().trim(),
      database_sha256:hash(dump),tables:tables.length,runs:actual.runs,artifacts:manifest.artifacts.length,status:'verified'},null,2));
    console.log(JSON.stringify({status:'verified',output:directory,runs:actual.runs,tables:tables.length,artifacts:manifest.artifacts.length}));
  } else {
    const {default:database}=await import('../src/config/database.js');pool=database;client=await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const active=(await client.query("SELECT count(*)::int AS n FROM research.runs WHERE status IN ('pending','running')")).rows[0].n;
    ensure(active===0,'ACTIVE_RUNS_RETRY_BACKUP_AFTER_SETTLED');
    const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='research' ORDER BY tablename")).rows.map(row=>row.tablename);
    const refs=new Map(),counts={};
    for(const table of tables) {
      ensure(/^[a-z_]+$/.test(table),'INVALID_TABLE_NAME');
      const rows=(await client.query(`SELECT to_jsonb(t) AS value FROM research."${table}" t`)).rows;counts[table]=rows.length;
      for(const row of rows)references(row.value,refs);
    }
    const directory=join(resolve(option('--output',join(root,'var/backups'))),randomUUID());await mkdir(join(directory,'artifacts'),{recursive:true});
    const store=createArtifactStore();const manifest={format:'research-backup/v1',created_at:new Date().toISOString(),backup_tool_sha256:hash(await readFile(fileURLToPath(import.meta.url))),tables:counts,artifacts:[],excludes:['.env','credentials','legacy/public tables']};
    // Discover references nested in snapshots and other artifacts, not only database columns.
    for(const [key,ref] of refs) {const body=await store.read(ref);await writeFile(join(directory,'artifacts',key),body,{mode:0o600});manifest.artifacts.push(ref);if(key.endsWith('.json'))references(JSON.parse(body.toString('utf8')),refs);}
    const env={...process.env,PGHOST:process.env.DB_HOST,PGPORT:process.env.DB_PORT || '5432',PGDATABASE:process.env.DB_NAME,PGUSER:process.env.DB_USER,PGPASSWORD:process.env.DB_PASSWORD,
      PGSSLMODE:process.env.DB_SSL==='true'?'verify-full':process.env.DB_SSL==='false'?'disable':['localhost','127.0.0.1'].includes(process.env.DB_HOST)?'disable':'verify-full',PGSSLROOTCERT:'system',PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'};
    const dumpArgs=['--format=custom','--schema=research','--no-owner','--no-privileges',`--snapshot=${snapshot}`];
    let dump;
    if(args.includes('--pg-dump-image')) {
      const identity=await command('docker',['image','inspect',option('--pg-dump-image'),'--format','{{.Id}}']);ensure(identity.code===0,'DUMP_IMAGE_UNAVAILABLE');
      const dockerEnv={...env,PGHOST:['localhost','127.0.0.1'].includes(env.PGHOST)?'host.docker.internal':env.PGHOST};
      const variables=['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGOPTIONS'].flatMap(key=>['-e',key]);
      dump=await command('docker',['run','--rm','--read-only','--user','70:70','--cap-drop','ALL','--security-opt','no-new-privileges',...variables,'--entrypoint','pg_dump',identity.stdout.toString().trim(),...dumpArgs],{env:dockerEnv});
      manifest.dump_image=identity.stdout.toString().trim();
    } else dump=await command(option('--pg-dump','pg_dump'),dumpArgs,{env});
    if(dump.code!==0) {
      await writeFile(join(directory,'backup-error.log'),dump.stderr,{mode:0o600});
      const stderr=dump.stderr.toString();
      const category=stderr.includes('refused')?'CONNECTION_REFUSED':stderr.includes('invalid snapshot')?'INVALID_SNAPSHOT':stderr.includes('permission denied')?'PERMISSION_DENIED':stderr.includes('SSL')?'SSL':stderr.includes('version mismatch')?'VERSION_MISMATCH':'OTHER';
      throw new Error('BACKUP_DUMP_FAILED_'+category);
    }
    await writeFile(join(directory,'research.dump'),dump.stdout,{mode:0o600});manifest.database_sha256=hash(dump.stdout);
    const head=await command('git',['-C',root,'rev-parse','HEAD']);manifest.platform_commit=head.stdout.toString().trim();
    const state=await command('git',['-C',root,'status','--porcelain','--untracked-files=no']);manifest.platform_dirty=state.stdout.length>0;
    manifest.lockfiles={};for(const path of ['backend/package-lock.json','frontend/package-lock.json'])manifest.lockfiles[path]=hash(await readFile(join(root,path)));
    await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2));await client.query('COMMIT');
    await verifyFiles(directory,manifest);console.log(JSON.stringify({status:'captured',output:directory,runs:counts.runs,tables:tables.length,artifacts:manifest.artifacts.length}));
  }
} catch(error) {console.error(JSON.stringify({status:'blocked',reason:error.message?.match(/^[A-Z_]+$/)?.[0] || error.code || 'BACKUP_OR_RESTORE_FAILED'}));process.exitCode=1;}
finally {
  if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}await pool?.end();
  if(container){const cleanup=await command('docker',['rm','-f',container]).catch(()=>({code:1}));if(cleanup.code!==0){console.error('RESTORE_CLEANUP_FAILED');process.exitCode=1;}}
}
