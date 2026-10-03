import pool from "../config/database.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapExperimentTaskWithUseCase(task) {
  return {
    id: task.id,
    participant_id: task.participant_id,
    task_order: task.task_order,
    mode: task.mode,
    status: task.status,
    started_at: task.started_at,
    finished_at: task.finished_at,
    use_case: {
      id: task.use_case_id,
      code: task.use_case_code,
      title: task.use_case_title,
      content: task.use_case_content,
    },
  };
}

export async function initializeParticipantExperimentTasks(participantId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const participantResult = await client.query(
      `
        SELECT id, group_id, consent_confirmed
        FROM participants
        WHERE id = $1
      `,
      [participantId],
    );
    const participant = participantResult.rows[0];

    if (!participant) {
      throw createServiceError(404, "Participante não encontrado.");
    }

    if (!participant.consent_confirmed) {
      throw createServiceError(
        400,
        "O consentimento do participante ainda não foi confirmado.",
      );
    }

    const profileResult = await client.query(
      `
        SELECT id
        FROM participant_profiles
        WHERE participant_id = $1
      `,
      [participantId],
    );

    if (!profileResult.rows[0]) {
      throw createServiceError(
        400,
        "O perfil do participante ainda não foi preenchido.",
      );
    }

    const existingTasksResult = await client.query(
      `
        SELECT id
        FROM experiment_tasks
        WHERE participant_id = $1
        LIMIT 1
      `,
      [participantId],
    );

    if (existingTasksResult.rows[0]) {
      throw createServiceError(
        409,
        "As atividades do participante já foram inicializadas.",
      );
    }

    const groupTasksResult = await client.query(
      `
        SELECT use_case_id, mode, task_order
        FROM group_tasks
        WHERE group_id = $1
        ORDER BY task_order
      `,
      [participant.group_id],
    );
    const expectedOrders = [1, 2, 3];
    const hasValidTaskConfiguration =
      groupTasksResult.rows.length === 3 &&
      groupTasksResult.rows.every(
        (task, index) => task.task_order === expectedOrders[index],
      );

    if (!hasValidTaskConfiguration) {
      throw createServiceError(
        400,
        "O grupo do participante não possui as três atividades configuradas.",
      );
    }

    const insertedTasksResult = await client.query(
      `
        WITH inserted_tasks AS (
          INSERT INTO experiment_tasks (
            participant_id,
            use_case_id,
            mode,
            task_order,
            status
          )
          SELECT $1, use_case_id, mode, task_order, 'PENDING'
          FROM group_tasks
          WHERE group_id = $2
          ORDER BY task_order
          RETURNING id, participant_id, use_case_id, mode, task_order, status
        )
        SELECT id, participant_id, use_case_id, mode, task_order, status
        FROM inserted_tasks
        ORDER BY task_order
      `,
      [participantId, participant.group_id],
    );

    await client.query("COMMIT");

    return insertedTasksResult.rows;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(
        409,
        "As atividades do participante já foram inicializadas.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function findParticipantExperimentTasks(participantId) {
  const query = `
    SELECT
      experiment_tasks.id,
      experiment_tasks.task_order,
      experiment_tasks.mode,
      experiment_tasks.status,
      experiment_tasks.started_at,
      experiment_tasks.finished_at,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title
    FROM experiment_tasks
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    WHERE experiment_tasks.participant_id = $1
    ORDER BY experiment_tasks.task_order
  `;

  const { rows } = await pool.query(query, [participantId]);

  return rows.map((row) => ({
    id: row.id,
    task_order: row.task_order,
    mode: row.mode,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    use_case: {
      id: row.use_case_id,
      code: row.use_case_code,
      title: row.use_case_title,
    },
  }));
}

export async function findExperimentTaskById(id) {
  const query = `
    SELECT
      experiment_tasks.id,
      experiment_tasks.participant_id,
      experiment_tasks.task_order,
      experiment_tasks.mode,
      experiment_tasks.status,
      experiment_tasks.started_at,
      experiment_tasks.finished_at,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title,
      use_cases.content AS use_case_content
    FROM experiment_tasks
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    WHERE experiment_tasks.id = $1
  `;

  const { rows } = await pool.query(query, [id]);
  const task = rows[0];

  if (!task) {
    return null;
  }

  return mapExperimentTaskWithUseCase(task);
}

export async function findNextParticipantExperimentTask(participantId) {
  const query = `
    SELECT
      experiment_tasks.id,
      experiment_tasks.participant_id,
      experiment_tasks.task_order,
      experiment_tasks.mode,
      experiment_tasks.status,
      experiment_tasks.started_at,
      experiment_tasks.finished_at,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title,
      use_cases.content AS use_case_content
    FROM experiment_tasks
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    WHERE experiment_tasks.participant_id = $1
    ORDER BY experiment_tasks.task_order
  `;

  const { rows } = await pool.query(query, [participantId]);

  if (rows.length === 0) {
    return {
      initialized: false,
      completed: false,
      task: null,
    };
  }

  const nextTask =
    rows.find((task) => task.status === "IN_PROGRESS") ??
    rows.find((task) => task.status === "PENDING") ??
    null;

  return {
    initialized: true,
    completed: !nextTask,
    task: nextTask ? mapExperimentTaskWithUseCase(nextTask) : null,
  };
}
