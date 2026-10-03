import api from "./api";

export async function findParticipantByCode(code) {
  const normalizedCode = code.trim();
  const response = await api.get(
    `/participants/by-code/${encodeURIComponent(normalizedCode)}`,
  );

  return response.data.data;
}

export async function getParticipantProfile(participantId) {
  const response = await api.get(`/participants/${participantId}/profile`);

  return response.data.data;
}

export async function getParticipantTasks(participantId) {
  const response = await api.get(
    `/participants/${participantId}/experiment-tasks`,
  );

  return response.data.data;
}

export async function getNextParticipantTask(participantId) {
  const response = await api.get(
    `/participants/${participantId}/experiment-tasks/next`,
  );

  return response.data;
}

export async function initializeParticipantTasks(participantId) {
  const response = await api.post(
    `/participants/${participantId}/experiment-tasks/initialize`,
  );

  return response.data.data;
}
