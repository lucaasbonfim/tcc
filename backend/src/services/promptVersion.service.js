import pool from "../config/database.js";

const ACTIVE_PROMPT_VERSIONS = {
  SIMPLE_PROMPT: "1.0",
};

function createPromptVersionError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

export async function findPromptVersionByModeAndVersion(mode, version) {
  const query = `
    SELECT id, mode, version, prompt
    FROM prompt_versions
    WHERE mode = $1
      AND version = $2
  `;

  const { rows } = await pool.query(query, [mode, version]);
  const promptVersion = rows[0];

  if (!promptVersion) {
    throw createPromptVersionError(
      `Versão de prompt não encontrada para ${mode} ${version}.`,
    );
  }

  return promptVersion;
}

export async function findActivePromptVersionByMode(mode) {
  const version = ACTIVE_PROMPT_VERSIONS[mode];

  if (!version) {
    throw createPromptVersionError(
      `Versão ativa de prompt não configurada para ${mode}.`,
    );
  }

  return findPromptVersionByModeAndVersion(mode, version);
}
