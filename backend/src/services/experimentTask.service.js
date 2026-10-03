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

export async function startExperimentTaskById(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `
        SELECT id, participant_id, task_order, status, started_at
        FROM experiment_tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw createServiceError(404, "Atividade experimental não encontrada.");
    }

    if (task.status === "COMPLETED") {
      throw createServiceError(409, "Atividade experimental já concluída.");
    }

    const participantTasksResult = await client.query(
      `
        SELECT id, task_order, status
        FROM experiment_tasks
        WHERE participant_id = $1
        ORDER BY task_order
        FOR UPDATE
      `,
      [task.participant_id],
    );

    if (task.status === "IN_PROGRESS") {
      await client.query("COMMIT");

      return {
        id: task.id,
        status: task.status,
        started_at: task.started_at,
      };
    }

    const previousIncompleteTask = participantTasksResult.rows.find(
      (participantTask) =>
        participantTask.task_order < task.task_order &&
        participantTask.status !== "COMPLETED",
    );

    if (previousIncompleteTask) {
      throw createServiceError(
        409,
        "A atividade anterior ainda não foi concluída.",
      );
    }

    const inProgressTask = participantTasksResult.rows.find(
      (participantTask) =>
        participantTask.status === "IN_PROGRESS" && participantTask.id !== task.id,
    );

    if (inProgressTask) {
      throw createServiceError(
        409,
        "Já existe uma atividade em andamento para este participante.",
      );
    }

    const updatedTaskResult = await client.query(
      `
        UPDATE experiment_tasks
        SET status = 'IN_PROGRESS',
            started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, status, started_at
      `,
      [id],
    );

    await client.query("COMMIT");

    return updatedTaskResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeManualExperimentTaskById(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `
        SELECT id, mode, status, started_at, finished_at
        FROM experiment_tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw createServiceError(404, "Atividade experimental não encontrada.");
    }

    if (
      !["MANUAL", "SIMPLE_PROMPT", "STRUCTURED_PROMPT"].includes(task.mode)
    ) {
      throw createServiceError(
        400,
        "A finalização deste modo ainda não foi implementada.",
      );
    }

    if (task.status === "PENDING") {
      throw createServiceError(409, "A atividade ainda não foi iniciada.");
    }

    if (task.status === "COMPLETED") {
      throw createServiceError(409, "A atividade já foi concluída.");
    }

    if (task.mode === "MANUAL") {
      const testCasesCountResult = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM test_cases
          WHERE experiment_task_id = $1
        `,
        [id],
      );

      if (testCasesCountResult.rows[0].total === 0) {
        throw createServiceError(
          409,
          "A atividade precisa possuir pelo menos um caso de teste.",
        );
      }
    }

    if (["SIMPLE_PROMPT", "STRUCTURED_PROMPT"].includes(task.mode)) {
      const aiRunResult = await client.query(
        `
          SELECT id
          FROM ai_runs
          WHERE experiment_task_id = $1
        `,
        [id],
      );

      if (!aiRunResult.rows[0]) {
        throw createServiceError(
          409,
          "A atividade precisa possuir uma execução da IA.",
        );
      }
    }

    const completedTaskResult = await client.query(
      `
        UPDATE experiment_tasks
        SET status = 'COMPLETED',
            finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          status,
          started_at,
          finished_at,
          EXTRACT(EPOCH FROM (finished_at - started_at))::int AS duration_seconds
      `,
      [id],
    );

    await client.query("COMMIT");

    return completedTaskResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findManualExperimentTaskResultById(id) {
  const taskResult = await pool.query(
    `
      SELECT
        experiment_tasks.id,
        experiment_tasks.mode,
        experiment_tasks.status,
        experiment_tasks.task_order,
        experiment_tasks.started_at,
        experiment_tasks.finished_at,
        CASE
          WHEN experiment_tasks.started_at IS NOT NULL
            AND experiment_tasks.finished_at IS NOT NULL
          THEN EXTRACT(
            EPOCH FROM (experiment_tasks.finished_at - experiment_tasks.started_at)
          )::int
          ELSE NULL
        END AS duration_seconds,
        use_cases.id AS use_case_id,
        use_cases.code AS use_case_code,
        use_cases.title AS use_case_title
      FROM experiment_tasks
      INNER JOIN use_cases
        ON use_cases.id = experiment_tasks.use_case_id
      WHERE experiment_tasks.id = $1
    `,
    [id],
  );
  const task = taskResult.rows[0];

  if (!task) {
    throw createServiceError(404, "Atividade experimental não encontrada.");
  }

  if (
    !["MANUAL", "SIMPLE_PROMPT", "STRUCTURED_PROMPT"].includes(task.mode)
  ) {
    throw createServiceError(
      400,
      "A consulta de resultado desse modo ainda não foi implementada.",
    );
  }

  const result = {
    id: task.id,
    mode: task.mode,
    status: task.status,
    task_order: task.task_order,
    started_at: task.started_at,
    finished_at: task.finished_at,
    duration_seconds: task.duration_seconds,
    use_case: {
      id: task.use_case_id,
      code: task.use_case_code,
      title: task.use_case_title,
    },
  };

  if (task.mode === "MANUAL") {
    const testCasesResult = await pool.query(
      `
        SELECT
          id,
          sequence_number,
          title,
          preconditions,
          steps,
          expected_result
        FROM test_cases
        WHERE experiment_task_id = $1
        ORDER BY sequence_number
      `,
      [id],
    );

    return {
      ...result,
      test_cases: testCasesResult.rows,
    };
  }

  const aiRunResult = await pool.query(
    `
      SELECT
        ai_runs.model,
        prompt_versions.version AS prompt_version,
        ai_runs.participant_input,
        ai_runs.final_prompt,
        ai_runs.response_time_ms,
        ai_runs.raw_response
      FROM ai_runs
      INNER JOIN prompt_versions
        ON prompt_versions.id = ai_runs.prompt_version_id
      WHERE ai_runs.experiment_task_id = $1
    `,
    [id],
  );
  const aiRun = aiRunResult.rows[0];

  return {
    ...result,
    ai_run: aiRun
      ? {
          model: aiRun.model,
          prompt_version: aiRun.prompt_version,
          participant_input: aiRun.participant_input,
          final_prompt: aiRun.final_prompt,
          response_time_ms: aiRun.response_time_ms,
          raw_response: aiRun.raw_response,
        }
      : null,
  };
}
