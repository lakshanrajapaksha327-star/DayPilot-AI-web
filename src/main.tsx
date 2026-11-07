import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register unified PWA and FCM Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[DayPilot PWA]: Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[DayPilot PWA]: Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

