function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  loading = false,
  loadingLabel,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`research-button ${variant} ${className}`}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="loading-spinner" aria-hidden="true" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export default Button;
