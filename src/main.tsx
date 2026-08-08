import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA support is optional; ignore registration failures.
    })
  })
  // Reload when a new SW version takes control so the new JS bundle loads.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}
