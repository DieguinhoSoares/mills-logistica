import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

// ─── CARDS (real-time) ───────────────────────────────────────────────────────
export function useCards() {
  const [cards,   setCards]   = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const q = query(collection(db, 'cards'), orderBy('startDate', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setCards(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  const saveCard   = async card => {
    const { id, ...data } = card
    data.updatedAt = serverTimestamp()
    if (id && !id.startsWith('c')) {
      await updateDoc(doc(db, 'cards', id), data)
    } else {
      data.createdAt = serverTimestamp()
      await addDoc(collection(db, 'cards'), data)
    }
  }
  const deleteCard = id => deleteDoc(doc(db, 'cards', id))
  const moveCard   = async (id, startDate, endDate, reason) => {
    const ref = doc(db, 'cards', id)
    const snap = await getDoc(ref)
    const prev = snap.data()
    await updateDoc(ref, {
      startDate, endDate, updatedAt: serverTimestamp(),
      moveLog: [...(prev?.moveLog||[]), { from: prev?.startDate, to: startDate, reason, at: new Date().toISOString() }],
    })
  }
  return { cards, loading, saveCard, deleteCard, moveCard }
}

// ─── REQUESTS (real-time) ────────────────────────────────────────────────────
// CORRIGIDO: índice composto separado para cada perfil (evita erro Firestore)
export function useRequests(roleFilter) {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user) return
    let q
    if (roleFilter === 'solicitante') {
      // Índice simples — apenas where, sem orderBy composto
      q = query(
        collection(db,'requests'),
        where('requesterId','==',user.uid),
        orderBy('createdAt','desc')
      )
    } else {
      q = query(collection(db,'requests'), orderBy('createdAt','desc'))
    }
    const unsub = onSnapshot(q,
      snap => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => {
        // Se índice composto ainda não foi criado, cai em query simples
        if (err.code === 'failed-precondition' && roleFilter === 'solicitante') {
          const fallback = query(collection(db,'requests'), where('requesterId','==',user.uid))
          onSnapshot(fallback, snap => {
            setRequests(snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
            )
            setLoading(false)
          })
        }
      }
    )
    return unsub
  }, [user, roleFilter])

  const submitRequest = async data => {
    await addDoc(collection(db,'requests'), {
      ...data,
      requesterId:   user.uid,
      requesterName: profile?.name  || '',
      unit:          profile?.unit  || '',
      status:        'pendente',
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    })
  }

  const respondRequest = async (id, status, note, teamsWebhookUrl) => {
    await updateDoc(doc(db,'requests',id), {
      status,
      responseNote: note,
      respondedAt:  serverTimestamp(),
      updatedAt:    serverTimestamp(),
    })
    const req = requests.find(r => r.id === id)
    if (req) {
      await addDoc(collection(db,'notifications'), {
        userId:    req.requesterId,
        requestId: id,
        type:      status === 'aceito' ? 'request_accepted' : 'request_rejected',
        title:     status === 'aceito' ? '✅ Solicitação aceita!' : '❌ Solicitação recusada',
        message:   note || (status === 'aceito'
          ? 'Sua solicitação foi aceita pelo time de Gestão de Frotas.'
          : 'Sua solicitação foi recusada. Entre em contato para mais informações.'),
        read:      false,
        createdAt: serverTimestamp(),
      })
      if (teamsWebhookUrl) {
        const { sendTeamsNotification } = await import('../lib/utils')
        const emoji = status === 'aceito' ? '✅' : '❌'
        await sendTeamsNotification(
          teamsWebhookUrl,
          `${emoji} Solicitação de Frete ${status === 'aceito' ? 'Aceita' : 'Recusada'}`,
          `**Solicitante:** ${req.requesterName || req.unit}\n**Serviço:** ${req.type}\n**Data desejada:** ${req.desiredDate}\n\n${note || ''}`,
        )
      }
    }
  }

  return { requests, loading, submitRequest, respondRequest }
}

// ─── NOTIFICATIONS (real-time) ───────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db,'notifications'),
      where('userId','==',user.uid),
      orderBy('createdAt','desc'),
    )
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user])

  const markRead    = id => updateDoc(doc(db,'notifications',id), { read: true })
  const markAllRead = () => notifications.filter(n=>!n.read).forEach(n => markRead(n.id))
  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, unreadCount, markRead, markAllRead }
}

// ─── SIM CLIENTS (shared, cached) ────────────────────────────────────────────
export function useSimClients() {
  const [simClients, setSimClients] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','simClients'), snap => {
      if (snap.exists()) setSimClients(snap.data().clients || [])
    })
    return unsub
  }, [])
  const uploadClients = async clients =>
    setDoc(doc(db,'config','simClients'), { clients, updatedAt: serverTimestamp() })
  return { simClients, uploadClients }
}

// ─── TEAMS WEBHOOK / APP CONFIG ──────────────────────────────────────────────
export function useConfig() {
  const [config, setConfig] = useState({})
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','settings'), snap => {
      if (snap.exists()) setConfig(snap.data())
    })
    return unsub
  }, [])
  const saveConfig = data =>
    setDoc(doc(db,'config','settings'), { ...config, ...data, updatedAt: serverTimestamp() }, { merge:true })
  return { config, saveConfig }
}
