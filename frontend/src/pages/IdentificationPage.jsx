import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { useParticipant } from "../contexts/useParticipant";
import {
  getAuthenticatedSession,
  loginParticipant,
} from "../services/auth.service";
import { getParticipantOnboarding } from "../services/participant.service";
import { getParticipantNextRoute } from "../utils/participantOnboarding";

function IdentificationPage() {
  const navigate = useNavigate();
  const { hasActiveSession, isLoadingSession, setParticipant } =
    useParticipant();
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function redirectActiveParticipant() {
      if (isLoadingSession || !hasActiveSession) {
        return;
      }

      try {
        const onboarding = await getParticipantOnboarding();

        if (isMounted) {
          navigate(getParticipantNextRoute(onboarding), { replace: true });
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Não foi possível verificar sua etapa atual.",
          );
        }
      }
    }

    if (!isLoadingSession && hasActiveSession) {
      redirectActiveParticipant();
    }

    return () => {
      isMounted = false;
    };
  }, [hasActiveSession, isLoadingSession, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedAccessCode = accessCode.trim();

    if (!trimmedEmail || !trimmedAccessCode) {
      setError("Informe seu e-mail e codigo de acesso para continuar.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      await loginParticipant({
        email: trimmedEmail,
        accessCode: trimmedAccessCode,
      });
      const session = await getAuthenticatedSession();
      const onboarding = await getParticipantOnboarding();

      setParticipant(session.participant);
      navigate(getParticipantNextRoute(onboarding));
    } catch (error) {
      setError(
        error.message || "E-mail ou codigo de acesso invalido.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
        <Loading>Verificando sessao...</Loading>
      </main>
    );
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
          Informe seu e-mail e codigo de acesso para continuar.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="participant-email"
            >
              E-mail
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              disabled={isLoading}
              id="participant-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="participant-access-code"
            >
              Codigo de acesso
            </label>
            <input
              autoComplete="one-time-code"
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base uppercase text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              disabled={isLoading}
              id="participant-access-code"
              maxLength={8}
              onChange={(event) => setAccessCode(event.target.value)}
              type="text"
              value={accessCode}
            />
          </div>

          <ErrorMessage>{error}</ErrorMessage>

          <Button
            className="w-full text-base"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default IdentificationPage;
