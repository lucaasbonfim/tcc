import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Loading from "./Loading";
import { getAuthenticatedSession } from "../services/auth.service";

function AdminProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminSession() {
      try {
        const session = await getAuthenticatedSession();

        if (isMounted) {
          setStatus(session.role === "admin" ? "authenticated" : "unauthorized");
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message || "");
          setStatus("unauthorized");
        }
      }
    }

    verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "loading") {
    return <Loading>Verificando acesso administrativo...</Loading>;
  }

  if (status === "unauthorized") {
    return <Navigate to="/admin/login" replace state={{ error }} />;
  }

  return children;
}

export default AdminProtectedRoute;
