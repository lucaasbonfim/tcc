import api from "./api";

export async function loginAdmin({ email, password }) {
  const response = await api.post("/auth/admin/login", {
    email,
    password,
  });

  return response.data.data;
}

export async function loginParticipant({ email, accessCode }) {
  const response = await api.post("/auth/participant/login", {
    email,
    access_code: accessCode,
  });

  return response.data.data;
}

export async function getAuthenticatedSession() {
  const response = await api.get("/auth/me");

  return response.data.data;
}

export async function logoutSession() {
  await api.post("/auth/logout");
}
