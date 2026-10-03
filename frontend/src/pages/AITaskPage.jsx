import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import UseCaseView from "../components/UseCaseView";
import {
  completeExperimentTask,
  generateExperimentTask,
  getExperimentTask,
  getExperimentTaskAiRun,
  getExperimentTaskResult,
  startExperimentTask,
} from "../services/experimentTask.service";

const AI_MODES = ["SIMPLE_PROMPT", "STRUCTURED_PROMPT"];
const MODE_LABELS = {
  SIMPLE_PROMPT: "IA com prompt simples",
  STRUCTURED_PROMPT: "IA com prompt estruturado",
};

function AITaskPage({ initialTask = null }) {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [task, setTask] = useState(initialTask);
  const [error, setError] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTask() {
      try {
        setIsLoading(true);
        setError("");

        const taskData = initialTask || (await getExperimentTask(taskId));
        let currentAiResponse = "";

        if (taskData.status === "IN_PROGRESS") {
          try {
            const aiRun = await getExperimentTaskAiRun(taskData.id);

            currentAiResponse = aiRun.raw_response;
          } catch (error) {
            if (error.status !== 404) {
              throw error;
            }
          }
        }

        if (taskData.status === "COMPLETED") {
          const result = await getExperimentTaskResult(taskData.id);

          currentAiResponse = result.ai_run?.raw_response || "";
        }

        if (isMounted) {
          setTask(taskData);
          setAiResponse(currentAiResponse);
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
  }, [initialTask, taskId]);

  async function handleStartTask() {
    try {
      setIsStarting(true);
      setError("");
      setSuccessMessage("");

      const startedTask = await startExperimentTask(task.id);

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

  async function handleGenerate() {
    try {
      setIsGenerating(true);
      setError("");
      setSuccessMessage("");

      const result = await generateExperimentTask(task.id);

      setAiResponse(result.response);
    } catch (error) {
      setError(error.message || "Nao foi possivel gerar os casos de teste.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCompleteTask() {
    const confirmed = window.confirm(
      "Apos finalizar, esta atividade nao podera ser realizada novamente. Deseja continuar?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCompleting(true);
      setError("");
      setSuccessMessage("");

      const completedTask = await completeExperimentTask(task.id);

      setTask((currentTask) => ({
        ...currentTask,
        ...completedTask,
      }));
      setSuccessMessage("Atividade concluida com sucesso.");
    } catch (error) {
      setError(error.message || "Nao foi possivel finalizar a atividade.");
    } finally {
      setIsCompleting(false);
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

        {!error && task?.mode === "MANUAL" ? (
          <Card>
            <h1 className="text-2xl font-semibold">Atividade manual</h1>
            <p className="mt-3 text-slate-600">
              Esta atividade utiliza o fluxo manual.
            </p>
            <Button
              className="mt-5"
              onClick={() => navigate(`/experiment/task/${task.id}`)}
            >
              Abrir atividade manual
            </Button>
          </Card>
        ) : null}

        {!error && task && !AI_MODES.includes(task.mode) ? (
          <Card>
            <h1 className="text-2xl font-semibold">
              Modo de atividade indisponivel
            </h1>
            <p className="mt-3 text-slate-600">
              Esta atividade nao pode ser exibida nesta interface.
            </p>
            <Button className="mt-5" onClick={() => navigate("/experiment")}>
              Voltar ao experimento
            </Button>
          </Card>
        ) : null}

        {!error && task && AI_MODES.includes(task.mode) ? (
          <>
            <Card>
              <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
                Atividade com IA
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                {task.use_case.title}
              </h1>
              <p className="mt-3 text-slate-600">
                Modo: {MODE_LABELS[task.mode]}
              </p>
            </Card>

            <UseCaseView useCase={task.use_case} />

            {task.status === "PENDING" ? (
              <Card>
                <h2 className="text-2xl font-semibold">Iniciar atividade</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  Quando iniciar, o backend registrara o inicio da atividade.
                  Depois disso, a geracao dos casos de teste ficara disponivel.
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
                <h2 className="text-2xl font-semibold">Geracao por IA</h2>
                {aiResponse ? (
                  <p className="mt-3 leading-7 text-slate-600">
                    Casos de teste gerados.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 leading-7 text-slate-600">
                      A atividade foi iniciada. A geracao dos casos de teste
                      sera realizada pelo backend.
                    </p>
                    <Button
                      className="mt-5"
                      disabled={isGenerating}
                      onClick={handleGenerate}
                    >
                      {isGenerating
                        ? "Gerando casos de teste..."
                        : "Gerar casos de teste"}
                    </Button>
                  </>
                )}
              </Card>
            ) : null}

            {aiResponse ? (
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-semibold">
                    Casos de teste gerados
                  </h2>
                  {task.status === "IN_PROGRESS" ? (
                    <Button
                      disabled={isCompleting}
                      onClick={handleCompleteTask}
                    >
                      {isCompleting
                        ? "Finalizando..."
                        : "Finalizar atividade"}
                    </Button>
                  ) : null}
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-7 text-slate-800">
                  {aiResponse}
                </pre>
              </Card>
            ) : null}

            {task.status === "COMPLETED" ? (
              <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <h2 className="text-2xl font-semibold">
                  Atividade concluida.
                </h2>
                <Button
                  className="mt-5"
                  onClick={() => navigate("/experiment")}
                >
                  Voltar ao experimento
                </Button>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default AITaskPage;
