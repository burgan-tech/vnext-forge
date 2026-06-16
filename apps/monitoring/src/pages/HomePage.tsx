export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        vNext
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">vNext Monitoring</h1>
      <p className="max-w-md text-balance text-slate-400">
        vNext için monitoring hizmetleri burada sunulacak. Uygulama iskeleti başarıyla ayağa
        kalktı.
      </p>
    </main>
  );
}
