import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registra o Service Worker pra TODO MUNDO no carregamento do app — não só
// quem ativa notificações push. É ele quem dá a resiliência offline (item 4):
// cacheia o shell do app pra funcionar numa área de sinal fraco no campo.
// O registro de push (getToken) reaproveita esse mesmo registro depois.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js`)
      .catch(err => console.warn('Falha ao registrar Service Worker:', err))
  })
}
