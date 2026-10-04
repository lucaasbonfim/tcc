import {
  confirmParticipantConsentById,
  createParticipant,
  deleteParticipantById,
  findAllParticipants,
  findExperimentGroupById,
  findParticipantById,
  findParticipantOnboardingById,
  updateParticipantById,
} from "../services/participant.service.js";

export async function listParticipants(request, response, next) {
  try {
    const participants = await findAllParticipants();

    response.status(200).json({ data: participants });
  } catch (error) {
    next(error);
  }
}

export async function getParticipantById(request, response, next) {
  try {
    const participant = await findParticipantById(request.params.id);

    if (!participant) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    return response.status(200).json({ data: participant });
  } catch (error) {
    return next(error);
  }
}

export async function getParticipantOnboarding(request, response, next) {
  try {
    const onboarding = await findParticipantOnboardingById(
      request.participantId,
    );

    if (!onboarding) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    return response.status(200).json({ data: onboarding });
  } catch (error) {
    return next(error);
  }
}

export async function confirmParticipantConsent(request, response, next) {
  try {
    if (request.body.accepted !== true) {
      return response.status(400).json({
        error:
          "É necessário confirmar o consentimento para participar do experimento.",
      });
    }

    const consent = await confirmParticipantConsentById(request.participantId);

    if (!consent) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    return response.status(200).json({ data: consent });
  } catch (error) {
    return next(error);
  }
}

export async function deleteParticipantController(request, response, next) {
  try {
    const deletedParticipant = await deleteParticipantById(request.params.id);

    if (!deletedParticipant) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    return response.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      return response.status(409).json({
        error: "Participante não pode ser excluído pois possui vínculos.",
      });
    }

    return next(error);
  }
}

export async function updateParticipantController(request, response, next) {
  try {
    const { code, group_id, consent_confirmed } = request.body;

    if (!code || !group_id || consent_confirmed === undefined) {
      return response.status(400).json({
        error: "Os campos code, group_id e consent_confirmed são obrigatórios.",
      });
    }

    const currentParticipant = await findParticipantById(request.params.id);

    if (!currentParticipant) {
      return response.status(404).json({
        error: "Participante não encontrado.",
      });
    }

    const group = await findExperimentGroupById(group_id);

    if (!group) {
      return response.status(400).json({
        error: "Grupo informado não existe.",
      });
    }

    const participant = await updateParticipantById(request.params.id, {
      code,
      group_id,
      consent_confirmed,
    });

    return response.status(200).json({ data: participant });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "Já existe um participante com este código.",
      });
    }

    return next(error);
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
