import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import TestCaseForm from "../components/TestCaseForm";
import TestCaseList from "../components/TestCaseList";
import UseCaseView from "../components/UseCaseView";
import {
  completeExperimentTask,
  getExperimentTask,
  startExperimentTask,
} from "../services/experimentTask.service";
import {
  createTestCase,
  deleteTestCase,
  getTestCases,
  updateTestCase,
} from "../services/testCase.service";

function ManualTaskPage({ initialTask = null }) {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const currentTaskId = initialTask?.id || taskId;
  const [task, setTask] = useState(initialTask);
  const [testCases, setTestCases] = useState([]);
  const [editingTestCase, setEditingTestCase] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingTestCase, setIsSavingTestCase] = useState(false);
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const [deletingTestCaseId, setDeletingTestCaseId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTask() {
      try {
        setIsLoading(true);
        setError("");

        const [taskData, testCasesData] = initialTask
          ? [initialTask, await getTestCases(currentTaskId)]
          : await Promise.all([
              getExperimentTask(currentTaskId),
              getTestCases(currentTaskId),
            ]);

        if (isMounted) {
          setTask(taskData);
          setTestCases(testCasesData);
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message || "Nao foi possivel carregar a atividade.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTask();

    return () => {
      isMounted = false;
    };
  }, [currentTaskId, initialTask]);

  async function handleStartTask() {
    try {
      setIsStarting(true);
      setError("");
      setSuccessMessage("");
      setEditingTestCase(null);

      const startedTask = await startExperimentTask(currentTaskId);

      setTask((currentTask) => ({
        ...currentTask,
        ...startedTask,
      }));
    } catch (error) {
      setError(error.message || "Nao foi possivel iniciar a atividade.");
    } finally {
      setIsStarting(false);
    }
  }

  async function refreshTestCases() {
    const testCasesData = await getTestCases(currentTaskId);

    setTestCases(testCasesData);
  }

  async function handleCreateTestCase(data) {
    try {
      setIsSavingTestCase(true);
      setError("");
      setSuccessMessage("");

      await createTestCase(currentTaskId, data);
      await refreshTestCases();

      setSuccessMessage("Caso de teste salvo com sucesso.");
    } catch (error) {
      setError(error.message || "Nao foi possivel salvar o caso de teste.");
      throw error;
    } finally {
      setIsSavingTestCase(false);
    }
  }

  async function handleUpdateTestCase(data) {
    try {
      setIsSavingTestCase(true);
      setError("");
      setSuccessMessage("");

      await updateTestCase(currentTaskId, editingTestCase.id, data);
      await refreshTestCases();

      setEditingTestCase(null);
      setSuccessMessage("Alteracoes salvas com sucesso.");
    } catch (error) {
      setError(error.message || "Nao foi possivel salvar as alteracoes.");
      throw error;
    } finally {
      setIsSavingTestCase(false);
    }
  }

  function handleEditTestCase(testCase) {
    setError("");
    setSuccessMessage("");
    setEditingTestCase(testCase);
  }

  function handleCancelEdit() {
    setEditingTestCase(null);
  }

  async function handleDeleteTestCase(testCase) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este caso de teste?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTestCaseId(testCase.id);
      setError("");
      setSuccessMessage("");

      await deleteTestCase(currentTaskId, testCase.id);
      await refreshTestCases();

      if (editingTestCase?.id === testCase.id) {
        setEditingTestCase(null);
      }

      setSuccessMessage("Caso de teste excluido com sucesso.");
    } catch (error) {
      setError(error.message || "Nao foi possivel excluir o caso de teste.");
    } finally {
      setDeletingTestCaseId(null);
    }
  }

  async function handleCompleteTask() {
    const confirmed = window.confirm(
      "Apos finalizar, os casos de teste nao poderao mais ser alterados. Deseja continuar?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCompletingTask(true);
      setError("");
      setSuccessMessage("");

      const completedTask = await completeExperimentTask(currentTaskId);

      setTask((currentTask) => ({
        ...currentTask,
        ...completedTask,
      }));
      setEditingTestCase(null);
      setSuccessMessage("Atividade concluida com sucesso.");
    } catch (error) {
      setError(error.message || "Nao foi possivel finalizar a atividade.");
    } finally {
      setIsCompletingTask(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
        <div className="mx-auto w-full max-w-5xl">
          <Loading>Carregando atividade...</Loading>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <ErrorMessage>{error}</ErrorMessage>

        {successMessage ? (
          <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
            {successMessage}
          </Card>
        ) : null}

        {!error && task?.mode !== "MANUAL" ? (
          <Card>
            <h1 className="text-2xl font-semibold">
              Interface ainda nao implementada
            </h1>
            <p className="mt-3 text-slate-600">
              Esta atividade utiliza um modo que sera implementado em outra
              etapa.
            </p>
            <Button className="mt-5" onClick={() => navigate("/experiment")}>
              Voltar ao experimento
            </Button>
          </Card>
        ) : null}

        {!error && task?.mode === "MANUAL" ? (
          <>
            <Card>
              <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
                Atividade manual
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                {task.use_case.title}
              </h1>
              <p className="mt-3 text-slate-600">
                Consulte o caso de uso abaixo para criar os casos de teste.
              </p>
            </Card>

            <UseCaseView useCase={task.use_case} />

            {task.status === "PENDING" ? (
              <Card>
                <h2 className="text-2xl font-semibold">Iniciar atividade</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  Quando iniciar, leia o caso de uso e crie os casos de teste
                  que considerar necessarios. O registro experimental comeca
                  somente apos clicar no botao abaixo.
                </p>
                <Button
                  className="mt-5"
                  disabled={isStarting}
                  onClick={handleStartTask}
                >
                  {isStarting ? "Iniciando..." : "Iniciar atividade"}
                </Button>
              </Card>
            ) : null}

            {task.status === "IN_PROGRESS" ? (
              <Card>
                <h2 className="text-2xl font-semibold">
                  Casos de teste manuais
                </h2>
                <div className="mt-5">
                  <TestCaseForm
                    initialValue={editingTestCase}
                    isSubmitting={isSavingTestCase}
                    key={editingTestCase?.id || "new-test-case"}
                    onCancel={
                      editingTestCase ? handleCancelEdit : undefined
                    }
                    onSubmit={
                      editingTestCase
                        ? handleUpdateTestCase
                        : handleCreateTestCase
                    }
                    submitLabel={
                      editingTestCase
                        ? "Salvar alteracoes"
                        : "Salvar caso de teste"
                    }
                  />
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  {testCases.length} caso(s) de teste salvo(s).
                </p>
              </Card>
            ) : null}

            {task.status === "IN_PROGRESS" || task.status === "COMPLETED" ? (
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-semibold">
                    Casos de teste criados
                  </h2>
                  {task.status === "IN_PROGRESS" ? (
                    <Button
                      disabled={testCases.length === 0 || isCompletingTask}
                      onClick={handleCompleteTask}
                    >
                      {isCompletingTask
                        ? "Finalizando..."
                        : "Finalizar atividade"}
                    </Button>
                  ) : null}
                </div>
                <div className="mt-5">
                  <TestCaseList
                    canDelete={task.status === "IN_PROGRESS"}
                    canEdit={task.status === "IN_PROGRESS"}
                    deletingTestCaseId={deletingTestCaseId}
                    onDelete={handleDeleteTestCase}
                    onEdit={handleEditTestCase}
                    testCases={testCases}
                  />
                </div>
              </Card>
            ) : null}

            {task.status === "COMPLETED" ? (
              <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <h2 className="text-2xl font-semibold">
                  Atividade concluida.
                </h2>
                <p className="mt-3 leading-7">
                  Os casos de teste desta atividade nao podem mais ser
                  alterados.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => navigate("/experiment")}
                >
                  Continuar
                </Button>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default ManualTaskPage;
