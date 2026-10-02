export function errorHandler(error, request, response, next) {
  console.error(error);

  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Erro interno do servidor." : error.message;

  response.status(statusCode).json({ error: message });
}
