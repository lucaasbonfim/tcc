function formatList(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }

  return items.map(formatter).join("\n");
}

export function serializeUseCaseForPrompt(useCase) {
  const content = useCase.content ?? {};

  return [
    `Título: ${useCase.title}`,
    "",
    `Objetivo: ${content.objective ?? ""}`,
    "",
    `Ator principal: ${content.main_actor ?? ""}`,
    "",
    "Pré-condições:",
    formatList(content.preconditions, (item) => `- ${item}`),
    "",
    "Fluxo principal:",
    formatList(
      content.main_flow,
      (item, index) => `${index + 1}. ${item}`,
    ),
    "",
    "Fluxos alternativos:",
    formatList(
      content.alternative_flows,
      (flow) => `- ${flow.code} - ${flow.title}: ${flow.description}`,
    ),
    "",
    "Regras de negócio:",
    formatList(
      content.business_rules,
      (rule) => `- ${rule.code}: ${rule.description}`,
    ),
    "",
    `Pós-condição: ${content.postcondition ?? ""}`,
  ].join("\n");
}
