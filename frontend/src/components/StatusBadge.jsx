const STATUS_STYLES = {
  PENDING: "border-slate-200 bg-slate-100 text-slate-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function StatusBadge({ children, status }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.PENDING
      }`}
    >
      {children}
    </span>
  );
}

export default StatusBadge;
