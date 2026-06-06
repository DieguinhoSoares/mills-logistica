import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useNotifications } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ClientInput, ToastContainer, useToasts } from '../components/UI'
import { T, BS, IS, LS, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES } from '../lib/constants'
import { fmt, todayStr, getSubtypeLabel } from '../lib/utils'

const STATUS_CONFIG = {
  pendente: { label:'⏳ Aguardando análise', color:T.amarelo,  bg:T.amareloLight },
  aceito:   { label:'✅ Aceito',              color:T.verde,    bg:T.verdeLight   },
  recusado: { label:'❌ Recusado',            color:T.perigo,   bg:T.perigoLight  },
}

/* ── Subtype selector inline ── */
function SubtypeSelect({ type, value, onChange }) {
  const options = CARD_SUBTYPES[type] || []
  if (!options.length) return null
  return (
    <div style={{ marginBottom:14 }}>
      <label style={LS}>Motivo / Subtipo</label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:6 }}>
        {options.map(opt => (
          <div key={opt.value} onClick={() => onChange(opt.value)}
            style={{ border:`2px solid ${value===opt.value ? T.laranja : T.border}`, borderRadius:T.rSm,
              padding:'7px 10px', cursor:'pointer', background: value===opt.value ? T.laranjaLight : T.surfaceAlt,
              transition:'all .12s', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:13 }}>{opt.label.split(' ')[0]}</span>
            <span style={{ color:T.text, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11, fontWeight:value===opt.value?700:500 }}>
              {opt.label.replace(/^[^\s]+\s/, '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RequestForm({ simClients, onSubmit, onClose }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    type:'freteCliente', subtype:'', machine:'', origin:'SP', destination:'SP',
    desiredDate: todayStr(), urgency:'medio', description:'', clientName:'',
    channel:'teams',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const handleTypeChange = v => setForm(p => ({ ...p, type: v, subtype: '' }))

  const handleSubmit = async () => {
    if (!form.type || !form.desiredDate) return
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:600, maxHeight:'93vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:22, margin:0 }}>➕ Solicitar Serviço de Logística</h2>
            <p style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, margin:'4px 0 0' }}>O time de Frotas será notificado imediatamente</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:'10px 14px', background:T.infoLight, borderRadius:T.rSm, border:`1px solid ${T.info}30`, marginBottom:18 }}>
          <p style={{ color:T.info, fontSize:12, fontFamily:'IBM Plex Sans,sans-serif', margin:0 }}>
            📌 Solicitando como: <strong>{profile?.name}</strong> · {profile?.unit || 'Sem unidade'}
          </p>
        </div>

        {/* Tipo */}
        <div style={{ marginBottom:16 }}>
          <label style={LS}>Tipo de Serviço</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {Object.entries(CARD_TYPES).map(([k,v]) => (
              <div key={k} onClick={() => handleTypeChange(k)}
                style={{ border:`2px solid ${form.type===k ? v.color : T.border}`, borderRadius:T.r,
                  padding:'10px 12px', cursor:'pointer', textAlign:'center',
                  background: form.type===k ? v.bg : T.surfaceAlt, transition:'all .12s' }}>
                <div style={{ fontSize:20, marginBottom:2 }}>{v.icon}</div>
                <div style={{ color:v.color, fontWeight:700, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif' }}>{v.short}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subtipo */}
        <SubtypeSelect type={form.type} value={form.subtype} onChange={v => set('subtype', v)}/>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>🔍 Planta/Obra (base SIM)</label>
            <ClientInput value={form.clientName?{name:form.clientName}:null}
              onChange={c => { set('clientName', c?.name||''); if(c) set('destination', c.state||form.destination) }}
              simClients={simClients}/>
          </div>

          <div>
            <label style={LS}>Urgência</label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>

          <div>
            <label style={LS}>Canal de resposta</label>
            <select value={form.channel} onChange={e=>set('channel',e.target.value)} style={IS}>
              <option value="teams">🟦 Microsoft Teams</option>
              <option value="email">📧 E-mail</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Equipamento necessário</label>
            <input value={form.machine} onChange={e=>set('machine',e.target.value)}
              placeholder="Ex: Munck 50T, Retroescavadeira, PA150..." style={IS}/>
          </div>

          <div>
            <label style={LS}>Estado de Origem</label>
            <select value={form.origin} onChange={e=>set('origin',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={LS}>Estado de Destino</label>
            <select value={form.destination} onChange={e=>set('destination',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={LS}>Data desejada</label>
            <input type="date" value={form.desiredDate} onChange={e=>set('desiredDate',e.target.value)} style={IS}/>
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Descrição / Detalhes da operação</label>
            <textarea value={form.description} onChange={e=>set('description',e.target.value)}
              placeholder="Descreva a operação, prazos, restrições de acesso, contato no local..."
              style={{ ...IS, height:80, resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:700, fontSize:13 }}>
            {saving ? '⏳ Enviando...' : '📤 Enviar Solicitação'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function SolicitanteView({ simClients }) {
  const { profile, logout }          = useAuth()
  const { requests, submitRequest }  = useRequests('solicitante')
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { toasts, add: addToast, dismiss } = useToasts()
  const [showForm, setShowForm]      = useState(false)

  const handleSubmit = async form => {
    await submitRequest(form)
    addToast('Solicitação enviada! O time de Frotas foi notificado.', 'success')
  }

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:'IBM Plex Sans,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      {/* HEADER */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:58, boxShadow:`0 1px 0 ${T.border},0 2px 8px rgba(26,22,18,.04)` }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:24, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:13, letterSpacing:'0.04em' }}>PORTAL DO SOLICITANTE</div>
            <div style={{ color:T.textMuted, fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>{profile?.unit || 'mills infraestrutura'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}/>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:T.laranja, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:700 }}>
              {(profile?.name||'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color:T.text, fontSize:11, fontWeight:600, fontFamily:'IBM Plex Sans,sans-serif' }}>{profile?.name}</div>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif' }}>{profile?.unit}</div>
            </div>
          </div>
          <button onClick={logout} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>
        {/* Hero CTA */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }}
          style={{ background:`linear-gradient(135deg, ${T.verde} 0%, #006466 100%)`, borderRadius:T.rLg, padding:'32px 36px', marginBottom:32, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:T.shadowMd, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:-40, top:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
          <div style={{ position:'absolute', right:60, bottom:-60, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.04)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>mills · Gestão de Frotas</div>
            <h2 style={{ color:'white', fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:28, margin:'0 0 8px', letterSpacing:'0.02em' }}>Precisa de frete ou içamento?</h2>
            <p style={{ color:'rgba(255,255,255,.75)', fontFamily:'IBM Plex Sans,sans-serif', fontSize:13, margin:0 }}>Solicite agora. O time de Frotas recebe a demanda em tempo real.</p>
          </div>
          <button onClick={() => setShowForm(true)}
            style={{ ...BS, background:T.laranja, color:'white', fontWeight:800, fontSize:15, padding:'14px 28px', borderRadius:T.rLg, boxShadow:'0 4px 16px rgba(243,112,33,.4)', whiteSpace:'nowrap', position:'relative', zIndex:1 }}>
            + Nova Solicitação
          </button>
        </motion.div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:28 }}>
          {[
            { label:'Total',     value: requests.length,                                color:T.laranja, bg:T.laranjaLight },
            { label:'Pendentes', value: requests.filter(r=>r.status==='pendente').length, color:T.amarelo, bg:T.amareloLight },
            { label:'Aceitas',   value: requests.filter(r=>r.status==='aceito').length,   color:T.verde,   bg:T.verdeLight   },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:.2 }}
              style={{ background:s.bg, border:`1px solid ${s.color}30`, borderRadius:T.rLg, padding:'16px 20px', boxShadow:T.shadow }}>
              <div style={{ color:s.color, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:800, fontSize:32, lineHeight:1 }}>{s.value}</div>
              <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:3 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Requests list */}
        <div>
          <h3 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:18, margin:'0 0 16px', letterSpacing:'0.02em' }}>Minhas Solicitações</h3>
          {requests.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
              <p style={{ fontSize:14 }}>Você ainda não fez nenhuma solicitação.</p>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {requests.map(r => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente
              const ct = CARD_TYPES[r.type]
              const ug = URGENCY[r.urgency]
              return (
                <motion.div key={r.id} layout initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                  style={{ background:T.surface, border:`1.5px solid ${r.status==='pendente'?T.amarelo:r.status==='aceito'?T.verde:T.perigo}25`,
                    borderRadius:T.rLg, padding:'18px 20px', boxShadow:T.shadow, transition:'all .12s' }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow=T.shadowMd}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=T.shadow}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{ct?.icon} {ct?.short}</span>
                      {r.subtype && <span style={{ background:T.infoLight, border:`1px solid ${T.info}30`, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{getSubtypeLabel(r.type, r.subtype)}</span>}
                      <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{ug?.icon} {ug?.label}</span>
                    </div>
                    <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'4px 12px', color:sc.color, fontSize:11, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', whiteSpace:'nowrap' }}>{sc.label}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2 }}>Equipamento</div>
                      <div style={{ color:T.text, fontWeight:600, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>{r.machine || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2 }}>Rota</div>
                      <div style={{ color:T.text, fontWeight:600, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>{r.origin}→{r.destination}</div>
                    </div>
                    <div>
                      <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2 }}>Data desejada</div>
                      <div style={{ color:T.text, fontWeight:600, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>{fmt(r.desiredDate)}</div>
                    </div>
                  </div>
                  {r.responseNote && (
                    <div style={{ marginTop:12, padding:'10px 14px', background:r.status==='aceito'?T.verdeLight:T.perigoLight, borderRadius:T.rSm, border:`1px solid ${r.status==='aceito'?T.verde:T.perigo}30` }}>
                      <div style={{ color:r.status==='aceito'?T.verde:T.perigo, fontWeight:700, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:3 }}>
                        {r.status==='aceito'?'✅ Resposta do time de Frotas:':'❌ Motivo:'}
                      </div>
                      <div style={{ color:T.text, fontSize:12, fontFamily:'IBM Plex Sans,sans-serif' }}>{r.responseNote}</div>
                    </div>
                  )}
                  {r.createdAt?.toDate && (
                    <div style={{ marginTop:10, color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif' }}>
                      Enviado em {r.createdAt.toDate().toLocaleString('pt-BR')}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {showForm && <RequestForm simClients={simClients} onSubmit={handleSubmit} onClose={() => setShowForm(false)}/>}
    </div>
  )
}
