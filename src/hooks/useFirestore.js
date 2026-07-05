import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, setDoc, getDoc, getDocs, limit,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useCards() {
  const [cards,   setCards]   = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    // Janela móvel (item 15 da revisão): últimos 180 dias + todos os futuros.
    // Sem isso a coleção inteira era baixada em tempo real — custo de leitura e
    // memória crescendo linearmente com o histórico. Relatórios de períodos mais
    // antigos podem ler sob demanda com getDocs se um dia for necessário.
    const cutoff = new Date(Date.now() - 180*86400000).toISOString().split('T')[0]
    const q = query(collection(db,'cards'), where('startDate','>=',cutoff), orderBy('startDate','asc'))
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

// Notifica todos os usuários ATIVOS de um ou mais roles (busca o UID real em
// 'users' antes de gravar). Corrige o bug em que notifyUser('gerente', ...) era
// chamado com a string literal do role em vez de um UID — o filtro do sininho é
// where('userId','==',user.uid), então essas notificações nunca apareciam para
// ninguém (alerta fantasma).
export async function notifyRoles(roles, type, title, message, requestId = null) {
  const q = query(collection(db,'users'), where('role','in', roles), where('status','==','ativo'))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map(d => notifyUser(d.id, type, title, message, requestId)))
}

// Helper único para criar notificações in-app (item 12 da revisão).
// Evita repetir o mesmo addDoc em 9 lugares com riscos de divergência de shape.
export async function notifyUser(userId, type, title, message, requestId = null) {
  await addDoc(collection(db,'notifications'), {
    userId, type, title, message,
    ...(requestId ? { requestId } : {}),
    read: false, createdAt: serverTimestamp(),
  })
}

