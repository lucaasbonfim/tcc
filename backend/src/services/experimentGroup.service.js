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

export async function findExperimentGroupTasks(groupId) {
  const query = `
    SELECT
      group_tasks.id,
      group_tasks.task_order,
      group_tasks.mode,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title
    FROM group_tasks
    INNER JOIN use_cases
      ON use_cases.id = group_tasks.use_case_id
    WHERE group_tasks.group_id = $1
    ORDER BY group_tasks.task_order
  `;

  const { rows } = await pool.query(query, [groupId]);

  return rows.map((row) => ({
    id: row.id,
    task_order: row.task_order,
    mode: row.mode,
    use_case: {
      id: row.use_case_id,
      code: row.use_case_code,
      title: row.use_case_title,
    },
  }));
}
