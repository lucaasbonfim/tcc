import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { downloadExperimentJson } from "../services/admin.service";

const NAV_ITEMS = [
  { label: "Visao geral", to: "/admin" },
  { label: "Participantes", to: "/admin/participants" },
  { label: "Atividades", to: "/admin/tasks" },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AdminLayout() {
  const [exportError, setExportError] = useState("");
  const [isExportingJson, setIsExportingJson] = useState(false);

  async function handleExportJson() {
    try {
      setIsExportingJson(true);
      setExportError("");

      const blob = await downloadExperimentJson();

      downloadBlob(blob, "experiment-results.json");
    } catch (error) {
      setExportError(error.message || "Nao foi possivel exportar os dados.");
    } finally {
      setIsExportingJson(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Area administrativa
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                Experimento de Geracao de Casos de Teste
              </h1>
              <p className="mt-2 text-slate-600">
                Acompanhe participantes, atividades e exportacoes do
                experimento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={isExportingJson}
                onClick={handleExportJson}
                type="button"
              >
                {isExportingJson ? "Exportando JSON..." : "Exportar JSON"}
              </button>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                type="button"
              >
                Exportar CSV
              </button>
            </div>
          </div>
          {exportError ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {exportError}
            </p>
          ) : null}
        </header>

        <nav className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-teal-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`
              }
              end={item.to === "/admin"}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </main>
  );
}

export default AdminLayout;
