import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useManagerialRequests, useNotifications, useConfig, needsGerenteApproval } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BS, IS, LS } from '../lib/constants'
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

function ApprovalModal({ req, profile, mode, onApprove, onRefuse, onClose }) {
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type]
  const ug = URGENCY[req.urgency]

  const isSupervisorStep = req.status === 'pendente_supervisor'
  const isGerenteStep    = req.status === 'pendente_gerente'
  const isMaster         = profile?.role === 'master'

  const stepLabel = isMaster ? 'Master' : isSupervisorStep ? 'Supervisor' : 'Gerente'

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
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:540, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>
              📋 Avaliar Solicitação
            </h2>
            <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:3 }}>
              Alçada: <strong style={{ color:T.laranja }}>{stepLabel}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {/* Detalhes da solicitação */}
        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:16 }}>
          <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
            <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type, req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Solicitante', req.requesterName||'—'],
              ['Unidade',     req.unit||'—'],
              ['Equipamento', req.machine||'—'],
              ['Data desejada', fmt(req.desiredDate)],
              ['Rota', `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
              ['Planta/Obra', req.clientName||'—'],
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>
          {req.description && (
            <div style={{ marginTop:10, padding:'8px 10px', background:T.surface, borderRadius:T.rSm }}>
              <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', fontFamily:FONT, marginBottom:3 }}>Descrição</div>
              <div style={{ color:T.text, fontSize:12, fontFamily:FONT }}>{req.description}</div>
            </div>
          )}
        </div>

        {/* Histórico de aprovações */}
        {req.approvalLog?.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Histórico de aprovações</div>
            {req.approvalLog.map((log, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:6, padding:'8px 10px', background:log.action==='approved'?T.verdeLight:T.perigoLight, borderRadius:T.rSm }}>
                <span style={{ fontSize:14 }}>{log.action==='approved'?'✅':'❌'}</span>
                <div>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:700 }}>{log.approver} <span style={{ color:T.textMuted, fontWeight:400 }}>({log.step})</span></div>
                  {log.note && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10 }}>{log.note}</div>}
                  <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:9 }}>{new Date(log.at).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={LS}>Observação / Justificativa {mode==='refuse'&&<span style={{ color:T.perigo }}>*</span>}</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder={mode==='refuse'?'Motivo da recusa (obrigatório)...':'Observação para o solicitante (opcional)...'}
            style={{ ...IS, height:80, resize:'vertical', marginTop:5 }}/>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleRefuse} disabled={saving||!note.trim()}
            style={{ ...BS, background:note.trim()?T.perigoLight:T.borderMid, color:note.trim()?T.perigo:T.textMuted, border:`1px solid ${note.trim()?T.perigo+'40':T.border}`, fontWeight:700, opacity:note.trim()?1:0.5 }}>
            ❌ Recusar
          </button>
          <button onClick={handleApprove} disabled={saving}
            style={{ ...BS, background:T.verde, color:'white', fontWeight:700 }}>
            {saving?'⏳...':'✅ Aprovar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function RequestCard({ req, profile, onApprove, onRefuse, onView }) {
  const ct  = CARD_TYPES[req.type]
  const ug  = URGENCY[req.urgency]
  const sc  = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente
  const role = profile?.role

  const canApprove =
    (role==='supervisor' && req.status==='pendente_supervisor') ||
    (role==='gerente'    && req.status==='pendente_gerente') ||
    (role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  return (
    <motion.div layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
      style={{ background:T.surface, border:`1.5px solid ${sc.color}25`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
          {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
          <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 9px', color:ug?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
        </div>
        <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        {[
          ['Solicitante', req.requesterName||'—'],
          ['Unidade',     req.unit||'—'],
          ['Equipamento', req.machine||'—'],
          ['Rota', `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
          ['Data desejada', fmt(req.desiredDate)],
          ['Planta/Obra', req.clientName||'—'],
        ].map(([l,v])=>(
          <div key={l}>
            <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
            <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div>
          </div>
        ))}
      </div>

      {req.approvalLog?.length > 0 && (
        <div style={{ marginBottom:8, display:'flex', gap:5, flexWrap:'wrap' }}>
          {req.approvalLog.map((log,i)=>(
            <span key={i} style={{ background:log.action==='approved'?T.verdeLight:T.perigoLight, color:log.action==='approved'?T.verde:T.perigo, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>
              {log.action==='approved'?'✅':'❌'} {log.step}: {log.approver.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={()=>onView(req)}
          style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>
          🔍 Detalhes
        </button>
        {canApprove && (
          <button onClick={()=>onApprove(req)}
            style={{ ...BS, background:T.verde, color:'white', fontSize:10, padding:'4px 12px', fontWeight:700 }}>
            ✅ Avaliar
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function GerenteView() {
  const { profile, logout }   = useAuth()
  const { requests: allReqs, approveAsSupervisor, refuseAsSupervisor, approveAsGerente, refuseAsGerente, approveAsMaster } = useRequests(profile?.role)
  const { requests: mgrReqs } = useManagerialRequests()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { config, saveConfig } = useConfig()
  const { toasts, add:addToast, dismiss } = useToasts()

  const [tab,        setTab]        = useState('aprovacao')
  const [reviewing,  setReviewing]  = useState(null)
  const [filterStatus, setFilter]   = useState('todos')
  const [waPhone,  setWaPhone]  = useState(config?.whatsappPhone||'')
  const [waApikey, setWaApikey] = useState(config?.whatsappApikey||'')
  const [savedWa,    setSavedWa]    = useState(false)

  const role = profile?.role

  // Solicitações que este perfil pode/deve ver para aprovação
  const pendingSupervisor = mgrReqs.filter(r=>r.status==='pendente_supervisor')
  const pendingGerente    = mgrReqs.filter(r=>r.status==='pendente_gerente')

  const myPending =
    role==='supervisor' ? pendingSupervisor :
    role==='gerente'    ? pendingGerente    :
    role==='master'     ? [...pendingSupervisor, ...pendingGerente] : []

  // Todos os históricos gerenciais para o painel
  const filtered = filterStatus==='todos' ? mgrReqs : mgrReqs.filter(r=>r.status===filterStatus)

  const handleApprove = async (req) => {
    if (role==='supervisor' || (role==='master' && req.status==='pendente_supervisor')) {
      await approveAsSupervisor(req.id, '', profile?.name, role)
    } else if (role==='gerente' || (role==='master' && req.status==='pendente_gerente')) {
      await approveAsGerente(req.id, '', profile?.name, role)
    }
    addToast('Solicitação aprovada e encaminhada.', 'success')
  }

  const handleApproveFromModal = async (id, note, name, r) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    if (r==='supervisor' || (r==='master' && req.status==='pendente_supervisor')) {
      await approveAsSupervisor(id, note, name, r)
    } else {
      await approveAsGerente(id, note, name, r)
    }
    addToast('Solicitação aprovada!', 'success')
  }

  const handleRefuseFromModal = async (id, note, name) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    if (role==='supervisor' || (role==='master' && req.status==='pendente_supervisor')) {
      await refuseAsSupervisor(id, note, name)
    } else {
      await refuseAsGerente(id, note, name)
    }
    addToast('Solicitação recusada.', 'info')
  }

  const handleSaveWhatsapp = async () => {
    await saveConfig({ whatsappPhone: waPhone, whatsappApikey: waApikey })
    setSavedWa(true); setTimeout(()=>setSavedWa(false), 2000)
    addToast('WhatsApp configurado!', 'success')
  }

  const roleLabel = {
    supervisor: '👷 SUPERVISOR',
    gerente:    '👔 GERENTE',
    master:     '⭐ MASTER',
  }[role] || ''

  const totalPendentes = myPending.length
  const totalAprovados = mgrReqs.filter(r=>['pendente','aceito'].includes(r.status)).length
  const totalRecusados = mgrReqs.filter(r=>r.status==='recusado').length

  const TABS = [
    { id:'aprovacao', label:'📋 Aprovação',  badge: totalPendentes||null },
    { id:'painel',    label:'📊 Painel',      badge: null },
    { id:'config',    label:'⚙️ Config',      badge: null },
  ]

  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      {reviewing && (
        <ApprovalModal
          req={reviewing}
          profile={profile}
          mode="approve"
          onApprove={handleApproveFromModal}
          onRefuse={handleRefuseFromModal}
          onClose={()=>setReviewing(null)}
        />
      )}

      {/* Header */}
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
                background:tab===t.id?T.laranja:'rgba(255,255,255,0.12)',
                color:tab===t.id?'white':'rgba(255,255,255,0.7)' }}>
              {t.label}
              {t.badge>0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>
              )}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      {/* ABA APROVAÇÃO */}
      {tab==='aprovacao' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>
              Solicitações Aguardando Aprovação
            </h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              {myPending.length===0 ? 'Nenhuma solicitação pendente.' : `${myPending.length} solicitação(ões) aguardando sua avaliação`}
            </p>
          </div>

          {myPending.length===0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
              <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
              <p style={{ fontWeight:700, fontSize:16 }}>Tudo em dia!</p>
              <p style={{ fontSize:13 }}>Nenhuma solicitação aguardando aprovação.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {myPending.map(r=>(
              <RequestCard key={r.id} req={r} profile={profile}
                onApprove={r=>setReviewing(r)}
                onRefuse={r=>setReviewing(r)}
                onView={r=>setReviewing(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ABA PAINEL */}
      {tab==='painel' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>Painel Gerencial</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              Troca Técnica · Garantia · Sinistro · Guindauto — visão completa do fluxo
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
            {[
              { l:'Total',           v:mgrReqs.length,          c:T.laranja,  bg:T.laranjaLight },
              { l:'Aguard. Aprovação',v:mgrReqs.filter(r=>['pendente_supervisor','pendente_gerente'].includes(r.status)).length, c:'#B8860B', bg:'#FFF8E1' },
              { l:'No time de Frotas',v:totalAprovados,          c:T.verde,    bg:T.verdeLight   },
              { l:'Recusadas',        v:totalRecusados,          c:T.perigo,   bg:T.perigoLight  },
            ].map(s=>(
              <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}30`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:900, fontSize:28, lineHeight:1 }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Filtro de status */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {[
              ['todos',              'Todos'],
              ['pendente_supervisor','Aguard. Supervisor'],
              ['pendente_gerente',   'Aguard. Gerência'],
              ['pendente',           'No time de Frotas'],
              ['aceito',             'Aceito'],
              ['recusado',           'Recusado'],
            ].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ ...BS, background:filterStatus===v?T.laranja:T.surface, color:filterStatus===v?'white':T.textSec,
                  border:`1px solid ${filterStatus===v?T.laranja:T.border}`, fontSize:10, padding:'4px 12px' }}>
                {l}
              </button>
            ))}
          </div>

          {filtered.length===0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
              <p>Nenhuma solicitação neste filtro.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(r=>(
              <RequestCard key={r.id} req={r} profile={profile}
                onApprove={r=>setReviewing(r)}
                onRefuse={r=>setReviewing(r)}
                onView={r=>setReviewing(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ABA CONFIG */}
      {tab==='config' && (
  <div style={{ flex:1, overflow:'auto', padding:'16px 20px', maxWidth:600 }}>
    <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:20, boxShadow:T.shadow }}>
      <div style={{ marginBottom:14 }}>
        <label style={LS}>💬 Número WhatsApp (com DDI+DDD, ex: 5518999999999)</label>
        <input value={waPhone} onChange={e=>setWaPhone(e.target.value)}
          placeholder="5518999999999"
          style={{ ...IS, marginTop:6 }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={LS}>🔑 CallMeBot API Key</label>
        <input value={waApikey} onChange={e=>setWaApikey(e.target.value)}
          placeholder="Ex: 5517289"
          style={{ ...IS, marginTop:6 }}/>
        <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
          Para ativar: salve o número +34 644 52 74 88 na agenda e envie a mensagem<br/>
          <strong>I allow callmebot to send me messages</strong><br/>
          A API key chegará em resposta no WhatsApp.
        </p>
      </div>
      <button onClick={handleSaveWhatsapp}
        style={{ ...BS, background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700 }}>
        {savedWa?'✅ Salvo!':'💾 Salvar'}
      </button>
    </div>
  </div>
)}

      {/* Footer */}
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>Fluxo de Aprovação Gerencial</span>
      </div>
    </div>
  )
}
