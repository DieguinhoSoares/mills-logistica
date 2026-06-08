import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Essa caixinha limpa dados vazios para o Firebase não dar erro
const limparDados = (obj) => {
  const limpo = {}
  Object.keys(obj).forEach(chave => {
    if (obj[chave] !== undefined) {
      limpo[chave] = obj[chave]
    }
  })
  return limpo
}

// ─── GERENCIADOR DE AGENDAMENTOS (CARDS) ────────────────────────────────────
export function useCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'cards'), orderBy('startDate', 'asc'))
    const unsub = onSnapshot(q,
      snap => { 
        setCards(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false) 
      },
      err => { 
        console.error('Erro ao buscar cards:', err)
        setLoading(false) 
      }
    )
    return unsub
  }, [])

  const saveCard = async card => {
    try {
      const { id, ...data } = card
      const dadosLimpos = limparDados(data)
      dadosLimpos.updatedAt = serverTimestamp()

      if (id && id.length > 10) {
        await updateDoc(doc(db, 'cards', id), dadosLimpos)
      } else {
        dadosLimpos.createdAt = serverTimestamp()
        await addDoc(collection(db, 'cards'), dadosLimpos)
      }
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err)
      alert('Não foi possível salvar o agendamento no banco de dados. Verifique a conexão ou permissões.')
      throw err
    }
  }

  const deleteCard = async id => {
    try {
      await deleteDoc(doc(db, 'cards', id))
    } catch (err) {
      console.error('Erro ao deletar card:', err)
      throw err
    }
  }

  const moveCard = async (id, startDate, endDate, reason) => {
    try {
      const ref = doc(db, 'cards', id)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('Agendamento não encontrado.')
      
      const prev = snap.data()
      await updateDoc(ref, {
        startDate,
        endDate,
        updatedAt: serverTimestamp(),
        history: [
          ...(prev.history || []),
          { 
            date: new Date().toISOString(), 
            user: 'Logística', 
            reason: reason || 'Remanejamento de rota', 
            from: prev.startDate, 
            to: startDate 
          }
        ]
      })
    } catch (err) {
      console.error('Erro ao mover agendamento:', err)
      throw err
    }
  }

  return { cards, loading, saveCard, deleteCard, moveCard }
}

// ─── GERENCIADOR DE SOLICITAÇÕES ───────────────────────────────────────────
export function useRequests(type) {
  const [requests, setRequests] = useState([])

  useEffect(() => {
    const q = type 
      ? query(collection(db, 'requests'), where('targetModule', '==', type), orderBy('createdAt', 'desc'))
      : query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
      
    const unsub = onSnapshot(q, 
      snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Erro ao buscar solicitações:', err)
    )
    return unsub
  }, [type])

  const respondRequest = async (id, status, note, teamsWebhookUrl) => {
    try {
      const ref = doc(db, 'requests', id)
      await updateDoc(ref, { 
        status, 
        responseNote: note || '', 
        respondedAt: serverTimestamp() 
      })
    } catch (err) {
      console.error('Erro ao responder solicitação:', err)
      throw err
    }
  }

  return { requests, respondRequest }
}

// ─── GERENCIADOR DE NOTIFICAÇÕES ───────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, 
      snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Erro nas notificações:', err)
    )
    return unsub
  }, [])

  const markAllRead = async () => {}

  return { notifications, unreadCount, markAllRead }
}

// ─── GERENCIADOR DE CLIENTES SIM (PLANILHA) ───────────────────────────────────
export function useSimClients() {
  const [simClients, setSimClients] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sim_clients'), 
      snap => setSimClients(snap.docs.map(d => d.data())),
      err => console.error('Erro ao carregar clientes SIM:', err)
    )
    return unsub
  }, [])

  const uploadClients = async clients => {
    try {
      // Pega no máximo os primeiros 500 registros para não derrubar ou travar o sistema
      for (const chunk of clients.slice(0, 500)) { 
        if (!chunk.name) continue
        const docId = chunk.name.replace(/[/.]/g, '_')
        await setDoc(doc(db, 'sim_clients', docId), limparDados(chunk))
      }
    } catch (err) {
      console.error('Erro ao enviar planilha:', err)
      throw err
    }
  }

  return { simClients, uploadClients }
}

// ─── CONFIGURAÇÕES DO SISTEMA ───────────────────────────────────────────────
export function useConfig() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), 
      snap => setConfig(snap.data() || null),
      err => console.error('Erro ao ler configurações globais:', err)
    )
    return unsub
  }, [])

  const saveConfig = async data => {
    try {
      await setDoc(doc(db, 'config', 'global'), { 
        ...config, 
        ...limparDados(data), 
        updatedAt: serverTimestamp() 
      }, { merge: true })
    } catch (err) {
      console.error('Erro ao salvar configurações:', err)
      throw err
    }
  }

  return { config, saveConfig }
}

// ─── GERENCIADOR DE MOTORISTAS ───────────────────────────────────────────────
export function useDrivers() {
  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('name', 'asc'))
    const unsub = onSnapshot(q,
      snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Erro ao escutar motoristas no banco de dados:', err)
    )
    return unsub
  }, [])

  const saveDriver = async driver => {
    try {
      const { id, ...data } = driver
      
      // Garante que se o campo tiver vazio na tela, salve como texto vazio em vez de quebrar
      const payload = {
        name: data.name || '',
        cnh: data.cnh || '',
        category: data.category || '',
        phone: data.phone || '',
        unit: data.unit || '',
        active: data.active !== undefined ? data.active : true,
        updatedAt: serverTimestamp()
      }

      if (id) {
        await updateDoc(doc(db, 'drivers', id), payload)
      } else {
        payload.createdAt = serverTimestamp()
        await addDoc(collection(db, 'drivers'), payload)
      }
    } catch (err) {
      console.error('Erro ao salvar motorista no Firebase:', err)
      alert('Não foi possível salvar o motorista. Verifique o console do navegador.')
      throw err
    }
  }

  const deleteDriver = async id => {
    try {
      await deleteDoc(doc(db, 'drivers', id))
    } catch (err) {
      console.error('Erro ao remover motorista:', err)
      throw err
    }
  }

  return { drivers, saveDriver, deleteDriver }
}

// ─── ROTINA DE BACKUP AUTOMÁTICO ──────────────────────────────────────────────
export async function runDailyBackup(cards, requests) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const ref = doc(db, 'backups', today)
    const existing = await getDoc(ref)
    if (existing.exists()) return

    await setDoc(ref, {
      date: today, 
      createdAt: serverTimestamp(),
      cardsCount: cards.length, 
      requestsCount: requests.length,
      cards: cards.map(c => ({ 
        id: c.id, 
        client: c.client || '—', 
        driver: c.driver || '—', 
        startDate: c.startDate || '' 
      }))
    })
  } catch (e) { 
    console.warn('Falha silenciosa na rotina automática de backup:', e) 
  }
}
