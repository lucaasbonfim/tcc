import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { useParticipant } from "../contexts/useParticipant";
import {
  confirmParticipantConsent,
  getParticipantOnboarding,
} from "../services/participant.service";

const CONSENT_ITEMS = [
  "Este é um experimento acadêmico sobre geração de casos de teste utilizando IA Generativa.",
  "O objetivo geral da pesquisa é observar a criação de casos de teste em diferentes formas de apoio durante o experimento.",
  "A participação é voluntária, e você poderá deixar de participar antes da realização do experimento.",
  "Os dados experimentais serão tratados de forma pseudonimizada.",
  "O e-mail será utilizado somente para controle de acesso.",
  "Os resultados acadêmicos serão associados ao código experimental, e não ao e-mail.",
  "A participação não possui relação com avaliação ou desempenho acadêmico.",
  "Serão coletadas informações de caracterização e resultados das atividades realizadas durante o experimento.",
];

function ConsentPage() {
  const navigate = useNavigate();
  const { clearParticipant, participant } = useParticipant();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function protectConsentStep() {
      try {
        setIsLoading(true);
        setError("");

        const onboarding = await getParticipantOnboarding();

        if (!isMounted) {
          return;
        }

        if (onboarding.consent_confirmed && onboarding.profile_completed) {
          navigate("/experiment", { replace: true });
          return;
        }

        if (onboarding.consent_confirmed) {
          navigate("/profile", { replace: true });
          return;
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Não foi possível verificar o consentimento.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    protectConsentStep();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function handleConfirm() {
    if (!accepted || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await confirmParticipantConsent();
      navigate("/profile", { replace: true });
    } catch (error) {
      setError(
        error.message || "Não foi possível registrar o consentimento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await clearParticipant();
    navigate("/", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Consentimento
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              Termo de Consentimento para Participação no Experimento
            </h1>
            <p className="mt-2 text-slate-600">
              Código do participante:{" "}
              <span className="font-semibold text-slate-900">
                {participant.code}
              </span>
            </p>
          </div>
          <Button className="py-2" onClick={handleLogout} variant="secondary">
            Sair
          </Button>
        </Card>

        {isLoading ? <Loading>Verificando consentimento...</Loading> : null}

        {!isLoading ? (
          <Card>
          <div className="space-y-4 text-base leading-7 text-slate-700">
            {CONSENT_ITEMS.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <label
            className="mt-8 flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-800"
            htmlFor="consent-accepted"
          >
            <input
              checked={accepted}
              className="mt-1 h-4 w-4 accent-teal-700"
              disabled={isSubmitting}
              id="consent-accepted"
              onChange={(event) => setAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>
              Li as informações acima e concordo voluntariamente em participar
              do experimento.
            </span>
          </label>

          <div className="mt-5">
            <ErrorMessage>{error}</ErrorMessage>
          </div>

          <Button
            className="mt-5 w-full text-base"
            disabled={!accepted || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "Confirmando..." : "Confirmar e continuar"}
          </Button>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

export default ConsentPage;
