import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import StatusBadge from "../components/StatusBadge";
import { getParticipantDetails } from "../services/admin.service";

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

const PROFILE_LABELS = {
  course_period: "Periodo",
  software_dev_experience: "Experiencia em desenvolvimento",
  software_testing_experience: "Experiencia em testes",
  test_case_experience: "Experiencia com casos de teste",
  requirements_familiarity: "Familiaridade com requisitos",
  genai_usage_frequency: "Frequencia de uso de IA generativa",
  genai_software_usage: "Uso de IA em desenvolvimento",
  genai_test_case_usage: "Uso de IA para geracao de casos de teste",
};

function formatBoolean(value) {
  return value ? "Confirmado" : "Pendente";
}

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

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function ReadOnlyBlock({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-7 text-slate-800">
        {value}
      </pre>
    </div>
  );
}

function ParticipantInputDetails({ mode, participantInput }) {
  if (!participantInput) {
    return null;
  }

  if (mode === "SIMPLE_PROMPT") {
    return (
      <ReadOnlyBlock
        label="Entrada do participante"
        value={participantInput.instruction}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <ReadOnlyBlock label="Objetivo" value={participantInput.objective} />
      <ReadOnlyBlock label="Aspectos" value={participantInput.aspects} />
      <ReadOnlyBlock label="Cenarios" value={participantInput.scenarios} />
      <ReadOnlyBlock
        label="Formato esperado"
        value={participantInput.output_format}
      />
      <ReadOnlyBlock
        label="Outras orientacoes"
        value={participantInput.other_instructions}
      />
    </div>
  );
}

function AdminParticipantDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadDetails() {
    try {
      setIsLoading(true);
      setError("");

      const data = await getParticipantDetails(id);

      setDetails(data);
    } catch (error) {
      setError(error.message || "Nao foi possivel carregar o participante.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialDetails() {
      try {
        const data = await getParticipantDetails(id);

        if (isMounted) {
          setDetails(data);
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Nao foi possivel carregar o participante.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialDetails();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return <Loading>Carregando participante...</Loading>;
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={loadDetails}>Tentar novamente</Button>
          <Button onClick={() => navigate("/admin/participants")} variant="secondary">
            Voltar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex">
        <Button onClick={() => navigate("/admin/participants")} variant="secondary">
          Voltar
        </Button>
      </div>

      <Card>
        <h2 className="text-2xl font-semibold">Dados do participante</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <InfoItem label="Codigo" value={details.participant.code} />
          <InfoItem label="Grupo" value={details.group.name} />
          <InfoItem
            label="Consentimento"
            value={formatBoolean(details.participant.consent_confirmed)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-semibold">Perfil</h2>
        {details.profile ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Object.entries(PROFILE_LABELS).map(([key, label]) => (
              <InfoItem
                key={key}
                label={label}
                value={details.profile[key] || "-"}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-slate-600">Perfil ainda nao preenchido.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-2xl font-semibold">Atividades</h2>
        {details.activities.length === 0 ? (
          <p className="mt-4 text-slate-600">
            Nenhuma atividade encontrada para este participante.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {details.activities.map((activity) => (
              <article
                className="rounded-lg border border-slate-200 p-5"
                key={activity.id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Atividade {activity.task_order}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      {activity.use_case.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {MODE_LABELS[activity.mode] || activity.mode}
                    </p>
                  </div>
                  <StatusBadge status={activity.status}>
                    {STATUS_LABELS[activity.status] || activity.status}
                  </StatusBadge>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoItem label="Inicio" value={formatDate(activity.started_at)} />
                  <InfoItem label="Fim" value={formatDate(activity.finished_at)} />
                  <InfoItem
                    label="Duracao"
                    value={formatDuration(activity.duration_seconds)}
                  />
                  {activity.mode === "MANUAL" ? (
                    <InfoItem
                      label="Quantidade de casos"
                      value={activity.manual?.test_cases_count ?? 0}
                    />
                  ) : (
                    <>
                      <InfoItem label="Modelo" value={activity.ai?.model || "-"} />
                      <InfoItem
                        label="Versao do prompt"
                        value={activity.ai?.prompt_version || "-"}
                      />
                      <InfoItem
                        label="Tempo da API"
                        value={formatResponseTime(activity.ai?.response_time_ms)}
                      />
                    </>
                  )}
                </div>

                {activity.mode !== "MANUAL" && activity.ai ? (
                  <div className="mt-6 grid gap-5">
                    <ParticipantInputDetails
                      mode={activity.mode}
                      participantInput={activity.ai.participant_input}
                    />
                    <ReadOnlyBlock
                      label="Prompt final enviado a IA"
                      value={activity.ai.final_prompt}
                    />
                    <ReadOnlyBlock
                      label="Resposta da IA"
                      value={activity.ai.raw_response}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default AdminParticipantDetailsPage;
