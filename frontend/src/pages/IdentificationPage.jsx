import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import { useParticipant } from "../contexts/useParticipant";
import { findParticipantByCode } from "../services/participant.service";

function IdentificationPage() {
  const navigate = useNavigate();
  const { hasActiveSession, setParticipant } = useParticipant();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hasActiveSession) {
      navigate("/experiment", { replace: true });
    }
  }, [hasActiveSession, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError("Informe o codigo do participante para continuar.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const participant = await findParticipantByCode(trimmedCode);

      setParticipant({
        id: participant.id,
        code: participant.code,
      });
      navigate("/experiment");
    } catch (error) {
      setError(
        error.message ||
          "Nao foi possivel validar o codigo. Verifique sua conexao.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <Card className="w-full max-w-md p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-teal-700">
          Experimento
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          Experimento de Geracao de Casos de Teste
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Informe seu codigo de participante para continuar.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="participant-code"
            >
              Codigo do participante
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              disabled={isLoading}
              id="participant-code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="P01"
              type="text"
              value={code}
            />
          </div>

          <ErrorMessage>{error}</ErrorMessage>

          <Button
            className="w-full text-base"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Validando..." : "Continuar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default IdentificationPage;
