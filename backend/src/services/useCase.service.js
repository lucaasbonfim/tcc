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

export async function updateUseCaseById(id, { code, title, content }) {
  const query = `
    UPDATE use_cases
    SET code = $1,
        title = $2,
        content = $3
    WHERE id = $4
    RETURNING id, code, title, content
  `;

  const { rows } = await pool.query(query, [code, title, content, id]);

  return rows[0] ?? null;
}

export async function deleteUseCaseById(id) {
  const query = `
    DELETE FROM use_cases
    WHERE id = $1
    RETURNING id
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}
