import { useState } from "react";
import Button from "./Button";
import ErrorMessage from "./ErrorMessage";

function createEmptyForm() {
  return {
    title: "",
    preconditions: [""],
    steps: [""],
    expected_result: "",
  };
}

function createFormFromTestCase(testCase) {
  if (!testCase) {
    return createEmptyForm();
  }

  return {
    title: testCase.title || "",
    preconditions:
      testCase.preconditions?.length > 0 ? testCase.preconditions : [""],
    steps: testCase.steps?.length > 0 ? testCase.steps : [""],
    expected_result: testCase.expected_result || "",
  };
}

function updateListItem(items, index, value) {
  return items.map((item, currentIndex) =>
    currentIndex === index ? value : item,
  );
}

function removeListItem(items, index) {
  const updatedItems = items.filter((_, currentIndex) => currentIndex !== index);

  return updatedItems.length > 0 ? updatedItems : [""];
}

function normalizeItems(items) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function DynamicList({
  addLabel,
  ariaLabel,
  items,
  numbered = false,
  onAdd,
  onChange,
  onRemove,
  placeholder,
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div className="flex gap-2" key={`${ariaLabel}-${index}`}>
          <div className="flex flex-1 items-center gap-2">
            {numbered ? (
              <span className="w-6 text-sm font-medium text-slate-500">
                {index + 1}.
              </span>
            ) : null}
            <input
              aria-label={`${ariaLabel} ${index + 1}`}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              onChange={(event) => onChange(index, event.target.value)}
              placeholder={placeholder}
              type="text"
              value={item}
            />
          </div>
          <Button
            className="px-3 py-2"
            onClick={() => onRemove(index)}
            variant="secondary"
          >
            Remover
          </Button>
        </div>
      ))}
      <Button className="py-2" onClick={onAdd} variant="secondary">
        {addLabel}
      </Button>
    </div>
  );
}

function TestCaseForm({
  initialValue = null,
  isSubmitting,
  onCancel,
  onSubmit,
  submitLabel = "Salvar caso de teste",
}) {
  const [formData, setFormData] = useState(() =>
    createFormFromTestCase(initialValue),
  );
  const [error, setError] = useState("");

  function resetForm() {
    setFormData(createEmptyForm());
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      title: formData.title.trim(),
      preconditions: normalizeItems(formData.preconditions),
      steps: normalizeItems(formData.steps),
      expected_result: formData.expected_result.trim(),
    };

    if (!payload.title) {
      setError("Informe o titulo do caso de teste.");
      return;
    }

    if (payload.steps.length === 0) {
      setError("Informe pelo menos um passo.");
      return;
    }

    if (!payload.expected_result) {
      setError("Informe o resultado esperado.");
      return;
    }

    setError("");

    try {
      await onSubmit(payload);
      if (!initialValue) {
        resetForm();
      }
    } catch {
      // A mensagem amigavel e exibida pela pagina que executa a requisicao.
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <ErrorMessage>{error}</ErrorMessage>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Titulo
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          disabled={isSubmitting}
          onChange={(event) =>
            setFormData((currentData) => ({
              ...currentData,
              title: event.target.value,
            }))
          }
          placeholder="Emprestimo realizado com sucesso"
          type="text"
          value={formData.title}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Pre-condicoes
        </label>
        <DynamicList
          addLabel="Adicionar pre-condicao"
          ariaLabel="Pre-condicao"
          items={formData.preconditions}
          onAdd={() =>
            setFormData((currentData) => ({
              ...currentData,
              preconditions: [...currentData.preconditions, ""],
            }))
          }
          onChange={(index, value) =>
            setFormData((currentData) => ({
              ...currentData,
              preconditions: updateListItem(
                currentData.preconditions,
                index,
                value,
              ),
            }))
          }
          onRemove={(index) =>
            setFormData((currentData) => ({
              ...currentData,
              preconditions: removeListItem(currentData.preconditions, index),
            }))
          }
          placeholder="Usuario autenticado"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Passos
        </label>
        <DynamicList
          addLabel="Adicionar passo"
          ariaLabel="Passo"
          items={formData.steps}
          numbered
          onAdd={() =>
            setFormData((currentData) => ({
              ...currentData,
              steps: [...currentData.steps, ""],
            }))
          }
          onChange={(index, value) =>
            setFormData((currentData) => ({
              ...currentData,
              steps: updateListItem(currentData.steps, index, value),
            }))
          }
          onRemove={(index) =>
            setFormData((currentData) => ({
              ...currentData,
              steps: removeListItem(currentData.steps, index),
            }))
          }
          placeholder="Consultar exemplar"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Resultado esperado
        </label>
        <textarea
          className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          disabled={isSubmitting}
          onChange={(event) =>
            setFormData((currentData) => ({
              ...currentData,
              expected_result: event.target.value,
            }))
          }
          placeholder="O emprestimo e registrado com sucesso."
          value={formData.expected_result}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Salvando..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            variant="secondary"
          >
            Cancelar edicao
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export default TestCaseForm;