// Mensagem padrão de "nova solicitação pronta para atribuição" — reaproveitada
// nos 3 pontos em que uma solicitação pode chegar ao status 'pendente' (pronta
// para o time de Frotas): criação direta, reenvio direto, e fim da cadeia de
// aprovação (Gerente/Master). Sem isso, Frotas só descobria olhando a tela.
function fleetReadyMessage(req) {
  const tipo = { freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente', guindauto:'Guindauto' }[req.type] || req.type
  const sub  = req.subtype ? ' · ' + String(req.subtype).replace(/_/g,' ') : ''
  return `${req.requesterName||'—'} · ${tipo}${sub} · ${req.clientName||req.client||'—'} · ${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`
}

async function notifyWhatsApp(phone, apikey, msg) {
  try {
    // mode:'no-cors' — o CallMeBot não envia headers CORS; sem isso o fetch é
    // bloqueado pelo browser e a notificação nunca sai (falha silenciosa).
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${apikey}`, { mode:'no-cors' })
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
      q = query(collection(db,'requests'), orderBy('createdAt','desc'), limit(500))
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
      // Reenvio: monta o payload explicitamente — sem usar spread do form
      // que contém objetos não-serializáveis (Sets, refs, _livreLookup, etc.)
      const reqId = data.id
      const payload = {
        type:                 data.type || '',
        subtype:              data.subtype || '',
        clientName:           data.clientName || data.client || '',
        client:               data.clientName || data.client || '',
        plantaObra:           data.clientName || data.client || '',
        nInterno:             Array.isArray(data.nInternos) ? data.nInternos.join(', ') : (data.nInterno || ''),
        nInternos:            Array.isArray(data.nInternos) ? data.nInternos : [],
        nInternosReserva:     Array.isArray(data.nInternosReserva) ? data.nInternosReserva : [],
        machine:              data.machine || '',
        grupoModelo:          data.grupoModelo || '',
        originCity:           data.originCity?.m || data.originCity || '',
        destCity:             data.destCity?.m || data.destCity || '',
        origin:               data.originCity?.s || data.origin || '',
        destination:          data.destCity?.s || data.destination || '',
        desiredDate:          data.desiredDate || '',
        desiredDateEnd:       data.desiredDateEnd || '',
        urgency:              data.urgency || 'medio',
        om:                   data.om || '',
        description:          data.description || '',
        channel:              data.channel || 'teams',
        podeEmbarcar:         data.podeEmbarcar || null,
        destinoOficina:       data.destinoOficina || '',
        movimento:            data.movimento || '',
        semCliente:           !!data.semCliente,
        localLivre:           data.localLivre || '',
        unit:                 data.unit || profile?.unit || '',
        requesterName:        data.requesterName || profile?.name || '',
        status,
        needsGerenteApproval: needsGer,
        respondedAt:          null,
        responseNote:         null,
        updatedAt:            serverTimestamp(),
      }
      await updateDoc(doc(db,'requests',reqId), payload)
      await addDoc(collection(db,'requests',reqId,'messages'), {
        text:'Solicitação ajustada e reenviada pelo solicitante.',
        authorId:   profile?.uid  || '',
        authorName: profile?.name || 'Solicitante',
        authorRole: profile?.role || 'solicitante',
        type:       'status_change',
        statusEvent:'reenviada',
        createdAt:  serverTimestamp(),
      })
      if (status === 'pendente') {
        await notifyRoles(['frotas'], 'request_ready_for_fleet', '📥 Solicitação pronta para atribuição',
          fleetReadyMessage(payload), reqId)
      }
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
    } else if (status === 'pendente') {
      await notifyRoles(['frotas'], 'request_ready_for_fleet', '📥 Solicitação pronta para atribuição',
        fleetReadyMessage(data), null)
    }
  }

  const respondRequest = async (id, status, note, teamsWebhookUrl) => {
    await updateDoc(doc(db,'requests',id), {
      status, responseNote:note, respondedAt:serverTimestamp(), updatedAt:serverTimestamp(),
    })
    const req = requests.find(r=>r.id===id)
    if (req) {
      await notifyUser(req.requesterId,
        status==='aceito'?'request_accepted':'request_rejected',
        status==='aceito'?'✅ Solicitação aceita!':'❌ Solicitação recusada',
        note||(status==='aceito'?'Sua solicitação foi aceita.':'Sua solicitação foi recusada.'), id)
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

// ── Ações de aprovação em cadeia (Supervisor → Gerente/Master) ─────────────
// Funções standalone (não são hooks): não dependem de nenhum listener em tempo
// real, só de getDoc/updateDoc pontuais. Ficavam presas dentro de useRequests()
// só por conveniência — mas isso obrigava qualquer tela que precisasse delas
// (GerenteView) a montar um segundo listener completo da coleção 'requests'
// só para pegar essas 5 funções, sem nunca usar os dados que ele retornava
// (item da revisão: "listener fantasma"). Extraídas aqui, GerenteView não
// precisa mais chamar useRequests() e o listener duplicado desaparece.
export async function approveAsSupervisor(id, note, approverName, approverRole) {
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
  await notifyUser(req.requesterId, 'supervisor_approved', '✅ Aprovado pelo Supervisor',
    note || 'Sua solicitação foi aprovada pelo supervisor.', id)
  if (req.needsGerenteApproval) {
    await notifyRoles(['gerente','master'], 'pending_gerente_approval', '📋 Solicitação aguarda sua aprovação',
      `${req.requesterName} · ${req.machine||''} · ${req.originCityName||''} → ${req.destCityName||''}`, id)
    const cfg = await getDoc(doc(db,'config','settings'))
    const s   = cfg.exists() ? cfg.data() : {}
    if (s.whatsappPhone && s.whatsappApikey) {
      const msg = `📋 Solicitação aprovada pelo Supervisor — aguarda sua aprovação\nSolicitante: ${req.requesterName||'—'} · ${req.machine||'—'}\nRota: ${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}\n👉 Abrir e aprovar: https://dieguinhosoares.github.io/mills-logistica/`
      await notifyWhatsApp(s.whatsappPhone, s.whatsappApikey, msg)
    }
  }
}

export async function refuseAsSupervisor(id, note, approverName) {
  const snap = await getDoc(doc(db,'requests',id))
  const req  = { id, ...snap.data() }
  const logEntry = { step:'supervisor', approver:approverName, note, at:new Date().toISOString(), action:'refused' }
  await updateDoc(doc(db,'requests',id), {
    status:'recusado', responseNote:note,
    approvalLog:[...(req.approvalLog||[]), logEntry],
    updatedAt:serverTimestamp(),
  })
  await notifyUser(req.requesterId, 'request_rejected', '❌ Solicitação recusada pelo Supervisor',
    note||'Sua solicitação foi recusada.', id)
}

export async function approveAsGerente(id, note, approverName, approverRole) {
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
  await notifyUser(req.requesterId, 'gerente_approved', '✅ Aprovado pela Gerência',
    note||'Sua solicitação foi aprovada pela gerência e encaminhada para o time de Frotas.', id)
  await notifyRoles(['frotas'], 'request_ready_for_fleet', '📥 Solicitação pronta para atribuição',
    fleetReadyMessage(req), id)
}

