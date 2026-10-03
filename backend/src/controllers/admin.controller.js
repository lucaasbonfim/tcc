import {
  findExperimentTasks,
  findParticipantDetailsById,
  findParticipantsProgress,
  getExperimentSummary,
} from "../services/admin.service.js";

export async function listParticipantsProgress(request, response, next) {
  try {
    const participants = await findParticipantsProgress();

    return response.status(200).json({ data: participants });
  } catch (error) {
    return next(error);
  }
}

export async function getParticipantDetails(request, response, next) {
  try {
    const participant = await findParticipantDetailsById(request.params.id);

    return response.status(200).json({ data: participant });
  } catch (error) {
    return next(error);
  }
}

export async function listExperimentTasks(request, response, next) {
  try {
    const tasks = await findExperimentTasks(request.query);

    return response.status(200).json({ data: tasks });
  } catch (error) {
    return next(error);
  }
}

export async function showExperimentSummary(request, response, next) {
  try {
    const summary = await getExperimentSummary();

    return response.status(200).json({ data: summary });
  } catch (error) {
    return next(error);
  }
}
