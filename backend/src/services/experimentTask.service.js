import pool from "../config/database.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
