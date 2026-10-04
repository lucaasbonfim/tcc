import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useParticipant } from "../contexts/useParticipant";
import { getParticipantOnboarding } from "../services/participant.service";
import { getParticipantNextRoute } from "../utils/participantOnboarding";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";

function ExperimentReadyRoute({ children }) {
  const { hasActiveSession, isLoadingSession } = useParticipant();
  const [redirectTo, setRedirectTo] = useState("");
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOnboarding() {
      if (isLoadingSession || !hasActiveSession) {
        return;
      }

      try {
        setIsLoadingOnboarding(true);
        setError("");

        const onboarding = await getParticipantOnboarding();
        const nextRoute = getParticipantNextRoute(onboarding);

        if (isMounted) {
          setRedirectTo(nextRoute === "/experiment" ? "" : nextRoute);
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Não foi possível verificar o acesso.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingOnboarding(false);
        }
      }
    }

    loadOnboarding();

    return () => {
      isMounted = false;
    };
  }, [hasActiveSession, isLoadingSession]);

  if (isLoadingSession) {
    return <Loading>Verificando sessão...</Loading>;
  }

  if (!hasActiveSession) {
    return <Navigate to="/" replace />;
  }

  if (isLoadingOnboarding) {
    return <Loading>Verificando etapas iniciais...</Loading>;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
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

  return children;
}

export default ExperimentReadyRoute;
