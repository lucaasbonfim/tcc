import { findParticipantById } from "../services/participant.service.js";
import {
  createParticipantProfile,
  findParticipantProfileByParticipantId,
  updateParticipantProfile,
} from "../services/participantProfile.service.js";

export async function getParticipantProfile(request, response, next) {
  try {
    const participant = await findParticipantById(request.params.participantId);

    if (!participant) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    const profile = await findParticipantProfileByParticipantId(
      request.params.participantId,
    );

    if (!profile) {
      return response.status(404).json({
        error: "Perfil do participante não encontrado.",
      });
    }

    return response.status(200).json({ data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function createParticipantProfileController(
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

    const currentProfile = await findParticipantProfileByParticipantId(
      request.params.participantId,
    );

    if (currentProfile) {
      return response.status(409).json({
        error: "Participante já possui perfil cadastrado.",
      });
    }

    const profile = await createParticipantProfile(
      request.params.participantId,
      request.body,
    );

    return response.status(201).json({ data: profile });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "Participante já possui perfil cadastrado.",
      });
    }

    return next(error);
  }
}

export async function updateParticipantProfileController(
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

    const currentProfile = await findParticipantProfileByParticipantId(
      request.params.participantId,
    );

    if (!currentProfile) {
      return response.status(404).json({
        error: "Perfil do participante não encontrado.",
      });
    }

    const profile = await updateParticipantProfile(
      request.params.participantId,
      request.body,
    );

    return response.status(200).json({ data: profile });
  } catch (error) {
    return next(error);
  }
}
