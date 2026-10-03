import { Navigate } from "react-router-dom";
import { useParticipant } from "../contexts/useParticipant";

function ProtectedRoute({ children }) {
  const { hasActiveSession } = useParticipant();

  if (!hasActiveSession) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
