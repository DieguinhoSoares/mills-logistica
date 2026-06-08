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
  const markAllRead = () => notificat
