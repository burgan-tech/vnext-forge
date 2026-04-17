import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignerUiProvider } from '@vnext-forge/designer-ui';

import './index.css';
import { AppRouter } from './app/AppRouter';
import { createHttpTransport } from './transport/HttpTransport';

const transport = createHttpTransport({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignerUiProvider transport={transport}>
      <AppRouter />
    </DesignerUiProvider>
  </StrictMode>,
);
