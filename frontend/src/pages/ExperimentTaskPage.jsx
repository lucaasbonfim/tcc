import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { getExperimentTask } from "../services/experimentTask.service";
import AITaskPage from "./AITaskPage";
import ManualTaskPage from "./ManualTaskPage";

const AI_MODES = ["SIMPLE_PROMPT", "STRUCTURED_PROMPT"];

function ExperimentTaskPage() {
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

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
        <div className="mx-auto w-full max-w-5xl">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      </main>
    );
  }

  if (task?.mode === "MANUAL") {
    return <ManualTaskPage initialTask={task} />;
  }

  if (task && AI_MODES.includes(task.mode)) {
    return <AITaskPage initialTask={task} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-5xl">
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
      </div>
    </main>
  );
}

export default ExperimentTaskPage;
