import {
  exportExperimentDataAsCsv,
  exportExperimentDataAsJson,
  exportExperimentDataAsXlsx,
  findExperimentTasks,
  findParticipantDetailsById,
  findParticipantsProgress,
  getExperimentSummary,
} from "../services/admin.service.js";
import { createParticipantAccess as createParticipantAccessService } from "../services/participantAccess.service.js";

export async function createParticipantAccessController(request, response, next) {
  try {
    const participant = await createParticipantAccessService(request.body);

    return response.status(201).json({ data: participant });
  } catch (error) {
    return next(error);
  }
}

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

export async function exportExperimentXlsx(request, response, next) {
  try {
    const xlsx = await exportExperimentDataAsXlsx();

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="experiment-results.xlsx"',
    );

    return response.status(200).send(xlsx);
  } catch (error) {
    return next(error);
  }
}
