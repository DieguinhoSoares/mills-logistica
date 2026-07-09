// src/lib/vercelApi.js
// Base URL do projeto Vercel que hospeda as funções de servidor (WhatsApp,
// reset de senha, push) — trocado pra Vercel porque Cloud Functions do
// Firebase exigem plano pago, e a Mills optou por ficar 100% no free tier.
//
// Configurar no .env do projeto:
//   VITE_VERCEL_API_URL=https://seu-projeto.vercel.app
//
// Enquanto não tiver configurado, cai num placeholder óbvio — as chamadas
// falham normalmente e o app não trava, só o recurso específico não funciona.
export const VERCEL_API_URL = import.meta.env.VITE_VERCEL_API_URL || 'https://TROQUE_PELA_URL_DO_SEU_PROJETO_VERCEL.vercel.app'

async function chamar(caminho, body, idToken) {
  const res = await fetch(`${VERCEL_API_URL}${caminho}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
  return data
}

export const enviarWhatsApp   = (mensagem)              => chamar('/api/send-whatsapp', { mensagem }).catch(e => console.warn('WhatsApp:', e.message))
export const enviarPush       = (payload)                => chamar('/api/send-push', payload).catch(e => console.warn('Push:', e.message))
export const resetarSenhaApi  = (email)                  => chamar('/api/reset-password', { email })
export const salvarWhatsAppConfig = (phone, apikey, idToken) => chamar('/api/save-whatsapp-config', { phone, apikey }, idToken)
