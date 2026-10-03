import {
  exportExperimentDataAsCsv,
  exportExperimentDataAsJson,
  exportExperimentDataAsXls,
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

export async function exportExperimentJson(request, response, next) {
  try {
    const data = await exportExperimentDataAsJson();

    return response.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

export async function exportExperimentCsv(request, response, next) {
  try {
    const csv = await exportExperimentDataAsCsv();

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="experiment-results.csv"',
    );

    return response.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
}

export async function exportExperimentXls(request, response, next) {
  try {
    const xls = await exportExperimentDataAsXls();

    response.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="experiment-results.xls"',
    );

    return response.status(200).send(xls);
  } catch (error) {
    return next(error);
  }
}