export async function refuseAsGerente(id, note, approverName) {
  const snap = await getDoc(doc(db,'requests',id))
  const req  = { id, ...snap.data() }
  const logEntry = { step:'gerente', approver:approverName, note, at:new Date().toISOString(), action:'refused' }
  await updateDoc(doc(db,'requests',id), {
    status:'recusado', responseNote:note,
    approvalLog:[...(req.approvalLog||[]), logEntry],
    updatedAt:serverTimestamp(),
  })
  await notifyUser(req.requesterId, 'request_rejected', '❌ Solicitação recusada pela Gerência',
    note||'Sua solicitação foi recusada pela gerência.', id)
}

export async function approveAsMaster(id, note, approverName) {
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
  await notifyUser(req.requesterId, 'master_approved', '✅ Aprovado pelo Master',
    note||'Sua solicitação foi aprovada e encaminhada para o time de Frotas.', id)
  await notifyRoles(['frotas'], 'request_ready_for_fleet', '📥 Solicitação pronta para atribuição',
    fleetReadyMessage(req), id)
}


export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  useEffect(() => {
    if (!user) return
    const q = query(collection(db,'notifications'), where('userId','==',user.uid), orderBy('createdAt','desc'), limit(100))
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
      // Prioridade 1: batches (formato atual — sempre gerado pelo upload recente)
      // Prioridade 2: clients inline (formato legado — só usado se não há batches)
      if (batches) {
        const all = []
        for (let i = 0; i < batches; i++) {
          const bSnap = await getDoc(doc(db,'config',`simClients_${i}`))
          if (bSnap.exists()) all.push(...(bSnap.data().clients||[]))
        }
        if (all.length > 0) { setSimClients(all); return }
      }
      // Fallback legado — base inline antiga (antes da migração pra batches)
      if (clients && clients.length > 0) setSimClients(clients)
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
    await notifyUser(userId, 'account_approved', '✅ Acesso liberado!',
      `Seu cadastro foi aprovado. Perfil: ${role}.`)
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

// Divide um array em "pedaços" cujo JSON fica sempre abaixo de maxBytes.
// Necessário porque um único documento do Firestore tem limite de 1.048.576
// bytes — o backup monolítico anterior (1 doc com cards+requests inteiros)
// estourou esse limite (1.464.134 bytes) assim que o histórico cresceu, e
// falhava em silêncio (erro só visível no console do navegador).
function chunkBySize(items, maxBytes = 700000) {
  const chunks = []
  let current = [], currentSize = 2 // "[]"
  for (const item of items) {
    const size = JSON.stringify(item).length + 1
    if (current.length > 0 && currentSize + size > maxBytes) {
      chunks.push(current); current = []; currentSize = 2
    }
    current.push(item); currentSize += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export async function runDailyBackup(cards, requests) {
  const today = new Date().toISOString().split('T')[0]
  const ref = doc(db,'backups',today)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    await setDoc(doc(db,'system','backupStatus'), { lastCheckAt:serverTimestamp(), lastBackupDate:today }, { merge:true })
    return
  }
  const cardChunks    = chunkBySize(cards.map(c=>({...c})))
  const requestChunks = chunkBySize(requests.map(r=>({...r})))
  await Promise.all([
    ...cardChunks.map((chunk,i) => setDoc(doc(db,'backups',today,'cardsChunks',String(i)), { items:chunk })),
    ...requestChunks.map((chunk,i) => setDoc(doc(db,'backups',today,'requestsChunks',String(i)), { items:chunk })),
  ])
  // Documento "índice" — pequeno, só metadados. Sempre cabe no limite.
  await setDoc(ref, {
    date:today, createdAt:serverTimestamp(),
    cardsCount:cards.length, requestsCount:requests.length,
    cardChunks:cardChunks.length, requestChunks:requestChunks.length,
  })
  await setDoc(doc(db,'system','backupStatus'), {
    lastBackupAt:serverTimestamp(), lastBackupDate:today,
    lastCheckAt:serverTimestamp(), cardsCount:cards.length, requestsCount:requests.length,
  }, { merge:true })
  console.log('Backup OK:', today, `(${cardChunks.length} chunk(s) de cards, ${requestChunks.length} de requests)`)
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
