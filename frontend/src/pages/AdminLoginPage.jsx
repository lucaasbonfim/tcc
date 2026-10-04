import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import {
  getAuthenticatedSession,
  loginAdmin,
} from "../services/auth.service";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const session = await getAuthenticatedSession();

        if (isMounted && session.role === "admin") {
          navigate("/admin", { replace: true });
        }
      } catch {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Informe e-mail e senha.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await loginAdmin({
        email: email.trim(),
        password,
      });

      navigate("/admin", { replace: true });
    } catch (error) {
      setError(error.message || "Nao foi possivel autenticar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
        <Loading>Verificando sessao administrativa...</Loading>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <Card className="w-full max-w-md p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-teal-700">
          Area administrativa
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          Acesso administrativo
        </h1>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="admin-email"
            >
              E-mail
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              disabled={isSubmitting}
              id="admin-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="admin-password"
            >
              Senha
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              disabled={isSubmitting}
              id="admin-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          <ErrorMessage>{error}</ErrorMessage>

          <Button
            className="w-full text-base"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default AdminLoginPage;
