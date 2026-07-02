export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        vNext
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">vNext Monitoring</h1>
      <p className="max-w-md text-balance text-muted-foreground">
        vNext için monitoring hizmetleri burada sunulacak.
      </p>
    </main>
  );
}
