import { createGeminiClient } from "../config/gemini.js";

export async function generateContentWithGemini({ prompt, model }) {
  if (!prompt) {
    throw new Error("O prompt final é obrigatório para chamar o Gemini.");
  }

  if (!model) {
    throw new Error("O modelo é obrigatório para chamar o Gemini.");
  }

  const client = createGeminiClient();
  const startedAt = new Date();
  const startedAtMs = Date.now();

  const response = await client.models.generateContent({
    model,
    contents: prompt,
  });

  const finishedAt = new Date();

  return {
    text: response.text,
    model,
    startedAt,
    finishedAt,
    responseTimeMs: Date.now() - startedAtMs,
  };
}
