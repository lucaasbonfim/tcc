import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { getParticipants } from "../services/admin.service";

function formatBoolean(value, positiveLabel = "Confirmado") {
  return value ? positiveLabel : "Pendente";
}

function AdminParticipantsPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
      </div>

      {participants.length === 0 ? (
        <p className="mt-6 text-slate-600">Nenhum participante encontrado.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
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
      )}
    </Card>
  );
}

export default AdminParticipantsPage;
