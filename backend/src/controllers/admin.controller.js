import {
  findParticipantDetailsById,
  findParticipantsProgress,
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
