import { initializeParticipantExperimentTasks } from "../services/experimentTask.service.js";

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
