import { useState, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useManagerialRequests, useNotifications, useConfig } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, URGENCY, BS, IS, LS } from '../lib/constants'
import { fmt, getSubtypeLabel } from '../lib/utils'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const STATUS_CONFIG = {
  pendente_supervisor: { label:'⏳ Aguard. Supervisor', color:'#B8860B', bg:'#FFF8E1' },
  pendente_gerente:    { label:'📋 Aguard. Gerência',   color:T.info,    bg:T.infoLight },
  pendente:            { label:'🚛 No time de Frotas',  color:T.verde,   bg:T.verdeLight },
  aceito:              { label:'✅ Aceito',              color:T.sucesso, bg:T.sucessoLight },
  recusado:            { label:'❌ Recusado',            color:T.perigo,  bg:T.perigoLight },
  cancelado:           { label:'🚫 Cancelado',           color:T.textMuted, bg:T.surfaceLow },
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => 
    window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = e => setMobile(e.matches)
    mq.addEventListener('change', fn)
    setMobile(mq.matches)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

function ApprovalModal({ req, profile, onApprove, onRefuse, onClose, isMobile }) {
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type]
  const ug = URGENCY[req.urgency]
  const isSupervisorStep = req.status === 'pendente_supervisor'
  const stepLabel = profile?.role === 'master' ? 'Master' : isSupervisorStep ? 'Supervisor' : 'Gerente'

  const handleApprove = async () => {
    setSaving(true)
    await onApprove(req.id, note, profile?.name, profile?.role)
    await addDoc(collection(db,'requests',req.id,'messages'), {
      text: note || `Aprovado pelo ${stepLabel}.`,
      authorId: profile?.uid||'', authorName: profile?.name||stepLabel,
      authorRole: profile?.role||'gerente',
      type:'status_change', statusEvent:'aprovado_gerencial', createdAt:serverTimestamp(),
    })
    setSaving(false); onClose()
  }

  const handleRefuse = async () => {
    if (!note.trim()) return
    setSaving(true)
    await onRefuse(req.id, note, profile?.name)
    await addDoc(collection(db,'requests',req.id,'messages'), {
      text: `Recusado pelo ${stepLabel}. Motivo: ${note}`,
      authorId: profile?.uid||'', authorName: profile?.name||stepLabel,
      authorRole: profile?.role||'gerente',
      type:'status_change', statusEvent:'recusado_gerencial', createdAt:serverTimestamp(),
    })
    setSaving(false); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.6)', zIndex:2000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ y:isMobile?100:0, scale:isMobile?1:.95, opacity:0 }} animate={{ y:0, scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:isMobile?'20px 20px 0 0':T.rLg, padding:isMobile?'20px 16px 32px':28,
          width:isMobile?'100%':540, maxHeight:isMobile?'92vh':'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>

        {isMobile && <div style={{ width:40, height:4, background:T.borderMid, borderRadius:2, margin:'0 auto 16px', flexShrink:0 }}/>}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:isMobile?18:20, margin:0 }}>📋 Avaliar Solicitação</h2>
            <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:3 }}>
              Alçada: <strong style={{ color:T.laranja }}>{stepLabel}</strong>
            </div>
          </div>
          {!isMobile && <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>}
        </div>

        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
            <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type, req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Solicitante', req.requesterName||'—'],
              ['Unidade',     req.unit||'—'],
              ['Equipamento', req.machine||'—'],
              ['Data',        fmt(req.desiredDate)],
              ['Rota', `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
              ['Planta/Obra', req.clientName||'—'],
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {req.approvalLog?.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Histórico</div>
            {req.approvalLog.map((log, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:5, padding:'7px 10px', background:log.action==='approved'?T.verdeLight:T.perigoLight, borderRadius:T.rSm }}>
                <span>{log.action==='approved'?'✅':'❌'}</span>
                <div>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:700 }}>{log.approver} <span style={{ color:T.textMuted, fontWeight:400 }}>({log.step})</span></div>
                  {log.note && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10 }}>{log.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={LS}>Observação <span style={{ color:T.textMuted, fontWeight:400, fontSize:10 }}>(obrigatório para recusa)</span></label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Observação para o solicitante..."
            style={{ ...IS, height:isMobile?70:80, resize:'vertical', marginTop:5 }}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <button onClick={handleRefuse} disabled={saving||!note.trim()}
            style={{ ...BS, background:note.trim()?T.perigoLight:T.borderMid, color:note.trim()?T.perigo:T.textMuted,
              border:`1px solid ${note.trim()?T.perigo+'40':T.border}`, fontWeight:700,
              padding:isMobile?'14px':'8px 16px', fontSize:isMobile?14:12, borderRadius:T.rLg, opacity:note.trim()?1:0.5 }}>
            ❌ Recusar
          </button>
          <button onClick={handleApprove} disabled={saving}
            style={{ ...BS, background:T.verde, color:'white', fontWeight:700,
              padding:isMobile?'14px':'8px 16px', fontSize:isMobile?14:12, borderRadius:T.rLg }}>
            {saving?'⏳...':'✅ Aprovar'}
          </button>
        </div>

        {isMobile && (
          <button onClick={onClose} style={{ ...BS, width:'100%', background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, marginTop:10, padding:'12px', fontSize:13, borderRadius:T.rLg }}>
            Cancelar
          </button>
        )}
      </motion.div>
    </div>
  )
}

function MobileRequestCard({ req, profile, onOpen }) {
  const ct = CARD_TYPES[req.type]
  const ug = URGENCY[req.urgency]
  const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente
  const canApprove =
    (profile?.role==='supervisor' && req.status==='pendente_supervisor') ||
    (profile?.role==='gerente'    && req.status==='pendente_gerente') ||
    (profile?.role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  return (
    <motion.div layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      style={{ background:T.surface, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow, border:`1.5px solid ${sc.color}25`, marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
          {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
        </div>
        <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 10px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap', marginLeft:8 }}>{sc.label}</span>
      </div>

      <div style={{ marginBottom:8 }}>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:T.text }}>{req.requesterName||'—'}</div>
        <div style={{ fontFamily:FONT, fontSize:12, color:T.textMuted }}>{req.unit}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {[
          ['Equipamento', req.machine||'—'],
          ['Data', fmt(req.desiredDate)],
          ['Rota', `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
          ['Urgência', `${ug?.icon} ${ug?.label}`],
        ].map(([l,v])=>(
          <div key={l}>
            <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
            <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
          </div>
        ))}
      </div>

      {canApprove && (
        <button onClick={()=>onOpen(req)}
          style={{ ...BS, width:'100%', background:T.laranja, color:'white', fontWeight:700, padding:'13px', fontSize:14, borderRadius:T.rLg }}>
          ✅ Avaliar Solicitação
        </button>
      )}
      {!canApprove && (
        <button onClick={()=>onOpen(req)}
          style={{ ...BS, width:'100%', background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontWeight:700, padding:'10px', fontSize:13, borderRadius:T.rLg }}>
          🔍 Ver Detalhes
        </button>
      )}
    </motion.div>
  )
}

