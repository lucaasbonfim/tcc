import { findParticipantById } from "../services/participant.service.js";
import { findAiRunByExperimentTaskId } from "../services/aiRun.service.js";
import { previewExperimentTaskPrompt } from "../services/promptPreview.service.js";
import { generateSimplePromptResult } from "../services/simplePromptGeneration.service.js";
import {
  completeManualExperimentTaskById,
  findExperimentTaskById,
  findManualExperimentTaskResultById,
  findNextParticipantExperimentTask,
  findParticipantExperimentTasks,
  initializeParticipantExperimentTasks,
  startExperimentTaskById,
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

export async function getExperimentTaskAiRun(request, response, next) {
  try {
    const aiRun = await findAiRunByExperimentTaskId(request.params.id);

    return response.status(200).json({ data: aiRun });
  } catch (error) {
    return next(error);
  }
}

export async function generateSimplePromptResultController(
  request,
  response,
  next,
) {
  try {
    const result = await generateSimplePromptResult(
      request.params.id,
      request.body.participant_input,
    );

    return response.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function previewExperimentTaskPromptController(
  request,
  response,
  next,
) {
  try {
    const result = await previewExperimentTaskPrompt(
      request.params.id,
      request.body.participant_input,
    );

    return response.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getManualExperimentTaskResult(request, response, next) {
  try {
    const result = await findManualExperimentTaskResultById(request.params.id);

    return response.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function completeManualExperimentTaskController(
  request,
  response,
  next,
) {
  try {
    const task = await completeManualExperimentTaskById(request.params.id);

    return response.status(200).json({ data: task });
  } catch (error) {
    return next(error);
  }
}

export async function startExperimentTaskController(request, response, next) {
  try {
    const task = await startExperimentTaskById(request.params.id);

    return response.status(200).json({ data: task });
  } catch (error) {
    return next(error);
  }
}

export async function getNextParticipantExperimentTask(
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

    const result = await findNextParticipantExperimentTask(
      request.params.participantId,
    );

    if (!result.initialized) {
      return response.status(404).json({
        error: "As atividades do participante ainda não foram inicializadas.",
      });
    }

    if (result.completed) {
      return response.status(200).json({
        data: null,
        completed: true,
      });
    }

    return response.status(200).json({
      data: result.task,
      completed: false,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getExperimentTaskById(request, response, next) {
  try {
    const task = await findExperimentTaskById(request.params.id);

    if (!task) {
      return response.status(404).json({
        error: "Atividade experimental não encontrada.",
      });
    }

    return response.status(200).json({ data: task });
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
