import api from "./api";

export async function getExperimentTask(id) {
  const response = await api.get(`/experiment-tasks/${id}`);

  return response.data.data;
}

export async function startExperimentTask(id) {
  const response = await api.patch(`/experiment-tasks/${id}/start`);

  return response.data.data;
}

export async function completeExperimentTask(id) {
  const response = await api.patch(`/experiment-tasks/${id}/complete`);

  return response.data.data;
}

export async function getExperimentTaskResult(id) {
  const response = await api.get(`/experiment-tasks/${id}/result`);

  return response.data.data;
}

export async function previewExperimentPrompt(id, participantInput) {
  const response = await api.post(`/experiment-tasks/${id}/prompt/preview`, {
    participant_input: participantInput,
  });

  return response.data.data;
}

export async function generateExperimentTask(id, participantInput) {
  const response = await api.post(`/experiment-tasks/${id}/generate`, {
    participant_input: participantInput,
  });

  return response.data.data;
}

export async function getExperimentTaskAiRun(id) {
  const response = await api.get(`/experiment-tasks/${id}/ai-run`);

  return response.data.data;
}