function DesktopRequestCard({ req, profile, onView }) {
  const ct  = CARD_TYPES[req.type]
  const ug  = URGENCY[req.urgency]
  const sc  = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente
  const canApprove =
    (profile?.role==='supervisor' && req.status==='pendente_supervisor') ||
    (profile?.role==='gerente'    && req.status==='pendente_gerente') ||
    (profile?.role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  return (
    <motion.div layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
      style={{ background:T.surface, border:`1.5px solid ${sc.color}25`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow, marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
          {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
          <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 9px', color:ug?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
        </div>
        <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        {[['Solicitante',req.requesterName||'—'],['Unidade',req.unit||'—'],['Equipamento',req.machine||'—'],
          ['Rota',`${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
          ['Data',fmt(req.desiredDate)],['Planta/Obra',req.clientName||'—']].map(([l,v])=>(
          <div key={l}>
            <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
            <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div>
          </div>
        ))}
      </div>
      {req.approvalLog?.length>0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
          {req.approvalLog.map((log,i)=>(
            <span key={i} style={{ background:log.action==='approved'?T.verdeLight:T.perigoLight, color:log.action==='approved'?T.verde:T.perigo, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>
              {log.action==='approved'?'✅':'❌'} {log.step}: {log.approver?.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={()=>onView(req)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>🔍 Detalhes</button>
        {canApprove && (
          <button onClick={()=>onView(req)} style={{ ...BS, background:T.verde, color:'white', fontSize:10, padding:'4px 12px', fontWeight:700 }}>✅ Avaliar</button>
        )}
      </div>
    </motion.div>
  )
}

export function GerenteView() {
  const { profile, logout }   = useAuth()
  const { requests: allReqs, approveAsSupervisor, refuseAsSupervisor, approveAsGerente, refuseAsGerente } = useRequests(profile?.role)
  const { requests: mgrReqs } = useManagerialRequests()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { config, saveConfig } = useConfig()
  const { toasts, add:addToast, dismiss } = useToasts()
  const isMobile = useIsMobile()

  const [tab,          setTab]        = useState('aprovacao')
  const [reviewing,    setReviewing]  = useState(null)
  const [filterStatus, setFilter]     = useState('todos')
  const [waPhone,      setWaPhone]    = useState('')
  const [waApikey,     setWaApikey]   = useState('')
  const [savedWa,      setSavedWa]    = useState(false)

  const role = profile?.role

  const pendingSupervisor = mgrReqs.filter(r=>r.status==='pendente_supervisor')
  const pendingGerente    = mgrReqs.filter(r=>r.status==='pendente_gerente')
  const myPending =
    role==='supervisor' ? pendingSupervisor :
    role==='gerente'    ? pendingGerente    :
    role==='master'     ? [...pendingSupervisor, ...pendingGerente] : []

  const filtered = filterStatus==='todos' ? mgrReqs : mgrReqs.filter(r=>r.status===filterStatus)

  const handleApproveFromModal = async (id, note, name, r) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    if (r==='supervisor' || (r==='master' && req.status==='pendente_supervisor')) await approveAsSupervisor(id, note, name, r)
    else await approveAsGerente(id, note, name, r)
    addToast('Solicitação aprovada!', 'success')
  }

  const handleRefuseFromModal = async (id, note, name) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    if (role==='supervisor' || (role==='master' && req.status==='pendente_supervisor')) await refuseAsSupervisor(id, note, name)
    else await refuseAsGerente(id, note, name)
    addToast('Solicitação recusada.', 'info')
  }

  const handleSaveWhatsapp = async () => {
    await saveConfig({ whatsappPhone: waPhone, whatsappApikey: waApikey })
    setSavedWa(true); setTimeout(()=>setSavedWa(false), 2000)
    addToast('WhatsApp configurado!', 'success')
  }

  const roleLabel = { supervisor:'👷 SUPERVISOR', gerente:'👔 GERENTE', master:'⭐ MASTER' }[role] || ''
  const totalPendentes = myPending.length
  const totalAprovados = mgrReqs.filter(r=>['pendente','aceito'].includes(r.status)).length
  const totalRecusados = mgrReqs.filter(r=>r.status==='recusado').length

  const TABS = [
    { id:'aprovacao', label:'📋 Aprovação', badge: totalPendentes||null },
    { id:'painel',    label:'📊 Painel',    badge: null },
    { id:'config',    label:'⚙️ Config',    badge: null },
  ]

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      {reviewing && <ApprovalModal req={reviewing} profile={profile} isMobile={true} onApprove={handleApproveFromModal} onRefuse={handleRefuseFromModal} onClose={()=>setReviewing(null)}/>}

      {/* Header mobile */}
      <div style={{ background:T.verde, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:T.shadowMd, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <MillsLogo height={24}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase' }}>{roleLabel}</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9 }}>{profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={logout} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:T.r, padding:'5px 10px', fontFamily:FONT, fontSize:11, cursor:'pointer' }}>Sair</button>
        </div>
      </div>

      {/* Tab bar mobile */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, display:'flex', padding:'0 4px', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:11,
              color:tab===t.id?T.laranja:T.textMuted, borderBottom:`2px solid ${tab===t.id?T.laranja:'transparent'}`,
              transition:'all .15s', position:'relative' }}>
            {t.label}
            {t.badge>0 && <span style={{ position:'absolute', top:6, right:'calc(50% - 18px)', background:T.perigo, color:'white', borderRadius:10, fontSize:9, fontWeight:800, padding:'0 4px', fontFamily:FONT }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo mobile */}
      <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>

        {tab==='aprovacao' && <>
          <div style={{ marginBottom:14 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:T.text, margin:0 }}>Aguardando Aprovação</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              {myPending.length===0 ? 'Nenhuma pendente.' : `${myPending.length} solicitação(ões)`}
            </p>
          </div>
          {myPending.length===0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
              <div style={{ fontSize:50, marginBottom:10 }}>✅</div>
              <p style={{ fontWeight:700, fontSize:16 }}>Tudo em dia!</p>
            </div>
          )}
          {myPending.map(r => <MobileRequestCard key={r.id} req={r} profile={profile} onOpen={setReviewing}/>)}
        </>}

        {tab==='painel' && <>
          <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:T.text, margin:'0 0 14px' }}>Painel Gerencial</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              { l:'Total',        v:mgrReqs.length,   c:T.laranja, bg:T.laranjaLight },
              { l:'Aguardando',   v:myPending.length, c:'#B8860B',  bg:'#FFF8E1'     },
              { l:'No time Frotas',v:totalAprovados,  c:T.verde,   bg:T.verdeLight  },
              { l:'Recusadas',    v:totalRecusados,   c:T.perigo,  bg:T.perigoLight },
            ].map(s=>(
              <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}30`, borderRadius:T.rLg, padding:'14px 12px', boxShadow:T.shadow }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:900, fontSize:28, lineHeight:1 }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
            {[['todos','Todos'],['pendente_supervisor','Supervisor'],['pendente_gerente','Gerência'],['pendente','Frotas'],['aceito','Aceito'],['recusado','Recusado']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ ...BS, background:filterStatus===v?T.laranja:T.surface, color:filterStatus===v?'white':T.textSec,
                  border:`1px solid ${filterStatus===v?T.laranja:T.border}`, fontSize:11, padding:'6px 12px', whiteSpace:'nowrap', flexShrink:0 }}>
                {l}
              </button>
            ))}
          </div>
          {filtered.map(r => <MobileRequestCard key={r.id} req={r} profile={profile} onOpen={setReviewing}/>)}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'30px 0', color:T.textMuted, fontFamily:FONT }}>📭 Nenhuma solicitação neste filtro.</div>}
        </>}

        {tab==='config' && (
          <div style={{ maxWidth:500 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
            <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:16, boxShadow:T.shadow }}>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>💬 Número WhatsApp (ex: 5518999999999)</label>
                <input value={waPhone} onChange={e=>setWaPhone(e.target.value)} placeholder="5518999999999" style={{ ...IS, marginTop:6 }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>🔑 CallMeBot API Key</label>
                <input value={waApikey} onChange={e=>setWaApikey(e.target.value)} placeholder="Ex: 5517289" style={{ ...IS, marginTop:6 }}/>
                <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                  Ative: salve +34 644 52 74 88 e envie <strong>I allow callmebot to send me messages</strong>
                </p>
              </div>
              <button onClick={handleSaveWhatsapp} style={{ ...BS, width:'100%', background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700, padding:'13px', fontSize:14, borderRadius:T.rLg }}>
                {savedWa?'✅ Salvo!':'💾 Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav indicator */}
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'6px 16px', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
      </div>
    </div>
  )

  // ── DESKTOP LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      {reviewing && <ApprovalModal req={reviewing} profile={profile} isMobile={false} onApprove={handleApproveFromModal} onRefuse={handleRefuseFromModal} onClose={()=>setReviewing(null)}/>}

      <div style={{ background:T.verde, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0, boxShadow:T.shadowMd }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.2)' }}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>{roleLabel}</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>Fluxo de Aprovação · {profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'5px 14px', borderRadius:T.r, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:11, transition:'all .15s', position:'relative',
                background:tab===t.id?T.laranja:'rgba(255,255,255,0.12)', color:tab===t.id?'white':'rgba(255,255,255,0.7)' }}>
              {t.label}
              {t.badge>0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      {tab==='aprovacao' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>Solicitações Aguardando Aprovação</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              {myPending.length===0 ? 'Nenhuma solicitação pendente.' : `${myPending.length} solicitação(ões) aguardando sua avaliação`}
            </p>
          </div>
          {myPending.length===0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
              <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
              <p style={{ fontWeight:700, fontSize:16 }}>Tudo em dia!</p>
            </div>
          )}
          {myPending.map(r => <DesktopRequestCard key={r.id} req={r} profile={profile} onView={setReviewing}/>)}
        </div>
      )}

      {tab==='painel' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>Painel Gerencial</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>Troca Técnica · Garantia · Sinistro · Guindauto</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
            {[
              { l:'Total',             v:mgrReqs.length,   c:T.laranja, bg:T.laranjaLight },
              { l:'Aguard. Aprovação', v:myPending.length, c:'#B8860B',  bg:'#FFF8E1'     },
              { l:'No time de Frotas', v:totalAprovados,   c:T.verde,   bg:T.verdeLight  },
              { l:'Recusadas',         v:totalRecusados,   c:T.perigo,  bg:T.perigoLight },
            ].map(s=>(
              <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}30`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:900, fontSize:28, lineHeight:1 }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {[['todos','Todos'],['pendente_supervisor','Aguard. Supervisor'],['pendente_gerente','Aguard. Gerência'],['pendente','No time de Frotas'],['aceito','Aceito'],['recusado','Recusado']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ ...BS, background:filterStatus===v?T.laranja:T.surface, color:filterStatus===v?'white':T.textSec, border:`1px solid ${filterStatus===v?T.laranja:T.border}`, fontSize:10, padding:'4px 12px' }}>
                {l}
              </button>
            ))}
          </div>
          {filtered.map(r => <DesktopRequestCard key={r.id} req={r} profile={profile} onView={setReviewing}/>)}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}><div style={{ fontSize:36, marginBottom:8 }}>📭</div><p>Nenhuma solicitação neste filtro.</p></div>}
        </div>
      )}

      {tab==='config' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px', maxWidth:600 }}>
          <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
          <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:20, boxShadow:T.shadow }}>
            <div style={{ marginBottom:14 }}>
              <label style={LS}>💬 Número WhatsApp (com DDI+DDD, ex: 5518999999999)</label>
              <input value={waPhone} onChange={e=>setWaPhone(e.target.value)} placeholder="5518999999999" style={{ ...IS, marginTop:6 }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={LS}>🔑 CallMeBot API Key</label>
              <input value={waApikey} onChange={e=>setWaApikey(e.target.value)} placeholder="Ex: 5517289" style={{ ...IS, marginTop:6 }}/>
              <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                Para ativar: salve +34 644 52 74 88 e envie <strong>I allow callmebot to send me messages</strong>
              </p>
            </div>
            <button onClick={handleSaveWhatsapp} style={{ ...BS, background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700 }}>
              {savedWa?'✅ Salvo!':'💾 Salvar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>Fluxo de Aprovação Gerencial</span>
      </div>
    </div>
  )
}
