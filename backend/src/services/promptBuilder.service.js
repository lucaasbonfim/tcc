import { findActivePromptVersionByMode } from "./promptVersion.service.js";
import { serializeUseCaseForPrompt } from "./useCaseSerializer.service.js";

const AI_MODES = ["SIMPLE_PROMPT", "STRUCTURED_PROMPT"];

function createPromptBuilderError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeRequiredText(value, fieldName) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    throw createPromptBuilderError(400, `O campo ${fieldName} é obrigatório.`);
  }

  return normalizedValue;
}

function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParticipantInput(mode, participantInput) {
  if (!assertObject(participantInput)) {
    throw createPromptBuilderError(
      400,
      "A entrada do participante é obrigatória.",
    );
  }

  if (mode === "SIMPLE_PROMPT") {
    return {
      instruction: normalizeRequiredText(
        participantInput.instruction,
        "instruction",
      ),
    };
  }

  if (mode === "STRUCTURED_PROMPT") {
    return {
      objective: normalizeRequiredText(participantInput.objective, "objective"),
      aspects: normalizeRequiredText(participantInput.aspects, "aspects"),
      scenarios: normalizeRequiredText(
        participantInput.scenarios,
        "scenarios",
      ),
      output_format: normalizeRequiredText(
        participantInput.output_format,
        "output_format",
      ),
      other_instructions: normalizeOptionalText(
        participantInput.other_instructions,
      ),
    };
  }

  throw createPromptBuilderError(
    400,
    "A montagem de prompt está disponível somente para atividades de IA.",
  );
}

function replaceTemplatePlaceholders(template, replacements) {
  return Object.entries(replacements).reduce(
    (prompt, [placeholder, value]) => prompt.replaceAll(placeholder, value),
    template,
  );
}

export async function buildPromptFromParticipantInput({
  mode,
  participantInput,
  useCase,
}) {
  if (!AI_MODES.includes(mode)) {
    throw createPromptBuilderError(
      400,
      "A montagem de prompt está disponível somente para atividades de IA.",
    );
  }

  const normalizedParticipantInput = normalizeParticipantInput(
    mode,
    participantInput,
  );
  const promptVersion = await findActivePromptVersionByMode(mode);
  const serializedUseCase = serializeUseCaseForPrompt(useCase);
  const replacements =
    mode === "SIMPLE_PROMPT"
      ? {
          "{{PARTICIPANT_INSTRUCTION}}":
            normalizedParticipantInput.instruction,
          "{{USE_CASE}}": serializedUseCase,
        }
      : {
          "{{OBJECTIVE}}": normalizedParticipantInput.objective,
          "{{ASPECTS}}": normalizedParticipantInput.aspects,
          "{{SCENARIOS}}": normalizedParticipantInput.scenarios,
          "{{OUTPUT_FORMAT}}": normalizedParticipantInput.output_format,
          "{{OTHER_INSTRUCTIONS}}":
            normalizedParticipantInput.other_instructions,
          "{{USE_CASE}}": serializedUseCase,
        };

  return {
    participantInput: normalizedParticipantInput,
    promptVersion,
    finalPrompt: replaceTemplatePlaceholders(promptVersion.prompt, replacements),
  };
}
