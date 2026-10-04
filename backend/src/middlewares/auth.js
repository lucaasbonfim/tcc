import pool from "../config/database.js";
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

export function requireSameParticipant(paramName = "participantId") {
  return (request, _response, next) => {
    const routeParticipantId = Number(request.params[paramName]);

    if (!routeParticipantId || routeParticipantId !== request.participantId) {
      return next(createUnauthorizedError());
    }

    return next();
  };
}

export function requireExperimentTaskOwner(paramName = "id") {
  return async (request, _response, next) => {
    try {
      const taskId = request.params[paramName];
      const { rows } = await pool.query(
        `
          SELECT participant_id
          FROM experiment_tasks
          WHERE id = $1
        `,
        [taskId],
      );
      const task = rows[0];

      if (!task) {
        const error = new Error("Atividade experimental nao encontrada.");
        error.statusCode = 404;
        throw error;
      }

      if (Number(task.participant_id) !== request.participantId) {
        throw createUnauthorizedError();
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
