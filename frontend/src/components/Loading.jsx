function Loading({ children = "Carregando…" }) {
  return (
    <section role="status" className="loading-state">
      <span className="loading-spinner" aria-hidden="true" />{children}
    </section>
  );
}

export default Loading;
