import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const STATUS_STYLES = {
  PENDING: "border-slate-200 bg-slate-100 text-slate-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
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
  const [nextTask, setNextTask] = useState(null);
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

  function handleLogout() {
    clearParticipant();
    navigate("/", { replace: true });
  }

  async function handleInitializeExperiment() {
    try {
      setIsInitializing(true);
      setError("");

      await initializeParticipantTasks(participant.id);

      const updatedTasks = await getParticipantTasks(participant.id);
      setTasks(updatedTasks);
      setNextTask(null);
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
      setNextTask(null);
      setIsExperimentCompleted(false);

      const result = await getNextParticipantTask(participant.id);

      if (result.completed) {
        setIsExperimentCompleted(true);
        return;
      }

      setNextTask(result.data);
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
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={handleLogout}
            type="button"
          >
            Sair
          </button>
        </header>

        {isLoading ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Carregando dados do experimento...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </section>
        ) : null}

        {!isLoading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Perfil</p>
                <p className="mt-2 text-2xl font-semibold">
                  {profile ? "Preenchido" : "Pendente"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Progresso</p>
                <p className="mt-2 text-2xl font-semibold">
                  {completedTasks} de 3 atividades concluidas
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Atividades</h2>
                {tasks.length > 0 ? (
                  <button
                    className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isLoadingNextTask}
                    onClick={handleContinueExperiment}
                    type="button"
                  >
                    {isLoadingNextTask
                      ? "Consultando..."
                      : "Continuar experimento"}
                  </button>
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
                        <span
                          className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-medium ${
                            STATUS_STYLES[task.status] || STATUS_STYLES.PENDING
                          }`}
                        >
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
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
                    <button
                      className="mt-4 rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      disabled={isInitializing}
                      onClick={handleInitializeExperiment}
                      type="button"
                    >
                      {isInitializing
                        ? "Inicializando..."
                        : "Iniciar experimento"}
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            {isExperimentCompleted ? (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-800 shadow-sm">
                <h2 className="text-xl font-semibold">
                  Experimento concluido.
                </h2>
              </section>
            ) : null}

            {nextTask ? (
              <section className="rounded-lg border border-teal-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
                  Proxima atividade
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Modo</p>
                    <p className="mt-1 text-lg font-semibold">
                      {MODE_LABELS[nextTask.mode] || nextTask.mode}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Caso de uso
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {nextTask.use_case.title}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default ExperimentPage;
