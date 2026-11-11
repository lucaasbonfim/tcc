import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
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
      <main className="login-page">
        <Loading>Verificando sessão…</Loading>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <p className="eyebrow">Requisita</p>
        <h1>Cada requisito, com a fonte de onde veio.</h1>
        <p>
          Plataforma de pesquisa para analisar requisitos e gerar casos de
          teste com agentes de IA. Decisões, evidências e citações ficam
          registradas por análise.
        </p>
      </section>

      <section className="login-form" aria-labelledby="login-title">
        <h2 id="login-title">Acesso do pesquisador</h2>

        <form className="research-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-email">
            E-mail
            <input
              autoComplete="username"
              disabled={isSubmitting}
              id="admin-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label htmlFor="admin-password">
            Senha
            <input
              autoComplete="current-password"
              disabled={isSubmitting}
              id="admin-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          <ErrorMessage>{error}</ErrorMessage>

          <Button loading={isSubmitting} type="submit">
            {isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}

export default AdminLoginPage;
