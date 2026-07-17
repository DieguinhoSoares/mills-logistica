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
import { db } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export const VERCEL_API_URL = import.meta.env.VITE_VERCEL_API_URL || 'https://TROQUE_PELA_URL_DO_SEU_PROJETO_VERCEL.vercel.app'

// Registro central de falhas silenciosas — motivado por um caso real: a
// migração do WhatsApp pra Vercel (2026-07-11) trocou de onde o telefone/
// apikey eram lidos (config/settings → secrets/whatsapp) sem migrar o dado.
// O endpoint continuou respondendo "ok" mesmo sem enviar nada (documento não
// configurado não é um erro do ponto de vista HTTP) — ninguém percebeu por
// semanas porque o único rastro era um console.warn, invisível fora do
// DevTools. Agora qualquer chamada que falhar OU for pulada silenciosamente
// grava aqui, visível pro Master sem precisar abrir o console do navegador.
export async function registrarFalhaSilenciosa(tipo, mensagem, contexto) {
  try {
    await addDoc(collection(db, 'falhasSilenciosas'), {
      tipo, mensagem,
      contexto: contexto ? JSON.stringify(contexto).slice(0, 500) : null,
      resolvido: false,
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    // Se nem o registro da falha funcionar (ex: Firestore fora do ar), não
    // tem mais o que fazer — mas ao menos deixa rastro no console.
    console.error('Não foi possível registrar falha silenciosa:', e)
  }
}

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

export const enviarWhatsApp = async (mensagem) => {
  try {
    const data = await chamar('/api/send-whatsapp', { mensagem })
    // "skipped" não é um erro HTTP (a function respondeu ok=true de propósito
    // quando não há config), mas pro usuário final o resultado é o mesmo:
    // a mensagem não saiu. Esse foi exatamente o caso que ficou invisível.
    if (data.skipped) {
      await registrarFalhaSilenciosa('whatsapp', `WhatsApp não enviado: ${data.skipped}`, { mensagem: mensagem.slice(0,100) })
    }
    return data
  } catch (e) {
    console.warn('WhatsApp:', e.message)
    await registrarFalhaSilenciosa('whatsapp', e.message, { mensagem: mensagem.slice(0,100) })
  }
}

export const enviarPush = async (payload) => {
  try {
    const data = await chamar('/api/send-push', payload)
    if (data.skipped) {
      await registrarFalhaSilenciosa('push', `Push não enviado: ${data.skipped}`, { userId: payload.userId, title: payload.title })
    }
    return data
  } catch (e) {
    console.warn('Push:', e.message)
    await registrarFalhaSilenciosa('push', e.message, { userId: payload.userId, title: payload.title })
  }
}

export const resetarSenhaApi  = (email)                  => chamar('/api/reset-password', { email })
export const salvarWhatsAppConfig = (phone, apikey, idToken) => chamar('/api/save-whatsapp-config', { phone, apikey }, idToken)

// notifyRoles precisa consultar a coleção `users` filtrando por role — as
// Firestore Rules bloqueiam isso pra quem não é staff (evita expor nome/
// e-mail de toda a equipe pra qualquer usuário logado). Roda no servidor
// com Admin SDK, que ignora as Rules, em vez de no navegador do solicitante.
export const notificarRoles = async (roles, type, title, message, requestId) => {
  try {
    const data = await chamar('/api/notify-roles', { roles, type, title, message, requestId })
    return data
  } catch (e) {
    console.warn('notifyRoles:', e.message)
    // Não recursiona pra notifyRoles de novo aqui (é justamente o que
    // falhou) — só grava o registro, o Master vê pelo contador na tela.
    await registrarFalhaSilenciosa('notifyRoles', e.message, { roles, title })
  }
}
