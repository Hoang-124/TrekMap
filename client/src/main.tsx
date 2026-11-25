import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import pjsVietnameseWoff2 from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-vietnamese-wght-normal.woff2'
import pjsLatinExtWoff2 from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-wght-normal.woff2'
import pjsLatinWoff2 from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2'
import './index.css'
import App from './App.tsx'
import { initPerfTierAttribute } from './utils/perfTier.js'
import { installAuthFetchInterceptor } from './utils/sessionHeaders.js'

// Alias self-hosted SIL OFL 1.1 Plus Jakarta Sans variable subsets under 'Plus Jakarta Sans'
// so CSS tokens, inline SVGs, and offline Canvas exports use the local woff2 bundle without remote CDN requests.
if (typeof document !== 'undefined' && !document.getElementById('lost-font-alias')) {
  const fontStyle = document.createElement('style');
  fontStyle.id = 'lost-font-alias';
  fontStyle.textContent = [
    `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(${pjsVietnameseWoff2}) format('woff2-variations');unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB;}`,
    `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(${pjsLatinExtWoff2}) format('woff2-variations');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}`,
    `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(${pjsLatinWoff2}) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`,
  ].join('\n');
  document.head.appendChild(fontStyle);
}

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

