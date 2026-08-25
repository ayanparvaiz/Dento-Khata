import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { installExternalLinkHandler } from '@/lib/external';
import App from './App';
import './index.css';

// Desktop app only: send outside links (WhatsApp, tutorials) to the real browser instead of
// letting them replace the single app window. No-op in a normal browser.
installExternalLinkHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Do NOT register a caching service worker — it caused stale UI on load.
// Any previously-installed SW is removed by the kill-switch in /sw.js; this also
// defensively unregisters + clears caches so the app always loads fresh.
// (Still installable via manifest.webmanifest.)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}
