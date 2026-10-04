import { Navigate } from "react-router-dom";
import { useParticipant } from "../contexts/useParticipant";
import Loading from "./Loading";

function ProtectedRoute({ children }) {
  const { hasActiveSession, isLoadingSession } = useParticipant();

  if (isLoadingSession) {
    return <Loading>Verificando sessao...</Loading>;
  }

  if (!hasActiveSession) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
