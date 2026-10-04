import { getSessionFromRequest } from "../services/auth.service.js";

function createUnauthorizedError(message = "Sessao nao autorizada.") {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

export function requireAdmin(request, _response, next) {
  try {
    const session = getSessionFromRequest(request);

    if (session.role !== "admin") {
      throw createUnauthorizedError();
    }

    request.session = session;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireParticipant(request, _response, next) {
  try {
    const session = getSessionFromRequest(request);

    if (session.role !== "participant" || !session.participantId) {
      throw createUnauthorizedError();
    }

    request.session = session;
    request.participantId = Number(session.participantId);

    return next();
  } catch (error) {
    return next(error);
  }
}
