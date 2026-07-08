// ─── FIREBASE CONFIG ───────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

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

// NOTE: Firebase Messaging removido — era exportado como Promise (bug).
// Para reativar notificações push, implemente um Service Worker separado.
