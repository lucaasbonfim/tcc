import pool from "../config/database.js";
import { getGeminiModel } from "../config/gemini.js";
import { generateContentWithGemini } from "./gemini.service.js";
import { buildPromptFromParticipantInput } from "./promptBuilder.service.js";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function generateSimplePromptResult(
  experimentTaskId,
  participantInput,
) {
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

    if (!["SIMPLE_PROMPT", "STRUCTURED_PROMPT"].includes(task.mode)) {
      throw createServiceError(
        400,
        "A geração está disponível somente para atividades de prompt.",
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

    const {
      finalPrompt,
      participantInput: normalizedParticipantInput,
      promptVersion,
    } = await buildPromptFromParticipantInput({
      mode: task.mode,
      participantInput,
      useCase: {
        id: task.use_case_id,
        title: task.use_case_title,
        content: task.use_case_content,
      },
    });
    const model = getGeminiModel();
    const geminiResult = await generateContentWithGemini({
      prompt: finalPrompt,
      model,
    });

    const aiRunResult = await client.query(
      `
        INSERT INTO ai_runs (
          experiment_task_id,
          prompt_version_id,
          participant_input,
          final_prompt,
          model,
          started_at,
          finished_at,
          response_time_ms,
          raw_response
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        experimentTaskId,
        promptVersion.id,
        JSON.stringify(normalizedParticipantInput),
        finalPrompt,
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
      participant_input: normalizedParticipantInput,
      final_prompt: finalPrompt,
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
