import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span className="text-6xl font-bold text-muted-foreground">404</span>
      <h1 className="text-2xl font-semibold">Page Not Found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Bu sayfa mevcut değil.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        Ana Sayfaya Dön
      </Link>
    </main>
  );
}
