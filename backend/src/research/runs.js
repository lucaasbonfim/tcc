import { randomUUID } from 'node:crypto';
import { AGENTS, validateRequirement, validateTestCase } from './agents.js';
import { GENERATION_PARAMETERS } from './model.js';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.js';
import { assert, text, transaction, uuid } from './errors.js';
import { createAutomationService } from './automation.js';
import {createExecutionService} from './execution.js';
import {createParts} from './requirement-parts.js';

export function createRunService({ pool, store, configuration = () => { getGeminiApiKey(); return { model:getGeminiModel(), parameters:GENERATION_PARAMETERS }; } }) {
  async function get(id, db = pool, lock = false) {
    const run = (await db.query(`SELECT * FROM research.runs WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [id])).rows[0];
    assert(run, 'Execução não encontrada.', 404);
    return run;
  }
  async function review(db, runId, stageId, entityType, entityId, decision, justification, before, after) {
    await db.query(`INSERT INTO research.reviews(id,run_id,stage_id,entity_type,entity_id,decision,justification,before_value,after_value,actor)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'admin')`,
    [randomUUID(),runId,stageId,entityType,entityId,decision,justification,before ? JSON.stringify(before) : null,after ? JSON.stringify(after) : null]);
  }
  const service = {
    async summary() {
      return (await pool.query(`SELECT
        (SELECT count(*)::int FROM research.projects) AS projects,
        count(*)::int AS runs,
        count(*) FILTER(WHERE status='awaiting_review')::int AS awaiting_review,
        count(*) FILTER(WHERE status='completed')::int AS completed FROM research.runs`)).rows[0];
    },
    async create(projectId, input = {}) {
      const config = configuration();
      return transaction(pool, async db => {
        const project = (await db.query('SELECT * FROM research.projects WHERE id=$1 FOR UPDATE', [projectId])).rows[0];
        assert(project, 'Projeto não encontrado.', 404);
        if (input.code_version_id) uuid(input.code_version_id);
        const version = (await db.query(`SELECT * FROM research.code_versions WHERE project_id=$1
          ${input.code_version_id ? 'AND id=$2' : ''} ORDER BY resolved_at DESC LIMIT 1`,input.code_version_id ? [projectId,input.code_version_id] : [projectId])).rows[0];
        assert(version, 'Versão de código não encontrada no projeto.', 404);
        const allDocs = (await db.query('SELECT * FROM research.documents WHERE project_id=$1 ORDER BY created_at DESC', [projectId])).rows;
        let selected;
        if (input.document_ids !== undefined) {
          assert(Array.isArray(input.document_ids) && input.document_ids.length <= 20 && new Set(input.document_ids).size === input.document_ids.length, 'Seleção de documentos inválida.');
          input.document_ids.forEach(uuid);
          selected = input.document_ids.map(id => { const doc = allDocs.find(doc => doc.id === id); assert(doc,'Documento fora do projeto.'); return doc; });
        } else {
          const names = new Set();
          selected = allDocs.filter(doc => { if (names.has(doc.name)) return false; names.add(doc.name); return true; });
        }
        const documents = [];
        for (const doc of selected) {
          const extraction = await store.json(doc.extraction);
          documents.push({ id:doc.id,name:doc.name,version:doc.version,sha256:doc.sha256,created_at:doc.created_at,
            warnings:extraction.warnings,pages:extraction.pages });
        }
        if (project.complementary_text.trim()) documents.push({ id:'complementary-text',name:'Texto complementar',version:project.updated_at,
          pages:[{page:1,text:project.complementary_text}],warnings:[] });
        const length = documents.reduce((sum,doc) => sum + doc.pages.reduce((n,p) => n + p.text.length,0),0);
        assert(length > 0, 'Inclua documento com camada textual ou requisitos complementares antes da análise.', 422);
        assert(length <= 4100000, 'Seleção excede 4,1 milhões de caracteres. Reduza a seleção de documentos.', 422);
        const snapshot = await store.put({ format_version:1,project,code_version:version,documents,agent_definitions:AGENTS });
        try {
          const id = randomUUID();
          await db.query(`INSERT INTO research.runs(id,project_id,code_version_id,status,snapshot,model,parameters)
            VALUES($1,$2,$3,'pending',$4,$5,$6)`, [id,projectId,version.id,snapshot,config.model,config.parameters]);
          for (const doc of selected) await db.query('INSERT INTO research.run_documents(project_id,run_id,document_id) VALUES($1,$2,$3)',[projectId,id,doc.id]);
          for (const definition of AGENTS) {
            const enabled = ['requirements','tests'].includes(definition.agent);
            await db.query(`INSERT INTO research.stages(id,run_id,agent,position,status,instruction_version,instruction,message)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(),id,definition.agent,definition.position,
              definition.agent === 'requirements' ? 'pending' : enabled ? 'blocked' : 'not_supported',definition.version,definition.instruction,
              enabled ? null : definition.agent === 'execution' ? 'Executor isolado não provisionado. Nenhum código externo será executado.' : 'Avaliação indisponível: não há evidências independentes de execução.']);
          }
          await createParts(db,id,documents,store);
          return get(id, db);
        } catch (error) { await store.remove(snapshot); throw error; }
      });
    },
    async list() {
      return (await pool.query(`SELECT r.id,r.project_id,p.name AS project_name,r.status,r.model,r.created_at,r.finished_at,
        v.commit_sha FROM research.runs r JOIN research.projects p ON p.id=r.project_id
        JOIN research.code_versions v ON v.id=r.code_version_id ORDER BY r.created_at DESC LIMIT 500`)).rows;
    },
    async detail(id) {
      const run = await get(id);
      const [stages, attempts, requirements, tests, links, reviews] = await Promise.all([
        pool.query('SELECT id,agent,position,status,instruction_version,attempt_count,message,lease_until,context FROM research.stages WHERE run_id=$1 ORDER BY position',[id]),
        pool.query(`SELECT a.* FROM research.attempts a JOIN research.stages s ON s.id=a.stage_id WHERE s.run_id=$1 ORDER BY a.started_at`,[id]),
        pool.query('SELECT * FROM research.requirements WHERE run_id=$1 ORDER BY code',[id]),
        pool.query('SELECT * FROM research.test_cases WHERE run_id=$1 ORDER BY code',[id]),
        pool.query('SELECT * FROM research.test_requirements WHERE run_id=$1',[id]),
        pool.query('SELECT * FROM research.reviews WHERE run_id=$1 ORDER BY created_at',[id]),
      ]);
      const agentOutputs = {};
      for (const attempt of attempts.rows.filter(attempt => attempt.status==='completed' && attempt.output)) {
        const agent = stages.rows.find(stage => stage.id===attempt.stage_id)?.agent;
        if (agent) agentOutputs[agent] = JSON.parse((await store.json(attempt.output)).raw);
      }
      const consolidation=run.consolidation ? await store.json(run.consolidation) : null;
      if(consolidation)agentOutputs.requirements=consolidation.output;
      return {...run,snapshot_data:await store.json(run.snapshot),stages:stages.rows,attempts:attempts.rows,agent_outputs:agentOutputs,
        requirements:requirements.rows,test_cases:tests.rows,traceability:links.rows,reviews:reviews.rows,
        automated_tests:await createAutomationService({pool,store}).list(id),
        execution_jobs:await createExecutionService({pool,store}).list(id),
        test_results:(await pool.query('SELECT * FROM research.test_results WHERE run_id=$1 ORDER BY id',[id])).rows,
        evidence:(await pool.query('SELECT * FROM research.evidence WHERE run_id=$1 ORDER BY created_at',[id])).rows,
        findings:(await pool.query('SELECT * FROM research.findings WHERE run_id=$1 ORDER BY created_at',[id])).rows,
        requirement_parts:(await pool.query('SELECT * FROM research.requirement_parts WHERE run_id=$1 ORDER BY sequence',[id])).rows,
        consolidation_data:consolidation};
    },
    async reviewItem(runId, kind, id, input) {
      assert(['requirements','tests'].includes(kind), 'Tipo de revisão inválido.');
      const decision = input.decision;
      assert(['approved','rejected'].includes(decision), 'Escolha aprovar ou rejeitar.');
      const justification = text(input.justification,'Justificativa',5000,true);
      const table = kind === 'requirements' ? 'requirements' : 'test_cases';
      return transaction(pool, async db => {
        const run = await get(runId, db, true);
        const stage = (await db.query('SELECT * FROM research.stages WHERE run_id=$1 AND agent=$2 FOR UPDATE',[runId,kind])).rows[0];
        assert(run.status === 'awaiting_review' && stage?.status === 'awaiting_review','Etapa não está aberta para revisão.',409);
        const row = (await db.query(`SELECT * FROM research.${table} WHERE id=$1 AND run_id=$2 FOR UPDATE`,[id,runId])).rows[0];
        assert(row,'Item não encontrado nesta execução.',404);
        assert(Number.isInteger(input.revision) && input.revision === row.revision,'Item alterado por outra revisão. Atualize a página.',409);
        const content = input.content || row.content;
        assert(content.code === row.code,'O código do item não pode ser alterado.');
        if (kind === 'requirements') validateRequirement(content,(await store.json(run.snapshot)).documents);
        else {
          const approved = (await db.query("SELECT code FROM research.requirements WHERE run_id=$1 AND review_status='approved'",[runId])).rows;
          validateTestCase(content,approved);
        }
        const updated = (await db.query(`UPDATE research.${table} SET content=$3,review_status=$4,revision=revision+1 WHERE id=$1 AND run_id=$2 RETURNING *`,[id,runId,JSON.stringify(content),decision])).rows[0];
        if (kind === 'tests') {
          await db.query('DELETE FROM research.test_requirements WHERE test_case_id=$1',[id]);
          for (const code of content.requirement_codes) await db.query(`INSERT INTO research.test_requirements(run_id,test_case_id,requirement_id)
            SELECT $1,$2,id FROM research.requirements WHERE run_id=$1 AND code=$3 AND review_status='approved'`,[runId,id,code]);
        }
        await review(db,runId,stage.id,kind === 'requirements' ? 'requirement' : 'test_case',id,decision,justification,row,updated);
        return updated;
      });
    },
    async approveStage(runId, agent, input) {
      assert(['requirements','tests'].includes(agent),'Etapa não suportada.');
      const justification = text(input.justification,'Justificativa',5000,true);
      return transaction(pool, async db => {
        const run = await get(runId, db, true);
        const stage = (await db.query('SELECT * FROM research.stages WHERE run_id=$1 AND agent=$2 FOR UPDATE',[runId,agent])).rows[0];
        assert(run.status === 'awaiting_review' && stage?.status === 'awaiting_review','Etapa não aguarda aprovação.',409);
        const table = agent === 'requirements' ? 'requirements' : 'test_cases';
        const counts = (await db.query(`SELECT count(*) FILTER(WHERE review_status='pending')::int AS pending,
          count(*) FILTER(WHERE review_status='approved')::int AS approved FROM research.${table} WHERE run_id=$1`,[runId])).rows[0];
        assert(counts.pending === 0 && counts.approved > 0,'Revise todos os itens e aprove pelo menos um antes de continuar.',409);
        await db.query("UPDATE research.stages SET status='completed' WHERE id=$1",[stage.id]);
        if (agent === 'requirements') {
          await db.query("UPDATE research.stages SET status='pending' WHERE run_id=$1 AND agent='tests' AND status='blocked'",[runId]);
          await db.query("UPDATE research.runs SET status='pending' WHERE id=$1",[runId]);
        } else await db.query("UPDATE research.runs SET status='completed',finished_at=now() WHERE id=$1",[runId]);
        await review(db,runId,stage.id,'stage',stage.id,'approved',justification,{status:'awaiting_review'},{status:'completed'});
        return get(runId, db);
      });
    },
    async retry(runId, input) {
      const justification = text(input.justification,'Justificativa',5000,true);
      return transaction(pool, async db => {
        const run = await get(runId, db, true);
        assert(run.status === 'failed','Somente execuções com falha podem ser repetidas.',409);
        assert(!(await db.query("SELECT id FROM research.runs WHERE project_id=$1 AND id<>$2 AND status IN ('pending','running','awaiting_review')",[run.project_id,runId])).rowCount,'Projeto já possui outra execução ativa.',409);
        const stage = (await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND status='failed' FOR UPDATE",[runId])).rows[0];
        assert(stage && stage.attempt_count < 3,'Limite de três tentativas atingido. Crie uma nova execução.',409);
        await db.query("UPDATE research.stages SET status='pending',message=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1",[stage.id]);
        await db.query("UPDATE research.runs SET status='pending',finished_at=NULL WHERE id=$1",[runId]);
        await review(db,runId,stage.id,'stage',stage.id,'retry',justification,{status:'failed'},{status:'pending'});
        return get(runId, db);
      });
    },
    async cancel(runId, input) {
      const justification = text(input.justification,'Justificativa',5000,true);
      return transaction(pool, async db => {
        const run = await get(runId, db, true);
        assert(['pending','running','awaiting_review','failed'].includes(run.status),'Execução já encerrada.',409);
        const stage = (await db.query("SELECT * FROM research.stages WHERE run_id=$1 AND status IN ('pending','running','awaiting_review','failed') ORDER BY position LIMIT 1 FOR UPDATE",[runId])).rows[0];
        await db.query("UPDATE research.runs SET status='cancelled',finished_at=now() WHERE id=$1",[runId]);
        await db.query(`UPDATE research.attempts SET status='interrupted',finished_at=now(),error='Cancelada pelo pesquisador.'
          WHERE status='running' AND stage_id IN (SELECT id FROM research.stages WHERE run_id=$1)`,[runId]);
        await db.query("UPDATE research.stages SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE run_id=$1 AND status IN ('blocked','pending','running','awaiting_review','failed')",[runId]);
        await db.query("UPDATE research.execution_jobs SET status='cancelled',finished_at=now() WHERE run_id=$1 AND status IN ('pending','running')",[runId]);
        await db.query("UPDATE research.requirement_parts SET status='cancelled',error='Execução cancelada pelo pesquisador.' WHERE run_id=$1 AND status IN ('pending','running','failed')",[runId]);
        if (stage) await review(db,runId,stage.id,'run',runId,'cancelled',justification,{status:run.status},{status:'cancelled'});
        return get(runId, db);
      });
    },
    async artifact(runId, attemptId, type) {
      assert(['input','output'].includes(type),'Tipo de artefato inválido.');
      const row = (await pool.query(`SELECT a.input,a.output FROM research.attempts a JOIN research.stages s ON s.id=a.stage_id
        WHERE s.run_id=$1 AND a.id=$2`,[runId,attemptId])).rows[0];
      assert(row?.[type],'Artefato não encontrado.',404);
      return store.json(row[type]);
    },
    async export(runId) {
      const data = await service.detail(runId);
      for (const stage of data.stages) stage.instruction = (await pool.query('SELECT instruction FROM research.stages WHERE id=$1',[stage.id])).rows[0].instruction;
      for (const attempt of data.attempts) {
        attempt.input_data = attempt.input ? await store.json(attempt.input) : null;
        attempt.output_data = attempt.output ? await store.json(attempt.output) : null;
      }
      for(const job of data.execution_jobs)job.bundle_data=await store.json(job.bundle);
      for(const review of data.reviews.filter(r=>r.entity_type==='automated_test')) {
        if(review.before_value?.files)review.before_files_data=await store.json(review.before_value.files);
        if(review.after_value?.files)review.after_files_data=await store.json(review.after_value.files);
      }
      return { export_format_version:2,exported_at:new Date().toISOString(),...data };
    },
  };
  return service;
}
