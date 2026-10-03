import pool from "../config/database.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateManualTaskForChanges(task) {
  if (!task) {
    throw createServiceError(404, "Atividade experimental não encontrada.");
  }

  if (task.mode !== "MANUAL") {
    throw createServiceError(
      400,
      "Casos de teste manuais só podem ser gerenciados em atividades MANUAL.",
    );
  }

  if (task.status === "PENDING") {
    throw createServiceError(409, "A atividade ainda não foi iniciada.");
  }

  if (task.status === "COMPLETED") {
    throw createServiceError(409, "A atividade já foi concluída.");
  }
}

export async function createManualTestCase(taskId, testCase) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `
        SELECT id, mode, status
        FROM experiment_tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [taskId],
    );
    const task = taskResult.rows[0];

    validateManualTaskForChanges(task);

    const sequenceResult = await client.query(
      `
        SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence_number
        FROM test_cases
        WHERE experiment_task_id = $1
      `,
      [taskId],
    );
    const sequenceNumber = sequenceResult.rows[0].next_sequence_number;

    const createdTestCaseResult = await client.query(
      `
        INSERT INTO test_cases (
          experiment_task_id,
          sequence_number,
          title,
          preconditions,
          steps,
          expected_result
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          experiment_task_id,
          sequence_number,
          title,
          preconditions,
          steps,
          expected_result,
          created_at
      `,
      [
        taskId,
        sequenceNumber,
        testCase.title,
        JSON.stringify(testCase.preconditions),
        JSON.stringify(testCase.steps),
        testCase.expected_result,
      ],
    );

    await client.query("COMMIT");

    return createdTestCaseResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findTestCasesByExperimentTaskId(taskId) {
  const taskResult = await pool.query(
    `
      SELECT id
      FROM experiment_tasks
      WHERE id = $1
    `,
    [taskId],
  );

  if (!taskResult.rows[0]) {
    throw createServiceError(404, "Atividade experimental não encontrada.");
  }

  const testCasesResult = await pool.query(
    `
      SELECT
        id,
        experiment_task_id,
        sequence_number,
        title,
        preconditions,
        steps,
        expected_result,
        created_at,
        updated_at
      FROM test_cases
      WHERE experiment_task_id = $1
      ORDER BY sequence_number ASC
    `,
    [taskId],
  );

  return testCasesResult.rows;
}

export async function updateManualTestCase(taskId, testCaseId, testCase) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `
        SELECT id, mode, status
        FROM experiment_tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [taskId],
    );
    const task = taskResult.rows[0];

    validateManualTaskForChanges(task);

    const currentTestCaseResult = await client.query(
      `
        SELECT id
        FROM test_cases
        WHERE id = $1
          AND experiment_task_id = $2
      `,
      [testCaseId, taskId],
    );

    if (!currentTestCaseResult.rows[0]) {
      throw createServiceError(404, "Caso de teste não encontrado.");
    }

    const updatedTestCaseResult = await client.query(
      `
        UPDATE test_cases
        SET title = $1,
            preconditions = $2,
            steps = $3,
            expected_result = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
          AND experiment_task_id = $6
        RETURNING
          id,
          experiment_task_id,
          sequence_number,
          title,
          preconditions,
          steps,
          expected_result,
          created_at,
          updated_at
      `,
      [
        testCase.title,
        JSON.stringify(testCase.preconditions),
        JSON.stringify(testCase.steps),
        testCase.expected_result,
        testCaseId,
        taskId,
      ],
    );

    await client.query("COMMIT");

    return updatedTestCaseResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteManualTestCase(taskId, testCaseId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `
        SELECT id, mode, status
        FROM experiment_tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [taskId],
    );
    const task = taskResult.rows[0];

    validateManualTaskForChanges(task);

    const deletedTestCaseResult = await client.query(
      `
        DELETE FROM test_cases
        WHERE id = $1
          AND experiment_task_id = $2
        RETURNING id
      `,
      [testCaseId, taskId],
    );

    if (!deletedTestCaseResult.rows[0]) {
      throw createServiceError(404, "Caso de teste não encontrado.");
    }

    await client.query("COMMIT");

    return deletedTestCaseResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
