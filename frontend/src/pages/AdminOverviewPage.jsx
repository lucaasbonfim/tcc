import { useEffect, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { getExperimentSummary } from "../services/admin.service";

const MODE_LABELS = {
  MANUAL: "Manual",
  SIMPLE_PROMPT: "IA com prompt simples",
  STRUCTURED_PROMPT: "IA com prompt estruturado",
};

function SummaryCard({ label, value }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

function AdminOverviewPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadSummary() {
    try {
      setIsLoading(true);
      setError("");

      const data = await getExperimentSummary();

      setSummary(data);
      setError("");
    } catch (error) {
      setError(error.message || "Nao foi possivel carregar os dados.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSummary() {
      try {
        const data = await getExperimentSummary();

        if (isMounted) {
          setSummary(data);
          setError("");
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message || "Nao foi possivel carregar os dados.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <Loading>Carregando visao geral...</Loading>;
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage>{error}</ErrorMessage>
        <Button className="mt-4" onClick={loadSummary}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Participantes"
          value={summary.participants.total}
        />
        <SummaryCard
          label="Experimentos concluidos"
          value={summary.participants.with_completed_experiment}
        />
        <SummaryCard label="Atividades" value={summary.tasks.total} />
        <Card>
          <p className="text-sm font-medium text-slate-500">
            Status das atividades
          </p>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>Pendentes: {summary.tasks.pending}</p>
            <p>Em andamento: {summary.tasks.in_progress}</p>
            <p>Concluidas: {summary.tasks.completed}</p>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-2xl font-semibold">Resumo por modo</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {Object.entries(MODE_LABELS).map(([mode, label]) => (
            <article
              className="rounded-lg border border-slate-200 p-5"
              key={mode}
            >
              <h3 className="font-semibold text-slate-900">{label}</h3>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>Total: {summary.by_mode[mode]?.total ?? 0}</p>
                <p>Concluidas: {summary.by_mode[mode]?.completed ?? 0}</p>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default AdminOverviewPage;
