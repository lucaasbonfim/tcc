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
