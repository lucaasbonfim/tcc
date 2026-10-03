import {
  createParticipant,
  findAllParticipants,
  findExperimentGroupById,
} from "../services/participant.service.js";

export async function listParticipants(request, response, next) {
  try {
    const participants = await findAllParticipants();

    response.status(200).json({ data: participants });
  } catch (error) {
    next(error);
  }
}

export async function createParticipantController(request, response, next) {
  try {
    const { code, group_id, consent_confirmed } = request.body;

    if (!code || !group_id) {
      return response.status(400).json({
        error: "Os campos code e group_id são obrigatórios.",
      });
    }

    const group = await findExperimentGroupById(group_id);

    if (!group) {
      return response.status(400).json({
        error: "Grupo informado não existe.",
      });
    }

    const participant = await createParticipant({
      code,
      group_id,
      consent_confirmed: consent_confirmed ?? false,
    });

    return response.status(201).json({ data: participant });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "Já existe um participante com este código.",
      });
    }

    return next(error);
  }
}
