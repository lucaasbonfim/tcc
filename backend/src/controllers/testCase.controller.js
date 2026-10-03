import {
  createManualTestCase,
  findTestCasesByExperimentTaskId,
  updateManualTestCase,
} from "../services/testCase.service.js";

function validateTestCaseBody(body) {
  if (!body.title) {
    return "O campo title é obrigatório.";
  }

  if (!Array.isArray(body.preconditions)) {
    return "O campo preconditions deve ser um array.";
  }

  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return "O campo steps deve ser um array com pelo menos um item.";
  }

  if (!body.expected_result) {
    return "O campo expected_result é obrigatório.";
  }

  return null;
}

export async function createManualTestCaseController(request, response, next) {
  try {
    const validationError = validateTestCaseBody(request.body);

    if (validationError) {
      return response.status(400).json({ error: validationError });
    }

    const testCase = await createManualTestCase(
      request.params.taskId,
      request.body,
    );

    return response.status(201).json({ data: testCase });
  } catch (error) {
    return next(error);
  }
}

export async function listExperimentTaskTestCases(request, response, next) {
  try {
    const testCases = await findTestCasesByExperimentTaskId(
      request.params.taskId,
    );

    return response.status(200).json({ data: testCases });
  } catch (error) {
    return next(error);
  }
}

export async function updateManualTestCaseController(request, response, next) {
  try {
    const validationError = validateTestCaseBody(request.body);

    if (validationError) {
      return response.status(400).json({ error: validationError });
    }

    const testCase = await updateManualTestCase(
      request.params.taskId,
      request.params.testCaseId,
      request.body,
    );

    return response.status(200).json({ data: testCase });
  } catch (error) {
    return next(error);
  }
}
