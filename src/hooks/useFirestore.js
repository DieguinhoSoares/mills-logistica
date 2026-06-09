import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useCards() {
  const [cards,   setCards]   = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const q = query(collection(db,'cards'), orderBy('startDate','asc'))
    const unsub = onSnapshot(q,
      snap => { setCards(snap.docs.map(d=>({ id:d.id, ...d.data() }))); setLoading(false) },
      err  => { console.warn('cards:', err); setLoading(false) }
    )
    return unsub
  }, [])
  const saveCard = async card => {
    const { id, ...data } = card
    data.updatedAt = serverTimestamp()
    if (id && id.length > 10) await updateDoc(doc(db,'cards',id), data)
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'cards'), data) }
  }
  const deleteCard = id => deleteDoc(doc(db,'cards',id))
  const moveCard   = async (id, startDate, endDate, reason) => {
    const ref=doc(db,'cards',id), snap=await getDoc(ref), prev=snap.data()
    await updateDoc(ref, {
      startDate, endDate, updatedAt:serverTimestamp(),
      moveLog:[...(prev?.moveLog||[]), { from:prev?.startDate, to:startDate, reason, at:new Date().toISOString() }],
    })
  }
  return { cards, loading, saveCard, deleteCard, moveCard }
}

export function useRequests(roleFilter) {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  useEffect(() => {
    if (!user) return
    let q
    if (roleFilter === 'solicitante') {
      q = query(collection(db,'requests'), where('requesterId','==',user.uid), orderBy('createdAt','desc'))
    } else {
      q = query(collection(db,'requests'), orderBy('createdAt','desc'))
    }
    const unsub = onSnapshot(q,
      snap => { setRequests(snap.docs.map(d=>({ id:d.id, ...d.data() }))); setLoading(false) },
      err  => {
        if (err.code==='failed-precondition' && roleFilter==='solicitante') {
          const fb = query(collection(db,'requests'), where('requesterId','==',user.uid))
          onSnapshot(fb, snap => {
            setRequests(snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
            setLoading(false)
          })
        } else setLoading(false)
      }
    )
    return unsub
  }, [user, roleFilter])

  const submitRequest = async data => {
    await addDoc(collection(db,'requests'), {
      ...data,
      requesterId:   user.uid,
      requesterName: data.requesterName || profile?.name || '',
      unit:          data.unit || profile?.unit || '',
      status:        'pendente',
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    })
  }

  const respondRequest = async (id, status, note, teamsWebhookUrl) => {
    await updateDoc(doc(db,'requests',id), {
      status, responseNote:note, respondedAt:serverTimestamp(), updatedAt:serverTimestamp(),
    })
    const req = requests.find(r=>r.id===id)
    if (req) {
      await addDoc(collection(db,'notifications'), {
        userId:req.requesterId, requestId:id,
        type:   status==='aceito'?'request_accepted':'request_rejected',
        title:  status==='aceito'?'✅ Solicitação aceita!':'❌ Solicitação recusada',
        message:note||(status==='aceito'?'Sua solicitação foi aceita.':'Sua solicitação foi recusada.'),
        read:false, createdAt:serverTimestamp(),
      })
      if (teamsWebhookUrl) {
        const { sendTeamsNotification } = await import('../lib/utils')
        await sendTeamsNotification(teamsWebhookUrl,
          `${status==='aceito'?'✅':'❌'} Solicitação ${status==='aceito'?'Aceita':'Recusada'}`,
          `Solicitante: ${req.requesterName||req.unit}\nServiço: ${req.type}\nData: ${req.desiredDate}\n\n${note||''}`
        )
      }
    }
  }
  return { requests, loading, submitRequest, respondRequest }
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  useEffect(() => {
    if (!user) return
    const q = query(collection(db,'notifications'), where('userId','==',user.uid), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>setNotifications(snap.docs.map(d=>({ id:d.id, ...d.data() }))), ()=>{})
    return unsub
  }, [user])
  const markRead    = id => updateDoc(doc(db,'notifications',id), { read:true })
  const markAllRead = () => notifications.filter(n=>!n.read).forEach(n=>markRead(n.id))
  const unreadCount = notifications.filter(n=>!n.read).length
  return { notifications, unreadCount, markRead, markAllRead }
}

export function useSimClients() {
  const [simClients, setSimClients] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','simClients'), async snap => {
      if (!snap.exists()) return
      const { batches, clients } = snap.data()
      if (clients && clients.length > 0) { setSimClients(clients); return }
      if (batches) {
        const all = []
        for (let i = 0; i < batches; i++) {
          const bSnap = await getDoc(doc(db,'config',`simClients_${i}`))
          if (bSnap.exists()) all.push(...(bSnap.data().clients||[]))
        }
        setSimClients(all)
      }
    }, ()=>{})
    return unsub
  }, [])

  const uploadClients = async clients => {
    const BATCH = 50
    const batches = []
    for (let i = 0; i < clients.length; i += BATCH) batches.push(clients.slice(i, i+BATCH))
    await setDoc(doc(db,'config','simClients'), { total:clients.length, batches:batches.length, updatedAt:serverTimestamp() })
    for (let i = 0; i < batches.length; i++) {
      await setDoc(doc(db,'config',`simClients_${i}`), { clients:batches[i], updatedAt:serverTimestamp() })
    }
  }
  return { simClients, uploadClients }
}

