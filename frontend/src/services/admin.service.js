import api from "./api";

function removeEmptyFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== "" && value != null),
  );
}

export async function getExperimentSummary() {
  const response = await api.get("/admin/experiment-summary");

  return response.data.data;
}

export async function getParticipants() {
  const response = await api.get("/admin/participants");

  return response.data.data;
}

export async function getParticipantDetails(id) {
  const response = await api.get(`/admin/participants/${id}`);

  return response.data.data;
}

export async function getExperimentTasks(filters = {}) {
  const response = await api.get("/admin/experiment-tasks", {
    params: removeEmptyFilters(filters),
  });

  return response.data.data;
}

export async function downloadExperimentJson() {
  const response = await api.get("/admin/export/json", {
    responseType: "blob",
  });

  return response.data;
}

export async function downloadExperimentCsv() {
  const response = await api.get("/admin/export/csv", {
    responseType: "blob",
  });

  return response.data;
}

export async function downloadExperimentXls() {
  const response = await api.get("/admin/export/xls", {
    responseType: "blob",
  });

  return response.data;
}
