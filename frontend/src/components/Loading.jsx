function Loading({ children = "Carregando..." }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
      {children}
    </section>
  );
}

export default Loading;
