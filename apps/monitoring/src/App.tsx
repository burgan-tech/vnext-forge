import { AppProviders } from './app/AppProviders';
import { AppRouter } from './app/AppRouter';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
