import Button from "./Button";

function TextList({ emptyMessage, items, ordered = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag
      className={`mt-2 space-y-1 text-sm leading-6 text-slate-700 ${
        ordered ? "list-decimal pl-5" : "list-disc pl-5"
      }`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ListTag>
  );
}

function TestCaseList({ canEdit = false, onEdit, testCases }) {
  if (testCases.length === 0) {
    return <p className="text-slate-600">Nenhum caso de teste criado.</p>;
  }

  return (
    <div className="grid gap-4">
      {testCases.map((testCase) => (
        <article
          className="rounded-lg border border-slate-200 p-5"
          key={testCase.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Caso de Teste {testCase.sequence_number}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {testCase.title}
              </h3>
            </div>
            {canEdit ? (
              <Button
                className="py-2"
                onClick={() => onEdit(testCase)}
                variant="secondary"
              >
                Editar
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4">
            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Pre-condicoes
              </h4>
              <TextList
                emptyMessage="Nenhuma pre-condicao informada."
                items={testCase.preconditions}
              />
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">Passos</h4>
              <TextList
                emptyMessage="Nenhum passo informado."
                items={testCase.steps}
                ordered
              />
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Resultado esperado
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {testCase.expected_result}
              </p>
            </section>
          </div>
        </article>
      ))}
    </div>
  );
}

export default TestCaseList;
