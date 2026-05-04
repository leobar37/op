import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Failed to mount React application.');
}

// Initialize react-grab in development mode for AI-assisted debugging
if (import.meta.env.DEV) {
  void import('react-grab').then(({ init }) => {
    const grab = init({
      theme: {
        enabled: true,
        hue: 180,
        crosshair: { enabled: false },
      },
      onCopySuccess: (_elements, content) => {
        console.log('[react-grab] Copied element context to clipboard');

        console.log(content);
      },
    });
    grab.activate();
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
