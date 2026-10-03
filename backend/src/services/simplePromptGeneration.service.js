import pool from "../config/database.js";
import { getGeminiModel } from "../config/gemini.js";
import { generateContentWithGemini } from "./gemini.service.js";
import { findActivePromptVersionByMode } from "./promptVersion.service.js";
import { serializeUseCaseForPrompt } from "./useCaseSerializer.service.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function generateSimplePromptResult(experimentTaskId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
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
        FOR UPDATE
      `,
      [experimentTaskId],
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw createServiceError(404, "Atividade experimental não encontrada.");
    }

    if (task.mode !== "SIMPLE_PROMPT") {
      throw createServiceError(
        400,
        "A geração está disponível somente para atividades SIMPLE_PROMPT.",
      );
    }

    if (task.status === "PENDING") {
      throw createServiceError(409, "A atividade ainda não foi iniciada.");
    }

    if (task.status === "COMPLETED") {
      throw createServiceError(409, "A atividade já foi concluída.");
    }

    const existingAiRunResult = await client.query(
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

    const model = getGeminiModel();
    const promptVersion = await findActivePromptVersionByMode("SIMPLE_PROMPT");
    const serializedUseCase = serializeUseCaseForPrompt({
      id: task.use_case_id,
      title: task.use_case_title,
      content: task.use_case_content,
    });
    const finalPrompt = promptVersion.prompt.replace(
      "{{USE_CASE}}",
      serializedUseCase,
    );
    const geminiResult = await generateContentWithGemini({
      prompt: finalPrompt,
      model,
    });

    const aiRunResult = await client.query(
      `
        INSERT INTO ai_runs (
          experiment_task_id,
          prompt_version_id,
          model,
          started_at,
          finished_at,
          response_time_ms,
          raw_response
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        experimentTaskId,
        promptVersion.id,
        geminiResult.model,
        geminiResult.startedAt,
        geminiResult.finishedAt,
        geminiResult.responseTimeMs,
        geminiResult.text,
      ],
    );

    await client.query("COMMIT");

    return {
      experiment_task_id: experimentTaskId,
      mode: task.mode,
      model: geminiResult.model,
      prompt_version: promptVersion.version,
      response_time_ms: geminiResult.responseTimeMs,
      response: geminiResult.text,
      ai_run_id: aiRunResult.rows[0].id,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(
        409,
        "A geração desta atividade já foi realizada.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
