import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
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

    return Promise.reject(new Error(message));
  },
);

export default api;
