import { findParticipantsProgress } from "../services/admin.service.js";

export async function listParticipantsProgress(request, response, next) {
  try {
    const participants = await findParticipantsProgress();

    return response.status(200).json({ data: participants });
  } catch (error) {
    return next(error);
  }
}
