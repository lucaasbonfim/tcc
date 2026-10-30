import { STATUS_LABELS } from '../utils/research';
export default function ResearchStatus({status}) {
  return <span className={`research-status status-${status}`}><span aria-hidden="true" />{STATUS_LABELS[status] || status || 'Sem execução'}</span>;
}
