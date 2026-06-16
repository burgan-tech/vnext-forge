import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RouteErrorBoundary } from './RouteErrorBoundary';
import { HomePage } from '@monitoring/pages/HomePage';
import { NotFoundPage } from '@monitoring/pages/NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
