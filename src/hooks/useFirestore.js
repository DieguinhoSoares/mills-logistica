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

export function needsApproval(type, subtype) {
  const FRETE_GERENCIAL = ['troca_tecnica','garantia','sinistro']
  const isFreteGerencial = (type==='freteMillsInterno'||type==='freteCliente') && FRETE_GERENCIAL.includes(subtype)
  const isGuindauto = type === 'guindauto'
  return isFreteGerencial || isGuindauto
}

export function getInitialStatus(type, subtype) {
  if (needsApproval(type, subtype)) return 'pendente_supervisor'
  return 'pendente'
}

export function needsGerenteApproval(type, subtype) {
  const FRETE_GERENCIAL = ['troca_tecnica','garantia','sinistro']
  return (type==='freteMillsInterno'||type==='freteCliente') && FRETE_GERENCIAL.includes(subtype)
}

async function notifyWhatsApp(phone, apikey, msg) {
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${apikey}`)
  } catch(e) { console.warn('WhatsApp:', e) }
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
    } else if (roleFilter === 'supervisor') {
      q = query(collection(db,'requests'), where('status','==','pendente_supervisor'), orderBy('createdAt','desc'))
    } else if (roleFilter === 'gerente') {
      q = query(collection(db,'requests'), where('needsGerenteApproval','==',true), orderBy('createdAt','desc'))
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
        } else { console.warn('requests:', err); setLoading(false) }
      }
    )
    return unsub
  }, [user, roleFilter])

  const submitRequest = async data => {
    const status   = getInitialStatus(data.type, data.subtype)
    const needsGer = needsGerenteApproval(data.type, data.subtype)

    // Se vier com id é um REENVIO de solicitação recusada — atualiza o doc existente
    // em vez de criar um novo, preservando o histórico de aprovações e o vínculo.
    if (data.id) {
      await updateDoc(doc(db,'requests',data.id), {
        ...data,
        id:                   undefined, // não gravar o id como campo
        requesterName:        data.requesterName || profile?.name || '',
        unit:                 data.unit || profile?.unit || '',
        status,
        needsGerenteApproval: needsGer,
        respondedAt:          null,
        responseNote:         null,
        updatedAt:            serverTimestamp(),
      })
      await addDoc(collection(db,'requests',data.id,'messages'), {
        text:`Solicitação ajustada e reenviada pelo solicitante.`,
        authorId:profile?.uid||'', authorName:profile?.name||'Solicitante',
        authorRole:profile?.role||'solicitante', type:'status_change',
        statusEvent:'reenviada', createdAt:serverTimestamp(),
      })
      return
    }

    await addDoc(collection(db,'requests'), {
      ...data,
      requesterId:          user.uid,
      requesterName:        data.requesterName || profile?.name || '',
      unit:                 data.unit || profile?.unit || '',
      status,
      needsGerenteApproval: needsGer,
      approvalLog:          [],
      createdAt:            serverTimestamp(),
      updatedAt:            serverTimestamp(),
    })
    if (status === 'pendente_supervisor') {
      const cfg = await getDoc(doc(db,'config','settings'))
      const s   = cfg.exists() ? cfg.data() : {}
      if (s.whatsappPhone && s.whatsappApikey) {
        const tipo = { freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente', guindauto:'Guindauto' }[data.type] || data.type
        const sub  = data.subtype ? ' · ' + data.subtype.replace(/_/g,' ') : ''
        const urg  = { critico:'🔴 Crítico', alto:'🟠 Alto', medio:'🟡 Médio', baixo:'🟢 Baixo' }[data.urgency] || ''
        const msg  = `📋 Nova solicitação aguardando aprovação\nTipo: ${tipo}${sub} · Cliente: ${data.clientName||'—'} · Solicitante: ${data.requesterName||profile?.name||'—'} · Rota: ${data.originCityName||data.origin||'—'} → ${data.destCityName||data.destination||'—'}\nUrgência: ${urg}\n👉 Abrir e aprovar: https://dieguinhosoares.github.io/mills-logistica/`
        await notifyWhatsApp(s.whatsappPhone, s.whatsappApikey, msg)
      }
    }
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

  const approveAsSupervisor = async (id, note, approverName, approverRole) => {
    const snap = await getDoc(doc(db,'requests',id))
    const req  = { id, ...snap.data() }
    const logEntry = { step:'supervisor', approver:approverName, role:approverRole, note, at:new Date().toISOString(), action:'approved' }
    const nextStatus = req.needsGerenteApproval ? 'pendente_gerente' : 'pendente'
    await updateDoc(doc(db,'requests',id), {
      status:               nextStatus,
      approvalLog:          [...(req.approvalLog||[]), logEntry],
      supervisorApprovedAt: serverTimestamp(),
      supervisorApprovedBy: approverName,
      updatedAt:            serverTimestamp(),
    })
    await addDoc(collection(db,'notifications'), {
      userId:req.requesterId, requestId:id,
      type:'supervisor_approved', title:'✅ Aprovado pelo Supervisor',
      message: note || 'Sua solicitação foi aprovada pelo supervisor.',
      read:false, createdAt:serverTimestamp(),
    })
    if (req.needsGerenteApproval) {
      await addDoc(collection(db,'notifications'), {
        userId:'gerente', requestId:id,
        type:'pending_gerente_approval', title:'📋 Solicitação aguarda sua aprovação',
        message:`${req.requesterName} · ${req.machine||''} · ${req.originCityName||''} → ${req.destCityName||''}`,
        read:false, createdAt:serverTimestamp(),
      })
      const cfg = await getDoc(doc(db,'config','settings'))
      const s   = cfg.exists() ? cfg.data() : {}
      if (s.whatsappPhone && s.whatsappApikey) {
        const msg = `📋 Solicitação aprovada pelo Supervisor — aguarda sua aprovação\nSolicitante: ${req.requesterName||'—'} · ${req.machine||'—'}\nRota: ${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}\n👉 Abrir e aprovar: https://dieguinhosoares.github.io/mills-logistica/`
        await notifyWhatsApp(s.whatsappPhone, s.whatsappApikey, msg)
      }
    }
  }

  const refuseAsSupervisor = async (id, note, approverName) => {
    const snap = await getDoc(doc(db,'requests',id))
    const req  = { id, ...snap.data() }
    const logEntry = { step:'supervisor', approver:approverName, note, at:new Date().toISOString(), action:'refused' }
    await updateDoc(doc(db,'requests',id), {
      status:'recusado', responseNote:note,
      approvalLog:[...(req.approvalLog||[]), logEntry],
      updatedAt:serverTimestamp(),
    })
    await addDoc(collection(db,'notifications'), {
      userId:req.requesterId, requestId:id,
      type:'request_rejected', title:'❌ Solicitação recusada pelo Supervisor',
      message:note||'Sua solicitação foi recusada.',
      read:false, createdAt:serverTimestamp(),
    })
  }

  const approveAsGerente = async (id, note, approverName, approverRole) => {
    const snap = await getDoc(doc(db,'requests',id))
    const req  = { id, ...snap.data() }
    const logEntry = { step:'gerente', approver:approverName, role:approverRole, note, at:new Date().toISOString(), action:'approved' }
    await updateDoc(doc(db,'requests',id), {
      status:'pendente',
      approvalLog:[...(req.approvalLog||[]), logEntry],
      gerenteApprovedAt:serverTimestamp(),
      gerenteApprovedBy:approverName,
      updatedAt:serverTimestamp(),
    })
    await addDoc(collection(db,'notifications'), {
      userId:req.requesterId, requestId:id,
      type:'gerente_approved', title:'✅ Aprovado pela Gerência',
      message:note||'Sua solicitação foi aprovada pela gerência e encaminhada para o time de Frotas.',
      read:false, createdAt:serverTimestamp(),
    })
  }

  const refuseAsGerente = async (id, note, approverName) => {
    const snap = await getDoc(doc(db,'requests',id))
    const req  = { id, ...snap.data() }
    const logEntry = { step:'gerente', approver:approverName, note, at:new Date().toISOString(), action:'refused' }
    await updateDoc(doc(db,'requests',id), {
      status:'recusado', responseNote:note,
      approvalLog:[...(req.approvalLog||[]), logEntry],
      updatedAt:serverTimestamp(),
    })
    await addDoc(collection(db,'notifications'), {
      userId:req.requesterId, requestId:id,
      type:'request_rejected', title:'❌ Solicitação recusada pela Gerência',
      message:note||'Sua solicitação foi recusada pela gerência.',
      read:false, createdAt:serverTimestamp(),
    })
  }

  const approveAsMaster = async (id, note, approverName) => {
    const snap = await getDoc(doc(db,'requests',id))
    const req  = { id, ...snap.data() }
    const logEntry = { step:'master', approver:approverName, role:'master', note, at:new Date().toISOString(), action:'approved' }
    await updateDoc(doc(db,'requests',id), {
      status:'pendente',
      approvalLog:[...(req.approvalLog||[]), logEntry],
      masterApprovedAt:serverTimestamp(),
      masterApprovedBy:approverName,
      updatedAt:serverTimestamp(),
    })
    await addDoc(collection(db,'notifications'), {
      userId:req.requesterId, requestId:id,
      type:'master_approved', title:'✅ Aprovado pelo Master',
      message:note||'Sua solicitação foi aprovada e encaminhada para o time de Frotas.',
      read:false, createdAt:serverTimestamp(),
    })
  }

  return {
    requests, loading,
    submitRequest, respondRequest,
    approveAsSupervisor, refuseAsSupervisor,
    approveAsGerente, refuseAsGerente,
    approveAsMaster,
  }
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
    const q = query(collection(db,'users'), where('status','==','pendente'), orderBy('createdAt','asc'))
    const unsub = onSnapshot(q,
      snap => setPendingUsers(snap.docs.map(d=>({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [])
  const approveUser = async (userId, role) => {
    await updateDoc(doc(db,'users',userId), { status:'ativo', role, approvedAt:new Date().toISOString() })
    await addDoc(collection(db,'notifications'), {
      userId, type:'account_approved', title:'✅ Acesso liberado!',
      message:`Seu cadastro foi aprovado. Perfil: ${role}.`,
      read:false, createdAt:serverTimestamp(),
    })
  }
  const refuseUser = async (userId) => {
    await updateDoc(doc(db,'users',userId), { status:'recusado', refusedAt:new Date().toISOString() })
  }
  return { pendingUsers, approveUser, refuseUser }
}

export function useAllUsers() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    const q = query(collection(db,'users'), orderBy('createdAt','asc'))
    const unsub = onSnapshot(q,
      snap => setUsers(snap.docs.map(d=>({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [])
  const toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ativo' ? 'bloqueado' : 'ativo'
    await updateDoc(doc(db,'users',userId), { status:newStatus, updatedAt:new Date().toISOString() })
  }
  const updateUserRole = async (userId, role) => {
    await updateDoc(doc(db,'users',userId), { role, updatedAt:new Date().toISOString() })
  }
  return { users, toggleUserStatus, updateUserRole }
}

export function useCancelRequest() {
  const cancelCard = async (cardId, reason, authorName) => {
    await updateDoc(doc(db,'cards',cardId), {
      status:'cancelado', cancelReason:reason,
      cancelledAt:serverTimestamp(), cancelledBy:authorName, updatedAt:serverTimestamp(),
    })
  }
  return { cancelCard }
}

export function useMessages(requestId) {
  const [messages, setMessages] = useState([])
  useEffect(() => {
    if (!requestId) return
    const q = query(collection(db,'requests',requestId,'messages'), orderBy('createdAt','asc'))
    const unsub = onSnapshot(q,
      snap => setMessages(snap.docs.map(d=>({ id:d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [requestId])
  const sendMessage = async ({ requestId, text, authorId, authorName, authorRole, type='message', statusEvent=null }) => {
    await addDoc(collection(db,'requests',requestId,'messages'), {
      text, authorId, authorName, authorRole, type, statusEvent, createdAt:serverTimestamp(),
    })
  }
  return { messages, sendMessage }
}

export function useRotogramas(driverId) {
  const [rotograma, setRotograma] = useState(null)
  useEffect(() => {
    if (!driverId) return
    const q = query(collection(db,'rotogramas'), where('driverId','==',driverId), where('status','==','ativo'))
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) setRotograma({ id:snap.docs[0].id, ...snap.docs[0].data() })
      else setRotograma(null)
    }, ()=>{})
    return unsub
  }, [driverId])
  return { rotograma }
}

export function useAllRotogramas() {
  const [rotogramas, setRotogramas] = useState([])
  useEffect(() => {
    const q = query(collection(db,'rotogramas'), where('status','==','ativo'))
    const unsub = onSnapshot(q,
      snap => setRotogramas(snap.docs.map(d=>({ id:d.id, ...d.data() }))),
      ()=>{}
    )
    return unsub
  }, [])
  return { rotogramas }
}

export async function ensureDriverToken(driverId) {
  const ref  = doc(db,'drivers',driverId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.token) return data.token
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  await updateDoc(ref, { token })
  return token
}

export function useManagerialRequests() {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  useEffect(() => {
    // Busca TODAS as solicitações que passam pelo fluxo de aprovação gerencial
    // Inclui: needsGerenteApproval=true (TT/Garantia/Sinistro) E Guindauto (needsApproval=true mas needsGerenteApproval=false)
    const q = query(collection(db,'requests'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q,
      snap => {
        const all = snap.docs.map(d=>({ id:d.id, ...d.data() }))
          .filter(r =>
            r.needsGerenteApproval === true ||
            r.type === 'guindauto' ||
            ['troca_tecnica','garantia','sinistro'].includes(r.subtype)
          )
        setRequests(all)
        setLoading(false)
      },
      () => { setLoading(false) }
    )
    return unsub
  }, [])
  return { requests, loading }
}

export async function runDailyBackup(cards, requests) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const ref = doc(db,'backups',today)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      await setDoc(doc(db,'system','backupStatus'), { lastCheckAt:serverTimestamp(), lastBackupDate:today }, { merge:true })
      return
    }
    await setDoc(ref, {
      date:today, createdAt:serverTimestamp(),
      cardsCount:cards.length, requestsCount:requests.length,
      cards:cards.map(c=>({...c})), requests:requests.map(r=>({...r})),
    })
    await setDoc(doc(db,'system','backupStatus'), {
      lastBackupAt:serverTimestamp(), lastBackupDate:today,
      lastCheckAt:serverTimestamp(), cardsCount:cards.length, requestsCount:requests.length,
    }, { merge:true })
    console.log('Backup OK:', today)
  } catch(e) { console.warn('Backup error:', e) }
}

// Monitoramento de backup — MasterView usa pra exibir alerta quando atrasado.
export function useBackupStatus() {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'system','backupStatus'), snap => {
      setStatus(snap.exists() ? snap.data() : null)
    }, () => {})
    return unsub
  }, [])
  return status
}

// Utilitário de migração — preenche seqId sequencial em cards que não têm esse campo.
// Chamado uma única vez pelo Master via botão "Executar migração" no MasterView.
export async function backfillSeqIds() {
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(collection(db,'cards'))
  const semSeq = snap.docs.filter(d => !d.data().seqId).map(d => ({ id:d.id, ...d.data() }))
  semSeq.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))
  let seq = 1
  for (const c of semSeq) {
    await updateDoc(doc(db,'cards',c.id), { seqId: seq++ })
  }
  return semSeq.length
}
