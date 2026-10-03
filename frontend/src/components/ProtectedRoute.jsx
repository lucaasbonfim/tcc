import { Navigate } from "react-router-dom";

function hasParticipantSession() {
  const storedParticipant = sessionStorage.getItem("participant");

  if (!storedParticipant) {
    return false;
  }

  try {
    const participant = JSON.parse(storedParticipant);

    return Boolean(participant?.id && participant?.code);
  } catch {
    sessionStorage.removeItem("participant");
    return false;
  }
}

function ProtectedRoute({ children }) {
  if (!hasParticipantSession()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
