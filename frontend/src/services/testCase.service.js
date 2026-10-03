import api from "./api";

export async function getTestCases(taskId) {
  const response = await api.get(`/experiment-tasks/${taskId}/test-cases`);

  return response.data.data;
}

export async function createTestCase(taskId, data) {
  const response = await api.post(
    `/experiment-tasks/${taskId}/test-cases`,
    data,
  );

  return response.data.data;
}

export async function updateTestCase(taskId, testCaseId, data) {
  const response = await api.put(
    `/experiment-tasks/${taskId}/test-cases/${testCaseId}`,
    data,
  );

  return response.data.data;
}

export async function deleteTestCase(taskId, testCaseId) {
  await api.delete(`/experiment-tasks/${taskId}/test-cases/${testCaseId}`);
}
