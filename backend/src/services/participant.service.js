import pool from "../config/database.js";

export async function findExperimentGroupById(id) {
  const query = `
    SELECT id
    FROM experiment_groups
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}

export async function createParticipant({
  code,
  group_id,
  consent_confirmed,
}) {
  const query = `
    INSERT INTO participants (code, group_id, consent_confirmed)
    VALUES ($1, $2, $3)
    RETURNING id, code, group_id, consent_confirmed, created_at
  `;

  const { rows } = await pool.query(query, [
    code,
    group_id,
    consent_confirmed,
  ]);

  return rows[0];
}
