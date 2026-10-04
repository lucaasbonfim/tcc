import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import StatusBadge from "../components/StatusBadge";
import { useParticipant } from "../contexts/useParticipant";
import {
  getNextParticipantTask,
  getParticipantProfile,
  getParticipantTasks,
  initializeParticipantTasks,
} from "../services/participant.service";

const MODE_LABELS = {
  MANUAL: "Manual",
  SIMPLE_PROMPT: "IA com prompt simples",
  STRUCTURED_PROMPT: "IA com prompt estruturado",
};

const STATUS_LABELS = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluida",
};

function ExperimentPage() {
  const navigate = useNavigate();
  const { clearParticipant, participant } = useParticipant();
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingNextTask, setIsLoadingNextTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExperimentCompleted, setIsExperimentCompleted] = useState(false);

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "COMPLETED").length,
    [tasks],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadExperimentData() {
      try {
        setIsLoading(true);
        setError("");

        const [profileResult, tasksResult] = await Promise.allSettled([
          getParticipantProfile(participant.id),
          getParticipantTasks(participant.id),
        ]);

        if (!isMounted) {
          return;
        }

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
        } else if (profileResult.reason?.status === 404) {
          setProfile(null);
        } else {
          throw profileResult.reason;
        }

        if (tasksResult.status === "fulfilled") {
          setTasks(tasksResult.value);
        } else if (tasksResult.reason?.status === 404) {
          setTasks([]);
        } else {
          throw tasksResult.reason;
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message ||
              "Nao foi possivel carregar os dados do experimento.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadExperimentData();

    return () => {
      isMounted = false;
    };
  }, [participant.id]);

  async function handleLogout() {
    await clearParticipant();
    navigate("/", { replace: true });
  }

  async function handleInitializeExperiment() {
    try {
      setIsInitializing(true);
      setError("");

      await initializeParticipantTasks(participant.id);

      const updatedTasks = await getParticipantTasks(participant.id);
      setTasks(updatedTasks);
      setIsExperimentCompleted(false);
    } catch (error) {
      setError(
        error.message ||
          "Nao foi possivel inicializar as atividades do experimento.",
      );
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleContinueExperiment() {
    try {
      setIsLoadingNextTask(true);
      setError("");
      setIsExperimentCompleted(false);

      const result = await getNextParticipantTask(participant.id);

      if (result.completed) {
        setIsExperimentCompleted(true);
        return;
      }

      navigate(`/experiment/task/${result.data.id}`);
    } catch (error) {
      setError(
        error.message || "Nao foi possivel consultar a proxima atividade.",
      );
    } finally {
      setIsLoadingNextTask(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Area do participante
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Inicio do experimento
            </h1>
            <p className="mt-2 text-slate-600">
              Codigo do participante:{" "}
              <span className="font-semibold text-slate-900">
                {participant.code}
              </span>
            </p>
          </div>
          <Button className="py-2" onClick={handleLogout} variant="secondary">
            Sair
          </Button>
        </Card>

        {isLoading ? <Loading>Carregando dados do experimento...</Loading> : null}

        <ErrorMessage>{error}</ErrorMessage>

        {!isLoading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm font-medium text-slate-500">Perfil</p>
                <p className="mt-2 text-2xl font-semibold">
                  {profile ? "Preenchido" : "Pendente"}
                </p>
              </Card>
              <Card>
                <p className="text-sm font-medium text-slate-500">Progresso</p>
                <p className="mt-2 text-2xl font-semibold">
                  {completedTasks} de 3 atividades concluidas
                </p>
              </Card>
            </section>

            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Atividades</h2>
                {tasks.length > 0 ? (
                  <Button
                    disabled={isLoadingNextTask}
                    onClick={handleContinueExperiment}
                  >
                    {isLoadingNextTask
                      ? "Consultando..."
                      : "Continuar experimento"}
                  </Button>
                ) : null}
              </div>

              {tasks.length > 0 ? (
                <div className="mt-5 grid gap-4">
                  {tasks.map((task) => (
                    <article
                      className="rounded-lg border border-slate-200 p-5"
                      key={task.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            Atividade {task.task_order}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">
                            {task.use_case.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {MODE_LABELS[task.mode] || task.mode}
                          </p>
                        </div>
                        <StatusBadge status={task.status}>
                          {STATUS_LABELS[task.status] || task.status}
                        </StatusBadge>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-5">
                  <p className="text-slate-600">
                    As atividades ainda nao foram inicializadas.
                  </p>
                  {profile ? (
                    <Button
                      className="mt-4"
                      disabled={isInitializing}
                      onClick={handleInitializeExperiment}
                    >
                      {isInitializing
                        ? "Inicializando..."
                        : "Iniciar experimento"}
                    </Button>
                  ) : null}
                </div>
              )}
            </Card>

            {isExperimentCompleted ? (
              <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <h2 className="text-xl font-semibold">
                  Experimento concluido.
                </h2>
              </Card>
            ) : null}

          </>
        ) : null}
      </div>
    </main>
  );
}

export default ExperimentPage;
