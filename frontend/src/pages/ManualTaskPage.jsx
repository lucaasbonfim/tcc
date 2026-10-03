import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import UseCaseView from "../components/UseCaseView";
import {
  getExperimentTask,
  startExperimentTask,
} from "../services/experimentTask.service";

function ManualTaskPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTask() {
      try {
        setIsLoading(true);
        setError("");

        const taskData = await getExperimentTask(taskId);

        if (isMounted) {
          setTask(taskData);
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
  }, [taskId]);

  async function handleStartTask() {
    try {
      setIsStarting(true);
      setError("");

      const startedTask = await startExperimentTask(taskId);

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
                <p className="mt-3 leading-7 text-slate-600">
                  A interface para criar os casos de teste sera exibida aqui.
                </p>
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
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default ManualTaskPage;
