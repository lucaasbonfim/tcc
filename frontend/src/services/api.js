import axios from "axios";

const REQUEST_TIMEOUT_MS = 120000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      "Nao foi possivel concluir a requisicao. Tente novamente.";
    const normalizedError = new Error(message);

    normalizedError.status = error.response?.status;

    return Promise.reject(normalizedError);
  },
);

export default api;
