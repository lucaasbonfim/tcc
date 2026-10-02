import pool from "../config/database.js";

export async function findAllUseCases() {
  const query = `
    SELECT id, code, title, content
    FROM use_cases
    ORDER BY code
  `;

  const { rows } = await pool.query(query);

  return rows;
}
