import {
  findAllExperimentGroups,
  findExperimentGroupById,
  findExperimentGroupTasks,
} from "../services/experimentGroup.service.js";

export async function listExperimentGroups(request, response, next) {
  try {
    const groups = await findAllExperimentGroups();

    response.status(200).json({ data: groups });
  } catch (error) {
    next(error);
  }
}

export async function getExperimentGroupById(request, response, next) {
  try {
    const group = await findExperimentGroupById(request.params.id);

    if (!group) {
      return response.status(404).json({
        error: "Grupo experimental não encontrado.",
      });
    }

    return response.status(200).json({ data: group });
  } catch (error) {
    return next(error);
  }
}

export async function listExperimentGroupTasks(request, response, next) {
  try {
    const group = await findExperimentGroupById(request.params.id);

    if (!group) {
      return response.status(404).json({
        error: "Grupo experimental não encontrado.",
      });
    }

    const tasks = await findExperimentGroupTasks(request.params.id);

    return response.status(200).json({ data: tasks });
  } catch (error) {
    return next(error);
  }
}
