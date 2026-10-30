export function errorHandler(error, request, response, next) {
  if (!error.statusCode && !error.status) console.error('Erro interno', { code: error.code || error.name });

  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? "Serviço indisponível. Verifique configuração e disponibilidade das integrações." :
      statusCode === 413 ? 'Arquivo ou requisição excede o limite permitido.' : error.message;

  response.status(statusCode).json({ error: message });
}
