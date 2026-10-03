function TextSection({ title, children }) {
  if (!children) {
    return null;
  }

  return (
    <section>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function TextList({ items, ordered = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p>Nao informado.</p>;
  }

  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag
      className={`space-y-2 ${
        ordered ? "list-decimal pl-5" : "list-disc pl-5"
      }`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ListTag>
  );
}

function ObjectList({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p>Nao informado.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          className="rounded-md border border-slate-200 bg-slate-50 p-4"
          key={`${item.code}-${item.title || item.description}`}
        >
          <p className="text-sm font-semibold text-slate-900">
            {item.code ? `${item.code} - ` : ""}
            {item.title || item.description}
          </p>
          {item.title && item.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {item.description}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function BusinessRules({ rules }) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return <p>Nao informado.</p>;
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <article
          className="rounded-md border border-slate-200 bg-slate-50 p-4"
          key={`${rule.code}-${rule.description}`}
        >
          <p className="text-sm font-semibold text-slate-900">
            {rule.code ? `${rule.code} - ` : ""}
            {rule.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function UseCaseView({ useCase }) {
  const content = useCase?.content || {};

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
        Caso de uso
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">
        {useCase.title}
      </h2>

      <div className="mt-6 grid gap-6">
        <TextSection title="Objetivo">
          <p>{content.objective || "Nao informado."}</p>
        </TextSection>

        <TextSection title="Ator principal">
          <p>{content.main_actor || "Nao informado."}</p>
        </TextSection>

        <TextSection title="Pre-condicoes">
          <TextList items={content.preconditions} />
        </TextSection>

        <TextSection title="Fluxo principal">
          <TextList items={content.main_flow} ordered />
        </TextSection>

        <TextSection title="Fluxos alternativos">
          <ObjectList items={content.alternative_flows} />
        </TextSection>

        <TextSection title="Regras de negocio">
          <BusinessRules rules={content.business_rules} />
        </TextSection>

        <TextSection title="Pos-condicao">
          <p>{content.postcondition || "Nao informado."}</p>
        </TextSection>
      </div>
    </section>
  );
}

export default UseCaseView;
