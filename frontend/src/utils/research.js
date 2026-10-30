export const STATUS_LABELS = {
  pending:'Pendente',running:'Em andamento',awaiting_review:'Aguardando revisão',completed:'Concluída',failed:'Falhou',
  cancelled:'Cancelada',blocked:'Aguardando etapa anterior',not_supported:'Não suportada',approved:'Aprovado',rejected:'Rejeitado',interrupted:'Interrompida',
};
export const AGENT_LABELS = {requirements:'Análise de requisitos',tests:'Geração de casos de teste',execution:'Execução de testes',evaluation:'Avaliação de evidências'};
export function date(value) { return value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—'; }
export function shortId(value) { return value?.slice(0,8) || '—'; }
