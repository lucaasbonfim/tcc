const VARIANT_STYLES = {
  primary:
    "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-300",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:bg-slate-100",
};

function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      className={`rounded-md px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
