import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useNotifications } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ClientInput, FrotaInput, MunicipioInput, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, IS, LS, BS } from '../lib/constants'
import { fmt, todayStr, getSubtypeLabel } from '../lib/utils'

const STATUS_CONFIG = {
  pendente: { label:'⏳ Aguardando análise', color:T.amarelo, bg:T.amareloLight },
  aceito:   { label:'✅ Aceito',             color:T.verde,   bg:T.verdeLight   },
  recusado: { label:'❌ Recusado',           color:T.perigo,  bg:T.perigoLight  },
}

function SubtypeSelect({ type, value, onChange }) {
  const options = CARD_SUBTYPES[type] || []
  if (!options.length) return null
  return (
    <div style={{ marginBottom:14 }}>
      <label style={LS}>Motivo / Subtipo</label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:6 }}>
        {options.map(opt => (
          <div key={opt.value} onClick={()=>onChange(opt.value)}
            style={{ border:`2px solid ${value===opt.value?T.laranja:T.border}`, borderRadius:T.rSm, padding:'7px 9px', cursor:'pointer',
              background:value===opt.value?T.laranjaLight:T.surface, transition:'all .12s', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:13 }}>{opt.label.split(' ')[0]}</span>
            <span style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:value===opt.value?800:500 }}>{opt.label.replace(/^[^\s]+\s/,'')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RequestForm({ simClients, onSubmit, onClose, profile }) {
  const [form, setForm] = useState({
    type:'freteCliente', subtype:'', machine:'', nInterno:'',
    originCity:null, destCity:null,
    desiredDate:todayStr(), urgency:'medio', description:'',
    clientName:'', channel:'teams',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const handleSubmit = async () => {
    setSaving(true)
    await onSubmit({
      ...form,
      requesterName: profile?.name || '',
      unit:          profile?.unit || '',
      origin:        form.originCity?.s || '',
      destination:   form.destCity?.s   || '',
      originCityName:form.originCity?.m  || '',
      destCityName:  form.destCity?.m    || '',
    })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:580, maxHeight:'93vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:900, fontSize:20, margin:0 }}>➕ Solicitar Serviço</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              Solicitando como: <strong style={{ color:T.verde }}>{profile?.name}</strong> · {profile?.unit}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={LS}>Tipo de Serviço</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {Object.entries(CARD_TYPES).map(([k,v]) => (
              <div key={k} onClick={()=>{ set('type',k); set('subtype','') }}
                style={{ border:`2px solid ${form.type===k?v.color:T.border}`, borderRadius:T.r, padding:'10px 8px', cursor:'pointer', textAlign:'center',
                  background:form.type===k?v.bg:T.surfaceAlt, transition:'all .12s' }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{v.icon}</div>
                <div style={{ color:v.color, fontWeight:800, fontSize:10, fontFamily:FONT }}>{v.short}</div>
              </div>
            ))}
          </div>
        </div>

        <SubtypeSelect type={form.type} value={form.subtype} onChange={v=>set('subtype',v)}/>

        <div style={{ marginBottom:14, padding:'11px 13px', background:T.laranjaXLight, borderRadius:T.r, border:`1px solid ${T.laranja}20` }}>
          <label style={LS}>🔍 Planta / Obra (base SIM)</label>
          <ClientInput
            value={form.clientName ? {name:form.clientName} : null}
            onChange={c=>{ set('clientName',c?.name||''); if(c?.state){ set('destCity',{m:c.city||'',s:c.state}) } if(c?.nInternos?.length){ set('nInterno',c.nInternos[0]) } }}
            simClients={simClients||[]}
          />
          {form.clientName && <div style={{ marginTop:4, color:T.verde, fontSize:11, fontFamily:FONT, fontWeight:700 }}>✓ {form.clientName}</div>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={LS}>N° Interno (Frota)</label>
            <FrotaInput value={form.nInterno} onChange={v=>set('nInterno',v)} simClients={simClients||[]}/>
          </div>
          <div>
            <label style={LS}>Urgência</label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Cidade de Origem</label>
            <MunicipioInput value={form.originCity} onChange={v=>set('originCity',v)} placeholder="Cidade de origem..."/>
          </div>
          <div>
            <label style={LS}>Cidade de Destino</label>
            <MunicipioInput value={form.destCity} onChange={v=>set('destCity',v)} placeholder="Cidade de destino..."/>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Equipamento</label>
            <input value={form.machine} onChange={e=>set('machine',e.target.value)} style={IS} placeholder="Ex: Munck 50T, PA150..."/>
          </div>
          <div>
            <label style={LS}>Data desejada</label>
            <input type="date" value={form.desiredDate} onChange={e=>set('desiredDate',e.target.value)} style={IS}/>
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
            <label style={LS}>Descrição / Detalhes</label>
            <textarea value={form.description} onChange={e=>set('description',e.target.value)}
              style={{ ...IS, height:70, resize:'vertical' }}
              placeholder="Descreva a operação, prazos, contato no local..."/>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:900, fontSize:13 }}>
            {saving ? '⏳ Enviando...' : '📤 Enviar Solicitação'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function SolicitanteView({ simClients }) {
  const { profile, logout }         = useAuth()
  const { requests, submitRequest } = useRequests('solicitante')
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { toasts, add:addToast, dismiss } = useToasts()
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = async form => {
    await submitRequest(form)
    addToast('Solicitação enviada! O time de Frotas foi notificado.', 'success')
  }

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:FONT, fontWeight:900, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase' }}>Portal do Solicitante</div>
            <div style={{ color:T.textMuted, fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>{profile?.unit||'mills'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}/>
          <button onClick={logout} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 12px' }}>
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          style={{ background:`linear-gradient(135deg, ${T.verde}, #006466)`, borderRadius:T.rLg, padding:'24px 28px', marginBottom:22, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:T.shadowMd, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ color:'rgba(255,255,255,.65)', fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>mills · Gestão de Frotas</div>
            <h2 style={{ color:'white', fontFamily:FONT, fontWeight:900, fontSize:22, margin:'0 0 5px' }}>Precisa de frete ou guindauto?</h2>
            <p style={{ color:'rgba(255,255,255,.7)', fontFamily:FONT, fontSize:12, margin:0 }}>Solicite agora. O time de Frotas recebe em tempo real.</p>
          </div>
          <button onClick={()=>setShowForm(true)}
            style={{ ...BS, background:T.laranja, color:'white', fontWeight:900, fontSize:14, padding:'13px 22px', borderRadius:T.rLg, boxShadow:'0 4px 16px rgba(243,112,33,.4)', whiteSpace:'nowrap', position:'relative', zIndex:1 }}>
            + Nova Solicitação
          </button>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:22 }}>
          {[
            { label:'Total',     value:requests.length,                                  color:T.laranja, bg:T.laranjaLight },
            { label:'Pendentes', value:requests.filter(r=>r.status==='pendente').length, color:T.amarelo, bg:T.amareloLight },
            { label:'Aceitas',   value:requests.filter(r=>r.status==='aceito').length,   color:T.verde,   bg:T.verdeLight   },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}30`, borderRadius:T.rLg, padding:'14px 16px' }}>
              <div style={{ color:s.color, fontFamily:FONT, fontWeight:900, fontSize:26, lineHeight:1 }}>{s.value}</div>
              <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:900, fontSize:16, margin:'0 0 12px' }}>Minhas Solicitações</h3>
        {requests.length===0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
            <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
            <p>Nenhuma solicitação ainda.</p>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {requests.map(r => {
            const sc=STATUS_CONFIG[r.status]||STATUS_CONFIG.pendente
            const ct=CARD_TYPES[r.type], ug=URGENCY[r.urgency]
            return (
              <motion.div key={r.id} layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                style={{ background:T.surface, border:`1.5px solid ${sc.color}25`, borderRadius:T.rLg, padding:'16px 18px', boxShadow:T.shadow }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:9 }}>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                    {r.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(r.type, r.subtype)}</span>}
                    <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 9px', color:ug?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
                  </div>
                  <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:11, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[
                    ['Equipamento', r.machine||'—'],
                    ['Rota', `${r.originCityName||r.origin||'—'} → ${r.destCityName||r.destination||'—'}`],
                    ['Data desejada', fmt(r.desiredDate)],
                  ].map(([l,v]) => (
                    <div key={l}>
                      <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                      <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{v}</div>
                    </div>
                  ))}
                </div>
                {r.responseNote && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:r.status==='aceito'?T.verdeLight:T.perigoLight, borderRadius:T.rSm, color:r.status==='aceito'?T.verde:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>
                    {r.status==='aceito'?'✅':'❌'} {r.responseNote}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {showForm && <RequestForm simClients={simClients||[]} profile={profile} onSubmit={handleSubmit} onClose={()=>setShowForm(false)}/>}
    </div>
  )
}
