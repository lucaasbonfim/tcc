import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../../src/research/migrate.js';
import { createArtifactStore } from '../../src/research/artifacts.js';
import { createProjectService } from '../../src/research/projects.js';
import { createRunService } from '../../src/research/runs.js';
import { createProcessor } from '../../src/research/processor.js';

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith('/tcc_test_')) throw new Error('Utilize banco separado tcc_test_.');
const req = { code:'RF-001',title:'Autenticação',description:'Autenticar o pesquisador.',kind:'functional',actors:[],use_cases:[],preconditions:[],postconditions:[],main_flow:[],alternative_flows:[],exception_flows:[],acceptance_criteria:[],uncertainties:[],sources:[{document_id:'complementary-text',page:1,quote:'autenticar o pesquisador'}] };
const tc = { code:'CT-001',title:'Autenticação',objective:'Verificar acesso.',requirement_codes:['RF-001'],preconditions:[],input_data:[],steps:['Autenticar.'],expected_result:'Pesquisador autenticado.',scenario:'positive',automation:{feasibility:'needs_inspection',rationale:'Projeto não inspecionado.'} };
const output = request => ({ raw:JSON.stringify(request.input.documents ? {requirements:[req],alerts:[]} : {test_cases:[tc],warnings:[]}),metadata:{model_version:'fixture',usage:null,cost:null} });

test('pipeline persistente: locks, revisão, rastreabilidade, falhas, cancelamento e recuperação', { skip: !url }, async t => {
  const pool = new pg.Pool({connectionString:url});
  const directory = await mkdtemp(join(tmpdir(),'tcc-pipeline-'));
  const store = createArtifactStore(directory);
  const projects = createProjectService({pool,store,resolveCode:async (repository_url,requested_ref) => ({repository_url,requested_ref,commit_sha:'a'.repeat(40),inspection:{}})});
  const runs = createRunService({pool,store,configuration:() => ({model:'fixture-only',parameters:{temperature:0.2,maxOutputTokens:8192}})});
  const input = {name:'Pipeline',repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve autenticar o pesquisador.'};
  let runId;
  try {
    await migrate(pool);
    const project = await projects.create(input);
    const processor = createProcessor({pool,store,generate:async request => output(request)});
    await t.test('enfileira uma execução e preserva snapshot antes das revisões',async () => {
      const run = await runs.create(project.id);
      runId = run.id;
      assert.equal(run.status,'pending');
      await assert.rejects(runs.create(project.id),{statusCode:409});
      await projects.update(project.id,{...input,complementary_text:'Versão posterior, não usada nesta execução.'});
      assert.equal((await runs.detail(runId)).snapshot_data.project.complementary_text,input.complementary_text);
      assert.deepEqual((await Promise.all([processor.processOne(),processor.processOne()])).sort(),[false,true]);
      const detail = await runs.detail(runId);
      assert.equal(detail.status,'awaiting_review');
      assert.equal(detail.attempts.length,1);
      assert.equal(detail.requirements.length,1);
    });
    await t.test('aprovação exige todos os itens revisados e registra correções',async () => {
      await assert.rejects(runs.approveStage(runId,'requirements',{justification:'seguir'}),/Revise todos/);
      const row = (await runs.detail(runId)).requirements[0];
      await runs.reviewItem(runId,'requirements',row.id,{revision:0,decision:'approved',justification:'Conferido no documento.',content:{...row.content,title:'Autenticação revisada'}});
      await assert.rejects(runs.reviewItem(runId,'requirements',row.id,{revision:0,decision:'approved',justification:'Revisão obsoleta.'}),/outra revisão/);
      await runs.approveStage(runId,'requirements',{justification:'Requisitos conferidos.'});
      await processor.processOne();
      const detail = await runs.detail(runId);
      assert.equal(detail.test_cases.length,1);
      assert.equal(detail.traceability[0].requirement_id,row.id);
      assert.equal(detail.attempts[1].status,'completed');
      const caseRow = detail.test_cases[0];
      await runs.reviewItem(runId,'tests',caseRow.id,{revision:0,decision:'approved',justification:'Passos conferidos.'});
      await runs.approveStage(runId,'tests',{justification:'Geração textual concluída.'});
      const final = await runs.export(runId);
      const summary = await runs.summary();
      assert.ok(summary.projects >= 1 && summary.runs >= 1 && summary.completed >= 1);
      assert.equal(final.status,'completed');
      assert.equal(final.stages[2].status,'not_supported');
      assert.equal(final.stages[3].status,'not_supported');
      assert.match(final.attempts[0].output_data.raw,/Autenticação/);
      assert.equal(final.reviews[0].before_value.content.title,'Autenticação');
      assert.equal(final.reviews[0].after_value.content.title,'Autenticação revisada');
      await assert.rejects(runs.reviewItem(runId,'requirements',row.id,{revision:1,decision:'rejected',justification:'Tarde demais.'}),/aberta/);
    });
    await projects.update(project.id,input);
    await t.test('JSON inválido preserva saída, repetição limitada a três e histórico anterior intacto',async () => {
      const run = await runs.create(project.id);
      const bad = createProcessor({pool,store,generate:async () => ({raw:'invalid JSON',metadata:{cost:null}})});
      for (let attempt=1;attempt<=3;attempt++) {
        await bad.processOne();
        const detail = await runs.detail(run.id);
        assert.equal(detail.status,'failed');
        assert.equal(detail.attempts.length,attempt);
        assert.equal((await runs.artifact(run.id,detail.attempts.at(-1).id,'output')).raw,'invalid JSON');
        if (attempt<3) await runs.retry(run.id,{justification:'Provedor corrigido, repetir.'});
      }
      await assert.rejects(runs.retry(run.id,{justification:'Quarta tentativa.'}),/três/);
      assert.equal((await runs.detail(runId)).status,'completed');
    });
    await t.test('cancelamento em chamada não permite gravar itens nem reabrir execução',async () => {
      const run = await runs.create(project.id);
      let release,started;
      const signal = new Promise(resolve => {started=resolve;});
      const delayed = createProcessor({pool,store,generate:async request => { started(); await new Promise(resolve => {release=resolve;}); return output(request); }});
      const processing = delayed.processOne();
      await signal;
      await runs.cancel(run.id,{justification:'Cancelar processamento em andamento.'});
      release();
      await processing;
      const detail = await runs.detail(run.id);
      assert.equal(detail.status,'cancelled');
      assert.equal(detail.requirements.length,0);
      assert.equal(detail.attempts[0].status,'interrupted');
      assert.ok(detail.attempts[0].output);
    });
    await t.test('lease expirado registra interrupção e exige repetição explícita',async () => {
      const run = await runs.create(project.id);
      const stage = (await runs.detail(run.id)).stages[0];
      await pool.query("UPDATE research.runs SET status='running' WHERE id=$1",[run.id]);
      await pool.query("UPDATE research.stages SET status='running',attempt_count=1,lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",[stage.id,randomUUID()]);
      await pool.query("INSERT INTO research.attempts(id,stage_id,number,status) VALUES($1,$2,1,'running')",[randomUUID(),stage.id]);
      assert.equal(await processor.recoverExpired(),1);
      const detail = await runs.detail(run.id);
      assert.equal(detail.status,'failed');
      assert.equal(detail.attempts[0].status,'interrupted');
      await runs.cancel(run.id,{justification:'Finalizar cenário de recuperação.'});
    });
  } finally { await pool.end(); await rm(directory,{recursive:true,force:true}); }
});
