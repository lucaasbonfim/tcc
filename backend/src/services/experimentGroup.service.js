import pool from "../config/database.js";

export async function findAllExperimentGroups() {
  const query = `
    SELECT id, name, created_at
    FROM experiment_groups
    ORDER BY id
  `;

  const { rows } = await pool.query(query);

  return rows;
}

export async function findExperimentGroupById(id) {
  const query = `
    SELECT id, name, created_at
    FROM experiment_groups
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}
