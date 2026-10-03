import { findAllExperimentGroups } from "../services/experimentGroup.service.js";

export async function listExperimentGroups(request, response, next) {
  try {
    const groups = await findAllExperimentGroups();

    response.status(200).json({ data: groups });
  } catch (error) {
    next(error);
  }
}
