// firebase-messaging-sw.js
// Service Worker do Firebase Cloud Messaging — recebe a notificação push
// mesmo com a aba do Mills Logística FECHADA (é o que faz esse recurso ser
// "de verdade", diferente do sino, que só atualiza com a aba aberta).
//
// ⚠️ IMPORTANTE: os valores de firebaseConfig abaixo são PLACEHOLDERS.
// Um Service Worker não consegue ler as variáveis de ambiente do Vite
// (import.meta.env) em tempo de execução — precisa ser preenchido à mão
// com os MESMOS valores do seu arquivo .env (VITE_FIREBASE_*). Esses
// valores do config do Firebase Web NÃO são segredo — são projetados pra
// ficar públicos (a segurança de verdade está nas Firestore Rules).

importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_API_KEY',
  authDomain:        'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_AUTH_DOMAIN',
  projectId:         'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_PROJECT_ID',
  storageBucket:     'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId:             'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_APP_ID',
})

const messaging = firebase.messaging()

// Mostra a notificação do sistema operacional quando a mensagem chega com a
// aba fechada/minimizada. Com a aba aberta em primeiro plano, o Firebase
// Messaging não passa por aqui — o app já mostra via onMessage, se quiser
// (não implementado agora: o sino já cobre o caso de aba aberta).
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Mills Logística'
  const body  = payload.notification?.body  || payload.data?.message || ''
  self.registration.showNotification(title, {
    body,
    icon: '/mills-logistica/mills-logo.png',
    badge: '/mills-logistica/mills-logo.png',
    tag: payload.data?.notificationId || undefined, // evita duplicar se reenviado
    data: { url: '/mills-logistica/' },
  })
})

// Clicar na notificação abre (ou foca) a aba do app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/mills-logistica/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/mills-logistica/') && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})

// ═══════════════════════════════════════════════════════════════════════
// PWA / resiliência offline (item 4) — o mesmo Service Worker que recebe
// push também cacheia o "shell" do app (HTML/JS/CSS/imagens), pra funcionar
// numa área de sinal fraco no campo. Estratégia: network-first — sempre
// tenta buscar a versão mais nova primeiro (o motorista/analista nunca fica
// preso numa versão velha do app enquanto tiver sinal); só usa o cache
// quando a rede falhar de verdade (sem sinal).
//
// NUNCA cacheia chamadas ao Firestore/Auth/Functions (domínios do Google/
// Firebase) — dado ao vivo não pode ficar "congelado" em cache; só o shell
// estático do próprio domínio (mesma origem).
// ═══════════════════════════════════════════════════════════════════════
const CACHE_NAME = 'mills-logistica-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting() // ativa a versão nova assim que instalada, sem esperar todas as abas fecharem
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // só cacheia o próprio domínio

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      try {
        const networkResponse = await fetch(request)
        // Só cacheia respostas válidas (evita guardar erro 404/500 como se fosse bom)
        if (networkResponse.ok) cache.put(request, networkResponse.clone())
        return networkResponse
      } catch {
        // Sem rede — tenta servir do cache. Pra navegação (abrir a página),
        // cai pro index.html cacheado se a URL exata não estiver no cache
        // (comum em SPA: rotas internas não têm arquivo próprio).
        const cached = await cache.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await cache.match(`${self.registration.scope}index.html`)
          if (shell) return shell
        }
        return new Response('Sem conexão e sem versão salva em cache ainda.', { status: 503, statusText: 'Offline' })
      }
    })()
  )
})
