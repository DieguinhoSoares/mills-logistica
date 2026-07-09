// ─── FIREBASE CONFIG ───────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app       = initializeApp(firebaseConfig)
export const auth      = getAuth(app)
export const db        = getFirestore(app)
// Cloud Functions — usado pelo reset de senha com identidade Mills e pelo
// envio de WhatsApp (item 1 da revisão de segurança). O client nunca lê
// segredos direto do Firestore; só chama a function.
export const functions = getFunctions(app, 'southamerica-east1')

// Firebase Messaging (push de verdade — item 5) — uma tentativa anterior
// exportava a Promise de isSupported() como se já fosse a instância pronta
// (bug: `messaging` virava um objeto Promise, não o Messaging de verdade).
// Corrigido: uma função async que só resolve pra uma instância real quando
// o navegador de fato suporta (Safari/iOS antigo não suporta, por exemplo —
// devolve null nesses casos, e quem chama trata isso normalmente).
let _messagingInstance = null
export async function getMessagingIfSupported() {
  if (_messagingInstance) return _messagingInstance
  const supported = await isSupported().catch(() => false)
  if (!supported) return null
  _messagingInstance = getMessaging(app)
  return _messagingInstance
}
