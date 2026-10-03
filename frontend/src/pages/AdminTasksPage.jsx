import { useEffect, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import StatusBadge from "../components/StatusBadge";
import { getExperimentTasks } from "../services/admin.service";

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

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds) {
  if (seconds == null) {
    return "-";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds} s`;
  }

  return `${minutes} min ${remainingSeconds} s`;
}

function formatResponseTime(milliseconds) {
  if (milliseconds == null) {
    return "-";
  }

  return `${milliseconds} ms`;
}

function AdminTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({
    mode: "",
    status: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadTasks(nextFilters = filters) {
    try {
      setIsLoading(true);
      setError("");

      const data = await getExperimentTasks(nextFilters);

      setTasks(data);
    } catch (error) {
      setError(error.message || "Nao foi possivel carregar as atividades.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialTasks() {
      try {
        const data = await getExperimentTasks(filters);

        if (isMounted) {
          setTasks(data);
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message || "Nao foi possivel carregar as atividades.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialTasks();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  function handleFilterChange(field, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  }

  function handleClearFilters() {
    setFilters({
      mode: "",
      status: "",
    });
  }

  if (isLoading) {
    return <Loading>Carregando atividades...</Loading>;
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage>{error}</ErrorMessage>
        <Button className="mt-4" onClick={() => loadTasks()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-semibold">Atividades</h2>
      <p className="mt-2 text-slate-600">
        Consulta administrativa consolidada das atividades do experimento.
      </p>

      <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Modo
          </label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            onChange={(event) => handleFilterChange("mode", event.target.value)}
            value={filters.mode}
          >
            <option value="">Todos</option>
            <option value="MANUAL">Manual</option>
            <option value="SIMPLE_PROMPT">IA com prompt simples</option>
            <option value="STRUCTURED_PROMPT">
              IA com prompt estruturado
            </option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            onChange={(event) =>
              handleFilterChange("status", event.target.value)
            }
            value={filters.status}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluida</option>
          </select>
        </div>

        <Button onClick={handleClearFilters} variant="secondary">
          Limpar filtros
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-6 text-slate-600">
          Nenhuma atividade corresponde aos filtros selecionados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3 pr-4 font-semibold">Participante</th>
                <th className="py-3 pr-4 font-semibold">Grupo</th>
                <th className="py-3 pr-4 font-semibold">Ordem</th>
                <th className="py-3 pr-4 font-semibold">Caso de uso</th>
                <th className="py-3 pr-4 font-semibold">Modo</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Inicio</th>
                <th className="py-3 pr-4 font-semibold">Fim</th>
                <th className="py-3 pr-4 font-semibold">Duracao</th>
                <th className="py-3 pr-4 font-semibold">Tempo IA</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  className="border-b border-slate-100 text-slate-700"
                  key={task.task_id}
                >
                  <td className="py-4 pr-4 font-semibold text-slate-900">
                    {task.participant.code}
                  </td>
                  <td className="py-4 pr-4">{task.group.name}</td>
                  <td className="py-4 pr-4">{task.task_order}</td>
                  <td className="py-4 pr-4">{task.use_case.title}</td>
                  <td className="py-4 pr-4">
                    {MODE_LABELS[task.mode] || task.mode}
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={task.status}>
                      {STATUS_LABELS[task.status] || task.status}
                    </StatusBadge>
                  </td>
                  <td className="py-4 pr-4">{formatDate(task.started_at)}</td>
                  <td className="py-4 pr-4">{formatDate(task.finished_at)}</td>
                  <td className="py-4 pr-4">
                    {formatDuration(task.duration_seconds)}
                  </td>
                  <td className="py-4 pr-4">
                    {task.mode === "MANUAL"
                      ? "-"
                      : formatResponseTime(task.ai?.response_time_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default AdminTasksPage;
