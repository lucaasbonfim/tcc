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

export async function findUseCaseById(id) {
  const query = `
    SELECT id, code, title, content
    FROM use_cases
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}

export async function createUseCase({ code, title, content }) {
  const query = `
    INSERT INTO use_cases (code, title, content)
    VALUES ($1, $2, $3)
    RETURNING id, code, title, content
  `;

  const { rows } = await pool.query(query, [code, title, content]);

  return rows[0];
}
