export const STATUS_LABELS = {
  pending:'Pendente',running:'Em andamento',awaiting_review:'Aguardando revisão',completed:'Concluída',failed:'Falhou',
  cancelled:'Cancelada',blocked:'Aguardando etapa anterior',not_supported:'Não suportada',approved:'Aprovado',rejected:'Rejeitado',interrupted:'Interrompida',confirmed:'Confirmada',inconclusive:'Inconclusiva',
};
export const AGENT_LABELS = {requirements:'Análise de requisitos',tests:'Geração de casos de teste',automation:'Automação de casos (agente 2)',execution:'Execução de testes',evaluation:'Avaliação de evidências'};
export const CLASSIFICATION_LABELS={compatible:'Comportamento compatível no cenário',possible_functional_divergence:'Possível divergência funcional',test_problem:'Problema no teste gerado',environment_failure:'Falha de ambiente',inconclusive:'Resultado inconclusivo'};
export const RESULT_LABELS={pending:'Pendente',running:'Em andamento',completed:'Concluído',failed:'Teste reprovado',passed:'Teste aprovado',test_error:'Erro no teste gerado',compilation_error:'Falha de compilação',infrastructure_error:'Falha de infraestrutura',dependency_unavailable:'Dependência indisponível',timeout:'Tempo limite excedido',cancelled:'Cancelada',unsupported:'Tecnologia não suportada',inconclusive:'Inconclusivo',skipped:'Não executado'};
export function date(value) { return value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—'; }
export function shortId(value) { return value?.slice(0,8) || '—'; }
