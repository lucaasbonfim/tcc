import pool from "../config/database.js";
import { buildPromptFromParticipantInput } from "./promptBuilder.service.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function previewExperimentTaskPrompt(
  experimentTaskId,
  participantInput,
) {
  const taskResult = await pool.query(
    `
      SELECT
        experiment_tasks.id,
        experiment_tasks.mode,
        experiment_tasks.status,
        use_cases.id AS use_case_id,
        use_cases.title AS use_case_title,
        use_cases.content AS use_case_content
      FROM experiment_tasks
      INNER JOIN use_cases
        ON use_cases.id = experiment_tasks.use_case_id
      WHERE experiment_tasks.id = $1
    `,
    [experimentTaskId],
  );
  const task = taskResult.rows[0];

  if (!task) {
    throw createServiceError(404, "Atividade experimental não encontrada.");
  }

  if (!["SIMPLE_PROMPT", "STRUCTURED_PROMPT"].includes(task.mode)) {
    throw createServiceError(
      400,
      "A pré-visualização está disponível somente para atividades de IA.",
    );
  }

  if (task.status !== "IN_PROGRESS") {
    throw createServiceError(
      409,
      "A atividade precisa estar em andamento para visualizar o prompt.",
    );
  }

  const existingAiRunResult = await pool.query(
    `
      SELECT id
      FROM ai_runs
      WHERE experiment_task_id = $1
    `,
    [experimentTaskId],
  );

  if (existingAiRunResult.rows[0]) {
    throw createServiceError(
      409,
      "A geração desta atividade já foi realizada.",
    );
  }

  const { finalPrompt, promptVersion } = await buildPromptFromParticipantInput({
    mode: task.mode,
    participantInput,
    useCase: {
      id: task.use_case_id,
      title: task.use_case_title,
      content: task.use_case_content,
    },
  });

  return {
    mode: task.mode,
    prompt_version: promptVersion.version,
    final_prompt: finalPrompt,
  };
}
