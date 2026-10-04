import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import {
  createAdminParticipant,
  getParticipants,
} from "../services/admin.service";

function formatBoolean(value, positiveLabel = "Confirmado") {
  return value ? positiveLabel : "Pendente";
}

function AdminParticipantsPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [createdParticipant, setCreatedParticipant] = useState(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function loadParticipants() {
    try {
      setIsLoading(true);
      setError("");

      const data = await getParticipants();

      setParticipants(data);
    } catch (error) {
      setError(error.message || "Nao foi possivel carregar os participantes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialParticipants() {
      try {
        const data = await getParticipants();

        if (isMounted) {
          setParticipants(data);
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Nao foi possivel carregar os participantes.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialParticipants();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateParticipant(event) {
    event.preventDefault();

    if (!newParticipantEmail.trim()) {
      setCreateError("Informe o e-mail do participante.");
      return;
    }

    try {
      setIsCreatingParticipant(true);
      setCreateError("");
      setCreatedParticipant(null);

      const participant = await createAdminParticipant({
        email: newParticipantEmail.trim(),
      });

      setCreatedParticipant(participant);
      setNewParticipantEmail("");
      await loadParticipants();
    } catch (error) {
      setCreateError(
        error.message || "Nao foi possivel cadastrar o participante.",
      );
    } finally {
      setIsCreatingParticipant(false);
    }
  }

  if (isLoading) {
    return <Loading>Carregando participantes...</Loading>;
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage>{error}</ErrorMessage>
        <Button className="mt-4" onClick={loadParticipants}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Participantes</h2>
          <p className="mt-2 text-slate-600">
            Acompanhamento administrativo do progresso dos participantes.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm((current) => !current)}>
          Novo participante
        </Button>
      </div>

      {showCreateForm ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold">Cadastrar participante</h3>
          <form
            className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]"
            onSubmit={handleCreateParticipant}
          >
            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-700"
                htmlFor="new-participant-email"
              >
                E-mail
              </label>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                disabled={isCreatingParticipant}
                id="new-participant-email"
                onChange={(event) => setNewParticipantEmail(event.target.value)}
                type="email"
                value={newParticipantEmail}
              />
            </div>
            <Button
              className="self-end"
              disabled={isCreatingParticipant}
              type="submit"
            >
              {isCreatingParticipant
                ? "Cadastrando..."
                : "Cadastrar e enviar acesso"}
            </Button>
          </form>
          <ErrorMessage>{createError}</ErrorMessage>

          {createdParticipant ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold">
                Participante cadastrado com sucesso.
              </p>
              <p className="mt-2">Codigo: {createdParticipant.code}</p>
              <p>Grupo: {createdParticipant.group.name}</p>
              <p>
                Codigo de acesso{" "}
                {createdParticipant.email_sent
                  ? `enviado para: ${createdParticipant.email}`
                  : `nao enviado para: ${createdParticipant.email}`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {participants.length === 0 ? (
        <p className="mt-6 text-slate-600">Nenhum participante encontrado.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:hidden">
            {participants.map((participant) => (
              <article
                className="rounded-lg border border-slate-200 p-4"
                key={participant.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Codigo
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {participant.code}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {participant.group.name}
                    </p>
                  </div>
                  <Button
                    className="py-2"
                    onClick={() =>
                      navigate(`/admin/participants/${participant.id}`)
                    }
                    variant="secondary"
                  >
                    Ver
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-500">
                      Consentimento
                    </p>
                    <p className="mt-1 text-slate-900">
                      {formatBoolean(participant.consent_confirmed)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-500">Perfil</p>
                    <p className="mt-1 text-slate-900">
                      {formatBoolean(
                        participant.profile_completed,
                        "Preenchido",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-500">Pendentes</p>
                    <p className="mt-1 text-slate-900">
                      {participant.tasks.pending}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-500">Em andamento</p>
                    <p className="mt-1 text-slate-900">
                      {participant.tasks.in_progress}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-500">Concluidas</p>
                    <p className="mt-1 text-slate-900">
                      {participant.tasks.completed}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="min-w-[920px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3 pr-4 font-semibold">Codigo</th>
                <th className="py-3 pr-4 font-semibold">Grupo</th>
                <th className="py-3 pr-4 font-semibold">Consentimento</th>
                <th className="py-3 pr-4 font-semibold">Perfil</th>
                <th className="py-3 pr-4 font-semibold">Pendentes</th>
                <th className="py-3 pr-4 font-semibold">Em andamento</th>
                <th className="py-3 pr-4 font-semibold">Concluidas</th>
                <th className="py-3 pr-4 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr
                  className="border-b border-slate-100 text-slate-700"
                  key={participant.id}
                >
                  <td className="py-4 pr-4 font-semibold text-slate-900">
                    {participant.code}
                  </td>
                  <td className="py-4 pr-4">{participant.group.name}</td>
                  <td className="py-4 pr-4">
                    {formatBoolean(participant.consent_confirmed)}
                  </td>
                  <td className="py-4 pr-4">
                    {formatBoolean(participant.profile_completed, "Preenchido")}
                  </td>
                  <td className="py-4 pr-4">{participant.tasks.pending}</td>
                  <td className="py-4 pr-4">
                    {participant.tasks.in_progress}
                  </td>
                  <td className="py-4 pr-4">{participant.tasks.completed}</td>
                  <td className="py-4 pr-4">
                    <Button
                      className="py-2"
                      onClick={() =>
                        navigate(`/admin/participants/${participant.id}`)
                      }
                      variant="secondary"
                    >
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </Card>
  );
}

export default AdminParticipantsPage;
