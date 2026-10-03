import pool from "../config/database.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function findAiRunByExperimentTaskId(experimentTaskId) {
  const taskResult = await pool.query(
    `
      SELECT id
      FROM experiment_tasks
      WHERE id = $1
    `,
    [experimentTaskId],
  );

  if (!taskResult.rows[0]) {
    throw createServiceError(404, "Atividade experimental não encontrada.");
  }

  const aiRunResult = await pool.query(
    `
      SELECT
        ai_runs.id,
        ai_runs.experiment_task_id,
        experiment_tasks.mode,
        ai_runs.model,
        prompt_versions.id AS prompt_version_id,
        prompt_versions.version AS prompt_version,
        ai_runs.participant_input,
        ai_runs.final_prompt,
        ai_runs.started_at,
        ai_runs.finished_at,
        ai_runs.response_time_ms,
        ai_runs.raw_response
      FROM ai_runs
      INNER JOIN experiment_tasks
        ON experiment_tasks.id = ai_runs.experiment_task_id
      INNER JOIN prompt_versions
        ON prompt_versions.id = ai_runs.prompt_version_id
      WHERE ai_runs.experiment_task_id = $1
    `,
    [experimentTaskId],
  );
  const aiRun = aiRunResult.rows[0];

  if (!aiRun) {
    throw createServiceError(404, "Execução da IA não encontrada.");
  }

  return {
    id: aiRun.id,
    experiment_task_id: aiRun.experiment_task_id,
    mode: aiRun.mode,
    model: aiRun.model,
    prompt: {
      id: aiRun.prompt_version_id,
      version: aiRun.prompt_version,
    },
    participant_input: aiRun.participant_input,
    final_prompt: aiRun.final_prompt,
    started_at: aiRun.started_at,
    finished_at: aiRun.finished_at,
    response_time_ms: aiRun.response_time_ms,
    raw_response: aiRun.raw_response,
  };
}
