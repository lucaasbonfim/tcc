import { findParticipantById } from "../services/participant.service.js";
import {
  findParticipantExperimentTasks,
  initializeParticipantExperimentTasks,
} from "../services/experimentTask.service.js";

export async function initializeParticipantExperimentTasksController(
  request,
  response,
  next,
) {
  try {
    const tasks = await initializeParticipantExperimentTasks(
      request.params.participantId,
    );

    return response.status(201).json({ data: tasks });
  } catch (error) {
    return next(error);
  }
}

export async function listParticipantExperimentTasks(
  request,
  response,
  next,
) {
  try {
    const participant = await findParticipantById(request.params.participantId);

    if (!participant) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    const tasks = await findParticipantExperimentTasks(
      request.params.participantId,
    );

    return response.status(200).json({ data: tasks });
  } catch (error) {
    return next(error);
  }
}
