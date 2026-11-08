import { STATUS_LABELS, RESULT_LABELS } from '../utils/research';

const reviewLabels = {pending:'Aguardando decisão',approved:'Aprovado por pessoa',rejected:'Rejeitado por pessoa',confirmed:'Confirmado por pessoa',inconclusive:'Decisão inconclusiva'};
const symbols = {pending:'○',running:'◷',awaiting_review:'◇',completed:'✓',approved:'✓',confirmed:'✓',passed:'✓',failed:'!',rejected:'×',cancelled:'−',inconclusive:'?',blocked:'−'};

export default function ResearchStatus({status,context='processing'}) {
  const labels=context==='review'?reviewLabels:context==='result'?RESULT_LABELS:STATUS_LABELS;
  const label=labels[status] || STATUS_LABELS[status] || status || 'Sem execução';
  return <span className={`research-status status-${status} status-context-${context}`}>
    <span className="status-symbol" aria-hidden="true">{symbols[status] || '○'}</span>
    <span className="sr-only">{context==='review'?'Revisão humana':context==='result'?'Resultado do teste':'Processamento'}: </span>{label}
  </span>;
}
