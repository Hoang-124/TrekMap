import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPerfTierAttribute } from './utils/perfTier.js'
import { installAuthFetchInterceptor } from './utils/sessionHeaders.js'

initPerfTierAttribute();
installAuthFetchInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker for Offline Map Tile & Asset Caching + Update Notification
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] ServiceWorker registered successfully with scope:', reg.scope);
        const notifyUpdate = (worker: ServiceWorker | null) => {
          if (!worker) return;
          window.dispatchEvent(new CustomEvent('lost:sw-update-available', { detail: { worker } }));
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          notifyUpdate(reg.waiting);
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(installing);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] ServiceWorker registration failed:', err);
      });
  });
}

