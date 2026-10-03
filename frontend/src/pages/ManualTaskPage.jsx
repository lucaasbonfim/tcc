import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { getExperimentTask } from "../services/experimentTask.service";

function ManualTaskPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
          <Card>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Atividade manual
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {task.use_case.title}
            </h1>
            <p className="mt-3 text-slate-600">
              O fluxo de execucao manual sera exibido nesta pagina.
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

export default ManualTaskPage;
