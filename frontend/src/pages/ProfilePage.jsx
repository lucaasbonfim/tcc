import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { useParticipant } from "../contexts/useParticipant";
import {
  createParticipantProfile,
  getParticipantOnboarding,
} from "../services/participant.service";

const INITIAL_PROFILE = {
  course_period: "",
  software_dev_experience: "",
  software_testing_experience: "",
  test_case_experience: "",
  requirements_familiarity: "",
  genai_usage_frequency: "",
  genai_software_usage: "",
  genai_test_case_usage: "",
};

const EXPERIENCE_OPTIONS = [
  "Nenhuma",
  "Básica",
  "Intermediária",
  "Avançada",
];

const YES_NO_OPTIONS = ["Não", "Sim, ocasionalmente", "Sim, frequentemente"];

const PROFILE_FIELDS = [
  {
    name: "course_period",
    label: "Período do curso",
    options: [
      "1º período",
      "2º período",
      "3º período",
      "4º período",
      "5º período",
      "6º período",
      "7º período",
      "8º período",
      "9º período ou superior",
      "Não se aplica",
    ],
  },
  {
    name: "software_dev_experience",
    label: "Experiência em desenvolvimento de software",
    options: EXPERIENCE_OPTIONS,
  },
  {
    name: "software_testing_experience",
    label: "Experiência em testes de software",
    options: EXPERIENCE_OPTIONS,
  },
  {
    name: "test_case_experience",
    label: "Experiência com criação de casos de teste",
    options: EXPERIENCE_OPTIONS,
  },
  {
    name: "requirements_familiarity",
    label: "Familiaridade com especificações de requisitos",
    options: EXPERIENCE_OPTIONS,
  },
  {
    name: "genai_usage_frequency",
    label: "Frequência de uso de IA generativa",
    options: ["Nunca", "Raramente", "Mensalmente", "Semanalmente", "Diariamente"],
  },
  {
    name: "genai_software_usage",
    label: "Uso de IA generativa em desenvolvimento de software",
    options: YES_NO_OPTIONS,
  },
  {
    name: "genai_test_case_usage",
    label: "Uso de IA generativa para criação de casos de teste",
    options: YES_NO_OPTIONS,
  },
];

function ProfilePage() {
  const navigate = useNavigate();
  const { clearParticipant, participant } = useParticipant();
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isComplete = PROFILE_FIELDS.every((field) => profile[field.name]);

  useEffect(() => {
    let isMounted = true;

    async function protectProfileStep() {
      try {
        setIsLoading(true);
        setError("");

        const onboarding = await getParticipantOnboarding();

        if (!isMounted) {
          return;
        }

        if (!onboarding.consent_confirmed) {
          navigate("/consent", { replace: true });
          return;
        }

        if (onboarding.profile_completed) {
          navigate("/experiment", { replace: true });
          return;
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error.message || "Não foi possível verificar o questionário.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    protectProfileStep();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isComplete || isSubmitting) {
      setError("Preencha todas as informações para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await createParticipantProfile(participant.id, profile);
      navigate("/experiment", { replace: true });
    } catch (error) {
      setError(error.message || "Não foi possível salvar o questionário.");
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
              Caracterização
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              Questionário de Caracterização
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

        {isLoading ? <Loading>Verificando questionário...</Loading> : null}

        {!isLoading ? (
          <Card>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {PROFILE_FIELDS.map((field) => (
              <div key={field.name}>
                <label
                  className="mb-2 block text-sm font-medium text-slate-700"
                  htmlFor={field.name}
                >
                  {field.label}
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  disabled={isSubmitting}
                  id={field.name}
                  name={field.name}
                  onChange={handleChange}
                  required
                  value={profile[field.name]}
                >
                  <option value="">Selecione uma opção</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <ErrorMessage>{error}</ErrorMessage>

            <Button
              className="w-full text-base"
              disabled={!isComplete || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

export default ProfilePage;