export function useConfig() {
  const [config, setConfig] = useState({})
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','settings'), snap=>{ if(snap.exists()) setConfig(snap.data()) }, ()=>{})
    return unsub
  }, [])
  const saveConfig = data => setDoc(doc(db,'config','settings'), { ...config, ...data, updatedAt:serverTimestamp() }, { merge:true })
  return { config, saveConfig }
}

export function useDrivers() {
  const [drivers, setDrivers] = useState([])
  useEffect(() => {
    const q = query(collection(db,'drivers'), orderBy('name','asc'))
    const unsub = onSnapshot(q,
      snap => setDrivers(snap.docs.map(d=>({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [])

  const saveDriver = async driver => {
    const { id, ...data } = driver
    data.updatedAt = serverTimestamp()
    if (id) await updateDoc(doc(db,'drivers',id), data)
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'drivers'), data) }
  }

  const deleteDriver = id => deleteDoc(doc(db,'drivers',id))
  return { drivers, saveDriver, deleteDriver }
}
export function usePendingUsers() {
  const [pendingUsers, setPendingUsers] = useState([])
  useEffect(() => {
    const q = query(collection(db, 'users'), where('status', '==', 'pendente'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q,
      snap => setPendingUsers(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [])

  const approveUser = async (userId, role) => {
    await updateDoc(doc(db, 'users', userId), {
      status: 'ativo',
      role,
      approvedAt: new Date().toISOString(),
    })
    // Notifica o usuário
    await addDoc(collection(db, 'notifications'), {
      userId,
      type:    'account_approved',
      title:   '✅ Acesso liberado!',
      message: `Seu cadastro foi aprovado. Perfil: ${role === 'frotas' ? 'Gestão de Frotas' : 'Solicitante'}.`,
      read:    false,
      createdAt: serverTimestamp(),
    })
  }

  const refuseUser = async (userId) => {
    await updateDoc(doc(db, 'users', userId), {
      status:   'recusado',
      refusedAt: new Date().toISOString(),
    })
  }

  return { pendingUsers, approveUser, refuseUser }
}

export function useCancelRequest() {
  const cancelCard = async (cardId, reason, authorName) => {
    await updateDoc(doc(db, 'cards', cardId), {
      status:       'cancelado',
      cancelReason: reason,
      cancelledAt:  serverTimestamp(),
      cancelledBy:  authorName,
      updatedAt:    serverTimestamp(),
    })
  }
  return { cancelCard }
}

export function useMessages(requestId) {
  const [messages, setMessages] = useState([])
  useEffect(() => {
    if (!requestId) return
    const q = query(
      collection(db, 'requests', requestId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q,
      snap => setMessages(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [requestId])

  const sendMessage = async ({ requestId, text, authorId, authorName, authorRole, type='message', statusEvent=null }) => {
    await addDoc(collection(db, 'requests', requestId, 'messages'), {
      text, authorId, authorName, authorRole,
      type, statusEvent,
      createdAt: serverTimestamp(),
    })
  }

  return { messages, sendMessage }
}

export async function runDailyBackup(cards, requests) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const ref = doc(db,'backups',today)
    const existing = await getDoc(ref)
    if (existing.exists()) return
    await setDoc(ref, {
      date:today, createdAt:serverTimestamp(),
      cardsCount:cards.length, requestsCount:requests.length,
      cards:cards.map(c=>({...c})), requests:requests.map(r=>({...r})),
    })
    console.log(`✅ Backup: ${today}`)
  } catch(e) { console.warn('Backup error:', e) }
}
