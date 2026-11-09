import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
const repo=args.includes('--repo')?resolve(option('--repo')):null;
const output=resolve(args.includes('--output')?option('--output'):'../var/vvv-schema');
const hash=value=>createHash('sha256').update(value).digest('hex');
let client;
try {
  let connectionString=process.env.VVV_DATABASE_URL,sourceHash=null;
  if(!connectionString && repo) {
    const source=await readFile(join(repo,'src/main/java/vvv/model/DAOs/PassageiroDAO.java'),'utf8');
    const value=name=>source.match(new RegExp(`\\b(?:${name})\\s*=\\s*"([^"\\r\\n]+)"`,'i'))?.[1];
    const jdbc=value('connectionString|URL'),user=value('user'),password=value('password');
    if(!jdbc?.startsWith('jdbc:postgresql://') || !user || !password)throw new Error('CONFIG_NOT_FOUND');
    const url=new URL(jdbc.slice(5));url.username=user;url.password=password;connectionString=url.href;sourceHash=hash(source);
  }
  if(!connectionString)throw new Error('CONFIG_NOT_FOUND');
  const url=new URL(connectionString);
  if(!['postgresql:','postgres:'].includes(url.protocol))throw new Error('INVALID_DATABASE_TYPE');
  client=new pg.Client({connectionString,connectionTimeoutMillis:10000,query_timeout:10000,application_name:'tcc-schema-read-only'});
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='8s'");
  const columns=(await client.query(`SELECT column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,is_identity,identity_generation
    FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,['public','passageiro'])).rows;
  if(!columns.length)throw new Error('TABLE_NOT_FOUND');
  const constraints=(await client.query(`SELECT c.conname AS name,c.contype AS type,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname=$1 AND t.relname=$2 ORDER BY c.conname`,['public','passageiro'])).rows;
  const indexes=(await client.query('SELECT indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname=$1 AND tablename=$2 ORDER BY indexname',['public','passageiro'])).rows;
  await client.query('COMMIT');
  await mkdir(output,{recursive:true});
  const report={captured_at:new Date().toISOString(),mode:'schema-only/read-only',table:'public.passageiro',
    database_identity_sha256:hash(`${url.hostname}:${url.port || '5432'}${url.pathname}`),configuration_source_sha256:sourceHash,columns,constraints,indexes};
  await writeFile(join(output,'metadata.json'),JSON.stringify(report,null,2),'utf8');
  const executable=args.includes('--pg-dump')?option('--pg-dump'):'pg_dump';
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port || '5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:url.searchParams.get('sslmode') || 'verify-full',PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=10000'};
  const {stdout}=await promisify(execFile)(executable,['--schema-only','--no-owner','--no-privileges','--table=public.passageiro'],{env,windowsHide:true,maxBuffer:1024*1024,timeout:30000});
  await writeFile(join(output,'schema.sql'),stdout,'utf8');
  report.schema_sha256=hash(stdout);await writeFile(join(output,'metadata.json'),JSON.stringify(report,null,2),'utf8');
  console.log(JSON.stringify({status:'captured',output,columns:columns.length,constraints:constraints.map(row=>({name:row.name,type:row.type})),schema_sha256:report.schema_sha256}));
} catch(error) {
  // Never print connection strings, source text, pg_dump stderr or credentials.
  console.error(JSON.stringify({status:'blocked',reason:error.code || (['CONFIG_NOT_FOUND','INVALID_DATABASE_TYPE','TABLE_NOT_FOUND'].includes(error.message)?error.message:'SCHEMA_CAPTURE_FAILED')}));
  process.exitCode=1;
} finally {await client?.end().catch(()=>{});}
