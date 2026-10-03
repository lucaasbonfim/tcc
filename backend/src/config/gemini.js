import { GoogleGenAI } from "@google/genai";

export function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("A variável de ambiente GEMINI_API_KEY não foi configurada.");
  }

  return apiKey;
}

export function getGeminiModel() {
  const model = process.env.GEMINI_MODEL;

  if (!model) {
    throw new Error("A variável de ambiente GEMINI_MODEL não foi configurada.");
  }

  return model;
}

export function createGeminiClient() {
  return new GoogleGenAI({
    apiKey: getGeminiApiKey(),
  });
}
