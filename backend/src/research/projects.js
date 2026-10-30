import { randomUUID } from 'node:crypto';
import { assert, text, transaction } from './errors.js';
import { resolveRepository } from './github.js';
import { extractDocument } from './documents.js';

export function createProjectService({ pool, store, resolveCode = resolveRepository, extract = extractDocument }) {
  async function get(id, db = pool, lock = false) {
    const row = (await db.query(`SELECT * FROM research.projects WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [id])).rows[0];
    assert(row, 'Projeto não encontrado.', 404);
    return row;
  }
  function fields(input) {
    return { name: text(input.name, 'Nome', 180, true), description: text(input.description, 'Descrição'),
      technical_notes: text(input.technical_notes, 'Informações técnicas'), complementary_text: text(input.complementary_text, 'Requisitos complementares', 50000) };
  }
  async function insertVersion(db, projectId, code) {
    return (await db.query(`INSERT INTO research.code_versions(id,project_id,repository_url,requested_ref,commit_sha,inspection)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [randomUUID(),projectId,code.repository_url,code.requested_ref,code.commit_sha,code.inspection])).rows[0];
  }
  return {
    async list() {
      return (await pool.query(`SELECT p.*, v.commit_sha, v.id AS code_version_id,
        (SELECT count(*)::int FROM research.runs r WHERE r.project_id=p.id) AS run_count,
        (SELECT status FROM research.runs r WHERE r.project_id=p.id ORDER BY created_at DESC LIMIT 1) AS latest_status
        FROM research.projects p LEFT JOIN LATERAL
        (SELECT id,commit_sha FROM research.code_versions WHERE project_id=p.id ORDER BY resolved_at DESC LIMIT 1) v ON true
        ORDER BY p.created_at DESC`)).rows;
    },
    async detail(id) {
      const project = await get(id);
      const [versions, documents, runs] = await Promise.all([
        pool.query('SELECT * FROM research.code_versions WHERE project_id=$1 ORDER BY resolved_at DESC', [id]),
        pool.query('SELECT id,name,version,media_type,sha256,byte_size,page_count,warnings,created_at FROM research.documents WHERE project_id=$1 ORDER BY created_at DESC', [id]),
        pool.query('SELECT id,status,model,created_at,finished_at,code_version_id FROM research.runs WHERE project_id=$1 ORDER BY created_at DESC', [id]),
      ]);
      return { ...project, versions: versions.rows, documents: documents.rows, runs: runs.rows };
    },
    async create(input) {
      const values = fields(input);
      const code = await resolveCode(input.repository_url, input.requested_ref);
      return transaction(pool, async db => {
        const id = randomUUID();
        await db.query(`INSERT INTO research.projects(id,name,description,repository_url,requested_ref,technical_notes,complementary_text)
          VALUES($1,$2,$3,$4,$5,$6,$7)`, [id,values.name,values.description,code.repository_url,code.requested_ref,values.technical_notes,values.complementary_text]);
        await insertVersion(db, id, code);
        return get(id, db);
      });
    },
    async update(id, input) {
      const values = fields(input);
      const code = await resolveCode(input.repository_url, input.requested_ref);
      return transaction(pool, async db => {
        await get(id, db, true);
        await db.query(`UPDATE research.projects SET name=$2,description=$3,repository_url=$4,requested_ref=$5,technical_notes=$6,
          complementary_text=$7,updated_at=now() WHERE id=$1`, [id,values.name,values.description,code.repository_url,code.requested_ref,values.technical_notes,values.complementary_text]);
        await insertVersion(db, id, code);
        return get(id, db);
      });
    },
    async addDocument(id, buffer, filename, mediaType) {
      await get(id);
      const result = await extract(buffer, filename, mediaType);
      const artifact = await store.put(buffer, result.media_type);
      let extraction;
      try {
        extraction = await store.put({ pages: result.pages, warnings: result.warnings });
        return await transaction(pool, async db => {
          await get(id, db, true);
          const usage = (await db.query('SELECT count(*)::int AS count, COALESCE(sum(byte_size),0)::int AS bytes FROM research.documents WHERE project_id=$1', [id])).rows[0];
          assert(usage.count < 20 && usage.bytes + buffer.length <= 100 * 1024 * 1024, 'Limite por projeto: 20 versões de documentos e 100 MiB.', 409);
          const version = (await db.query('SELECT COALESCE(max(version),0)+1 AS n FROM research.documents WHERE project_id=$1 AND name=$2', [id,result.name])).rows[0].n;
          return (await db.query(`INSERT INTO research.documents(id,project_id,name,version,media_type,sha256,byte_size,artifact,extraction,page_count,warnings)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,name,version,page_count,warnings,sha256`,
          [randomUUID(),id,result.name,version,result.media_type,artifact.sha256,buffer.length,artifact,extraction,result.pages.length,JSON.stringify(result.warnings)])).rows[0];
        });
      } catch (error) {
        await store.remove(artifact);
        if (extraction) await store.remove(extraction);
        throw error;
      }
    },
    async document(projectId, id) {
      const doc = (await pool.query('SELECT * FROM research.documents WHERE id=$1 AND project_id=$2', [id,projectId])).rows[0];
      assert(doc, 'Documento não encontrado.', 404);
      return { ...doc, ...(await store.json(doc.extraction)) };
    },
  };
}
