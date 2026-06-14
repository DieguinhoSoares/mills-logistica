import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }        from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, useDrivers, useMessages, useAllRotogramas, ensureDriverToken } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, ServiceCard, BrazilMap, MoveModal, NotificationBell, ClientInput, MunicipioInput } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import Papa from 'papaparse'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { FreteEstimativa } from '../components/FreteEstimativa'
import { RequestForm }     from '../components/RequestForm'

/* ══ SUBTYPE SELECT ══════════════════════════════════════════════════════════ */
// ── MessageThread ─────────────────────────────────────────────────────────────
function MessageThread({ requestId, profile, onClose }) {
  const { messages, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await sendMessage({ requestId, text:text.trim(), authorId:profile?.uid||'', authorName:profile?.name||'Frotas', authorRole:profile?.role||'frotas', type:'message' })
    setText(''); setSending(false)
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ background:T.verde, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:14 }}>💬 Histórico da Solicitação</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {messages.length===0 && <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, padding:'20px 0' }}>Nenhuma mensagem ainda.</div>}
          {messages.map(m => {
            const isMe=m.authorRole==='frotas'||m.authorRole==='master'
            if (m.type==='status_change') return (
              <div key={m.id} style={{ textAlign:'center' }}>
                <span style={{ background:T.surfaceLow, color:T.textMuted, borderRadius:20, padding:'3px 12px', fontSize:10, fontFamily:FONT }}>{m.text}</span>
              </div>
            )
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start' }}>
                <div style={{ maxWidth:'75%', background:isMe?T.verde:T.surfaceAlt, borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px', padding:'9px 13px', boxShadow:T.shadow }}>
                  <div style={{ color:isMe?'rgba(255,255,255,0.7)':T.textMuted, fontSize:9, fontFamily:FONT, fontWeight:700, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.authorName}</div>
                  <div style={{ color:isMe?'white':T.text, fontSize:12, fontFamily:FONT, lineHeight:1.5 }}>{m.text}</div>
                </div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginTop:2 }}>{m.createdAt?.toDate?.()?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})||''}</div>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8 }}>
          <input value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}}
            placeholder="Digite uma mensagem..." style={{ ...IS, flex:1, margin:0 }}/>
          <button onClick={handleSend} disabled={sending||!text.trim()}
            style={{ ...BS, background:text.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, flexShrink:0 }}>
            {sending?'⏳':'Enviar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── RotogramaModal ────────────────────────────────────────────────────────────
function RotogramaModal({ driver, cards, profile, rotogramaAtivo, onClose, addToast }) {
  const [paradas,setParadas]=useState(rotogramaAtivo?.paradas||[])
  const [saving,setSaving]=useState(false)
  const [linkGerado,setLinkGerado]=useState(null)
  const cardsDisponiveis=cards.filter(c=>c.driverId===driver.id&&['confirmado','em_execucao'].includes(c.status)).sort((a,b)=>a.startDate?.localeCompare(b.startDate))
  const addParada=card=>{if(paradas.find(p=>p.cardId===card.id))return;setParadas(prev=>[...prev,{cardId:card.id,cliente:card.client,destino:card.destCity||card.destination||'',destinoUF:card.destination||'',origem:card.originCity||card.origin||'',origemUF:card.origin||'',startDate:card.startDate}])}
  const removeParada=cardId=>setParadas(prev=>prev.filter(p=>p.cardId!==cardId))
  const moverParada=(i,dir)=>{const n=[...paradas];const t=i+dir;if(t<0||t>=n.length)return;[n[i],n[t]]=[n[t],n[i]];setParadas(n)}
  const gerarUrl=()=>{if(!paradas.length)return null;return `https://www.google.com/maps/dir/${paradas.map(p=>encodeURIComponent(`${p.destino} ${p.destinoUF}`)).join('/')}`}
  const handleSalvar=async()=>{
    if(!paradas.length)return
    setSaving(true)
    const url=gerarUrl()
    const data={driverId:driver.id,driverName:driver.name,paradas,urlRota:url,status:'ativo',criadoPor:profile?.name||'Frotas',updatedAt:serverTimestamp()}
    if(rotogramaAtivo?.id)await updateDoc(doc(db,'rotogramas',rotogramaAtivo.id),data)
    else{data.criadoEm=serverTimestamp();await addDoc(collection(db,'rotogramas'),data)}
    setLinkGerado(url);setSaving(false)
    addToast(`Rotograma de ${driver.name} salvo!`,'success')
  }
  const handleCopiarLink=async()=>{
    const token=await ensureDriverToken(driver.id)
    const link=`https://dieguinhosoares.github.io/mills-logistica/?motorista=${token}`
    navigator.clipboard.writeText(link)
    addToast('Link do motorista copiado!','success')
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, width:660, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ background:T.verde, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:16 }}>🗺 Rotograma — {driver.name}</div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontFamily:FONT, fontSize:11 }}>{driver.unit||''} · {paradas.length} parada(s)</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', flex:1, overflow:'hidden' }}>
          <div style={{ borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.07em' }}>Serviços disponíveis</div>
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'8px' }}>
              {cardsDisponiveis.length===0&&<div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:11, padding:'20px 0' }}>Nenhum serviço confirmado.</div>}
              {cardsDisponiveis.map(c=>{
                const ct=CARD_TYPES[c.type];const ja=paradas.some(p=>p.cardId===c.id)
                return (<div key={c.id} onClick={()=>!ja&&addParada(c)} style={{ padding:'9px 11px', borderRadius:T.r, marginBottom:6, border:`1px solid ${ja?T.verde:T.border}`, background:ja?T.verdeLight:T.surfaceAlt, cursor:ja?'default':'pointer', opacity:ja?0.6:1 }}>
                  <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{c.client}</div>
                  <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>{c.originCity||c.origin||'—'} → {c.destCity||c.destination||'—'}</div>
                  {ja&&<div style={{ color:T.verde, fontSize:9, fontFamily:FONT, fontWeight:700 }}>✓ Na rota</div>}
                </div>)
              })}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.07em' }}>Sequência da rota</div>
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'8px' }}>
              {paradas.length===0&&<div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:11, padding:'20px 0' }}>Adicione paradas da lista.</div>}
              {paradas.map((p,i)=>(
                <div key={p.cardId} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:T.laranja, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontWeight:700, fontSize:11, flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1, padding:'7px 9px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
                    <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{p.cliente}</div>
                    <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>{p.destino}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <button onClick={()=>moverParada(i,-1)} disabled={i===0} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, width:20, height:20, cursor:'pointer', fontSize:11, opacity:i===0?0.3:1 }}>↑</button>
                    <button onClick={()=>moverParada(i,1)} disabled={i===paradas.length-1} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, width:20, height:20, cursor:'pointer', fontSize:11, opacity:i===paradas.length-1?0.3:1 }}>↓</button>
                  </div>
                  <button onClick={()=>removeParada(p.cardId)} style={{ background:T.perigoLight, border:`1px solid ${T.perigo}30`, borderRadius:3, width:20, height:20, cursor:'pointer', color:T.perigo, fontSize:13 }}>×</button>
                </div>
              ))}
            </div>
            {linkGerado&&(<div style={{ padding:'8px 12px', background:T.verdeLight, borderTop:`1px solid ${T.verde}30`, flexShrink:0 }}>
              <div style={{ color:T.verde, fontFamily:FONT, fontSize:11, fontWeight:700, marginBottom:3 }}>✅ Rotograma salvo!</div>
              <a href={linkGerado} target="_blank" rel="noreferrer" style={{ color:T.info, fontFamily:FONT, fontSize:10 }}>Abrir rota no Maps →</a>
            </div>)}
          </div>
        </div>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8, justifyContent:'space-between', flexShrink:0 }}>
          <button onClick={handleCopiarLink} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:11, fontWeight:700 }}>📱 Copiar link do motorista</button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
            <button onClick={handleSalvar} disabled={saving||!paradas.length} style={{ ...BS, background:paradas.length?T.laranja:T.borderMid, color:'white', fontWeight:700 }}>{saving?'⏳ Salvando...':'💾 Salvar Rotograma'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function SubtypeSelect({ type, value, onChange }) {
  const options = CARD_SUBTYPES[type] || []
  if (!options.length) return null
  return (
    <div style={{ gridColumn:'1/-1' }}>
      <label style={LS}>Subtipo / Motivo</label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:6 }}>
        {options.map(opt => (
          <div key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              border:`2px solid ${value===opt.value ? T.laranja : T.border}`,
              borderRadius:T.rSm, padding:'8px 10px', cursor:'pointer',
              background: value===opt.value ? T.laranjaLight : T.surfaceAlt,
              transition:'all .12s',
              display:'flex', alignItems:'center', gap:6,
            }}>
            <span style={{ fontSize:14 }}>{opt.label.split(' ')[0]}</span>
            <span style={{ color:T.text, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11, fontWeight:value===opt.value?700:500, flex:1 }}>
              {opt.label.replace(/^[^\s]+\s/, '')}
            </span>
            {value===opt.value && <span style={{ color:T.laranja, fontSize:12 }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ CARD MODAL ══════════════════════════════════════════════════════════════ */
function CardModal({ card, defaultDate, simClients, onSave, onClose, onDelete }) {
  const blank = {
    type:'freteMillsInterno', subtype:'', client:'', clientState:'', clientCity:'',
    urgency:'medio', machine:'', om:'', nInterno:'', plantaObra:'',
    status:'em_dia', origin:'SP', destination:'SP',
    startDate:defaultDate||todayStr(), endDate:defaultDate||todayStr(),
    notes:'', driver:'', unit:''
  }
  const [form, setForm] = useState(card || blank)
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  // Ao trocar tipo, limpa subtype para forçar nova seleção
  const handleTypeChange = v => setForm(p => ({ ...p, type: v, subtype: '' }))

  const handleClientSelect = c => {
    if (!c) return
    setForm(p => ({
      ...p,
      client:      c.name,
      plantaObra:  c.name,
      clientState: c.state,
      clientCity:  c.city,
      destination: c.state || p.destination,
      machine:     c.families?.[0] || p.machine,
      nInterno:    c.nInternos?.[0] || p.nInterno,
    }))
  }

  const handleSave = async () => {
    setSaving(true); await onSave(form); setSaving(false)
  }

  const subtypes = CARD_SUBTYPES[form.type] || []

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:640, maxHeight:'94vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>
            {card ? '✏️ Editar Serviço' : '➕ Novo Serviço'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {/* Tipo de Serviço — destacado no topo */}
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
        {subtypes.length > 0 && (
          <div style={{ marginBottom:16, padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
            <SubtypeSelect type={form.type} value={form.subtype} onChange={v => set('subtype', v)}/>
          </div>
        )}

        {/* Busca de cliente SIM */}
        <div style={{ marginBottom:14, padding:'12px 14px', background:T.laranjaLight, borderRadius:T.r, border:`1px solid ${T.laranja}30` }}>
          <label style={LS}>🔍 Buscar Planta/Obra (base SIM)</label>
          <ClientInput value={form.client?{name:form.client}:null} onChange={handleClientSelect} simClients={simClients}/>
          {form.clientCity && <div style={{ marginTop:5, color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif' }}>📍 {form.clientCity} – {form.clientState}</div>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Planta / Obra</label>
            <input value={form.plantaObra||''} onChange={e=>set('plantaObra',e.target.value)} placeholder="Nome da planta ou obra" style={IS}/>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Cliente (Empresa)</label>
            <input value={form.client||''} onChange={e=>set('client',e.target.value)} style={IS}/>
          </div>
          <div>
            <label style={LS}>N° Interno (Frota)</label>
            <input value={form.nInterno||''} onChange={e=>set('nInterno',e.target.value)} placeholder="Ex: 1234" style={IS}/>
          </div>
          <div>
            <label style={LS}>OM</label>
            <input value={form.om||''} onChange={e=>set('om',e.target.value)} style={IS}/>
          </div>
          <div>
            <label style={LS}>Motorista</label>
            <input value={form.driver||''} onChange={e=>set('driver',e.target.value)} style={IS}/>
          </div>
          <div>
            <label style={LS}>Unidade Mills</label>
            <select value={form.unit||''} onChange={e=>set('unit',e.target.value)} style={IS}>
              <option value="">— selecione —</option>
              {FILIAIS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Urgência</label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Máquina / Equipamento</label>
            <input value={form.machine||''} onChange={e=>set('machine',e.target.value)} placeholder="Ex: Munck 50T, PA150..." style={IS}/>
          </div>
          <div>
            <label style={LS}>Origem</label>
            <select value={form.origin} onChange={e=>set('origin',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Destino</label>
            <select value={form.destination} onChange={e=>set('destination',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Data Início</label>
            <input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} style={IS}/>
          </div>
          <div>
            <label style={LS}>Data Conclusão</label>
            <input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} style={IS}/>
          </div>
          <div>
            <label style={LS}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={IS}>
              <option value="em_dia">✅ Em dia</option>
              <option value="atrasado">🔴 Atrasado</option>
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Observações</label>
            <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...IS, height:60, resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:18 }}>
          {card
            ? <button onClick={()=>onDelete(card.id)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40` }}>🗑 Excluir</button>
            : <div/>
          }
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:700 }}>
              {saving ? '💾 Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ══ REQUEST REVIEW MODAL ════════════════════════════════════════════════════ */
function RequestReviewModal({ req, teamsWebhookUrl, onRespond, onClose, profile, simClients }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type], ug = URGENCY[req.urgency]
  const chIcon  = { email:'📧', whatsapp:'💬', teams:'🟦' }
  const chLabel = { email:'E-mail corporativo', whatsapp:'WhatsApp', teams:'Microsoft Teams' }

  const handle = async status => {
    setSaving(true)
    await onRespond(req.id, status, note, teamsWebhookUrl)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:540, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>📋 Avaliar Solicitação</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:16 }}>
          <div style={{ display:'flex', gap:10, marginBottom:8 }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{ct?.icon} {ct?.short}</span>
            <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{ug?.icon} {ug?.label}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{getSubtypeLabel(req.type, req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Solicitante',   req.requesterName || '—'],
              ['Unidade',       req.unit          || '—'],
              ['Equipamento',   req.machine       || '—'],
              ['Data desejada', fmt(req.desiredDate)    ],
              ['Rota',          `${req.origin} → ${req.destination}`],
              ['Planta/Obra',   req.clientName    || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2 }}>{label}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:'IBM Plex Sans,sans-serif' }}>{value}</div>
              </div>
            ))}
          </div>
          {req.description && (
            <div style={{ marginTop:10, padding:'8px 10px', background:T.surface, borderRadius:T.rSm }}>
              <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'IBM Plex Sans,sans-serif', marginBottom:3 }}>Descrição</div>
              <div style={{ color:T.text, fontSize:12, fontFamily:'IBM Plex Sans,sans-serif' }}>{req.description}</div>
            </div>
          )}
        </div>

        {/* Estimativa de frete */}
        {(req.type==='freteMillsInterno'||req.type==='freteCliente'||req.type==='guindauto') && (
          <FreteEstimativa request={req} simClients={simClients||[]} readOnly={true} isFrotas={true}/>
        )}

        <div>
          <label style={LS}>Resposta / observações para o solicitante</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Mensagem que será enviada ao solicitante..."
            style={{ ...IS, height:80, resize:'vertical', width:'100%', marginBottom:12 }}/>
          <div style={{ padding:'10px 13px', background:T.laranjaLight, borderRadius:T.rSm, border:`1px solid ${T.laranja}30`, marginBottom:16 }}>
            <div style={{ color:T.laranja, fontSize:11, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>
              {chIcon[req.channel]||'📬'} Resposta via {chLabel[req.channel]||req.channel}
            </div>
            {req.channel === 'teams' && teamsWebhookUrl && <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Webhook configurado ✓ — mensagem será postada no canal</div>}
            {req.channel === 'teams' && !teamsWebhookUrl && <div style={{ color:T.perigo, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>⚠ Webhook não configurado. Configure em Configurações.</div>}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={()=>handle('recusado')} disabled={saving} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40`, fontWeight:700 }}>❌ Recusar</button>
          <button onClick={()=>handle('aceito')}   disabled={saving} style={{ ...BS, background:T.verde, color:'white', fontWeight:700 }}>{saving?'⏳...':'✅ Aceitar'}</button>
        </div>
      </motion.div>
    </div>
  )
}

/* ══ EXPORT MODAL ════════════════════════════════════════════════════════════ */
function ExportModal({ cards, weekDays, conflicts, onClose }) {
  const drivers = ['Todos os motoristas', ...Array.from(new Set(cards.map(c=>c.driver||'Sem motorista'))).sort()]
  const [done, setDone] = useState([])
  const weekCards = cards.filter(c => c.startDate && new Date(c.startDate) >= new Date(weekDays[0]) && new Date(c.startDate) <= new Date(weekDays[6]))
  const countFor = d => d==='Todos os motoristas' ? weekCards.length : weekCards.filter(c=>(c.driver||'Sem motorista')===d).length

  const handleExport = d => {
    const filter = d==='Todos os motoristas' ? null : d
    const fname  = filter ? `mills_${filter.toLowerCase().replace(/\s+/g,'_')}_semana_${weekDays[0]}.txt` : `mills_todos_semana_${weekDays[0]}.txt`
    downloadTxt(buildReport(cards, weekDays, conflicts, filter), fname)
    setDone(p=>[...new Set([...p, d])])
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:480, maxHeight:'85vh', overflowY:'auto', boxShadow:T.shadowLg }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>📤 Exportar Relatório</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <p style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, margin:'0 0 18px' }}>
          {fmt(weekDays[0])} — {fmt(weekDays[6])} · {weekCards.length} serviço{weekCards.length!==1?'s':''}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {drivers.map(d => {
            const count = countFor(d), isDone = done.includes(d)
            return (
              <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:isDone?T.verdeLight:T.surfaceAlt, border:`1px solid ${isDone?T.verde+'50':T.border}`, borderRadius:T.r }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>{d==='Todos os motoristas'?'👥':'👤'}</span>
                  <div>
                    <div style={{ color:T.text, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:13 }}>{d}</div>
                    <div style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:10 }}>{count} serviço{count!==1?'s':''}</div>
                  </div>
                </div>
                <button onClick={()=>handleExport(d)} disabled={count===0}
                  style={{ ...BS, background:isDone?T.verde:count===0?'#E0E0E0':T.laranja, color:count===0?T.textMuted:'white', fontWeight:700, fontSize:11, minWidth:90, opacity:count===0?.5:1 }}>
                  {isDone?'✓ Baixado':'⬇ Baixar'}
                </button>
              </div>
            )
          })}
        </div>
        {drivers.length > 2 && (
          <button onClick={()=>drivers.filter(d=>d!=='Todos os motoristas').forEach(d=>handleExport(d))}
            style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:12, width:'100%', marginBottom:12 }}>
            ⬇ Baixar relatório individual de cada motorista
          </button>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
        </div>
      </motion.div>
    </div>
  )
}

/* ══ SETTINGS MODAL ══════════════════════════════════════════════════════════ */
function SettingsModal({ config, onSave, onClose }) {
  const [webhook, setWebhook] = useState(config?.teamsWebhookUrl || '')
  const [saved,   setSaved]   = useState(false)
  const handleSave = async () => { await onSave({ teamsWebhookUrl: webhook }); setSaved(true); setTimeout(()=>setSaved(false),2000) }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:500, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>⚙️ Configurações</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={LS}>🟦 Microsoft Teams — Incoming Webhook URL</label>
          <input value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder="https://outlook.office.com/webhook/..." style={IS}/>
          <p style={{ color:T.textMuted, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', margin:'8px 0 0', lineHeight:1.5 }}>
            Teams → Canal de Logística → ··· → Conectores → Incoming Webhook → Configurar → Copiar URL
          </p>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
          <button onClick={handleSave} style={{ ...BS, background:saved?T.verde:T.laranja, color:'white', fontWeight:700 }}>{saved?'✅ Salvo!':'💾 Salvar'}</button>
        </div>
      </motion.div>
    </div>
  )
}

/* ══ WEEK VIEW ════════════════════════════════════════════════════════════════ */
function WeekView({ cards, baseDate, conflicts, onEdit, onAddCard, onMoveCard }) {
  const days = getWeekDays(baseDate)
  const [dragCard, setDragCard] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [pending,  setPending]  = useState(null)
  const t = todayStr()
  return (
    <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason => { const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000; const ne=new Date(pending.card.endDate); ne.setDate(ne.getDate()+diff); onMoveCard(pending.card.id, pending.tgt, ne.toISOString().split('T')[0], reason); setPending(null) }}
        onCancel={() => setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:7, flex:1, minHeight:0 }}>
        {days.map((day, idx) => {
          const dc = cardsForDay(cards, day), isToday = day===t, isDO = dragOver===day
          return (
            <div key={day}
              onDragOver={e=>{e.preventDefault();setDragOver(day);}} onDragLeave={()=>setDragOver(null)}
              onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);setDragOver(null);}}
              style={{ background:isDO?'#FFF3E8':isToday?'#FFFAF5':T.surface, border:`1.5px solid ${isToday?T.laranja:isDO?T.laranja:T.border}`, borderRadius:T.r, padding:9, minHeight:110, display:'flex', flexDirection:'column', overflowY:'auto', boxShadow:isToday?`0 0 0 1px ${T.laranja}40,${T.shadow}`:T.shadow, transition:'all .1s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, flexShrink:0 }}>
                <div>
                  <div style={{ color:T.textMuted, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', textTransform:'uppercase', letterSpacing:'0.06em' }}>{WD_SHORT[idx]}</div>
                  <div style={{ color:isToday?T.laranja:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:22, lineHeight:1 }}>{day.split('-')[2]}</div>
                </div>
                <button onClick={()=>onAddCard(day)} style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:T.rSm, color:T.laranja, width:22, height:22, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
              </div>
              {dc.map(c => <ServiceCard key={c.id} card={c} conflicts={conflicts} onEdit={onEdit} onDragStart={(e,c2)=>{setDragCard(c2);e.dataTransfer.effectAllowed='move';}}/>)}
              {!dc.length && <div style={{ color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', textAlign:'center', marginTop:'auto', opacity:.4 }}>—</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══ MONTH VIEW ══════════════════════════════════════════════════════════════ */
function MonthView({ cards, year, month, conflicts, onEdit, onAddCard, onMoveCard }) {
  const weeks = getMonthWeeks(year, month)
  const [dragCard, setDragCard] = useState(null)
  const [pending,  setPending]  = useState(null)
  const t = todayStr()
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason=>{const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000;const ne=new Date(pending.card.endDate);ne.setDate(ne.getDate()+diff);onMoveCard(pending.card.id,pending.tgt,ne.toISOString().split('T')[0],reason);setPending(null);}}
        onCancel={()=>setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3, flexShrink:0 }}>
        {WD_SHORT.map(d => <div key={d} style={{ textAlign:'center', color:T.textMuted, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', padding:'3px 0', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>)}
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {weeks.map((wk,wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
            {wk.map((day,di) => {
              if (!day) return <div key={di} style={{ minHeight:70, background:T.bg, borderRadius:T.rSm }}/>
              const dc = cardsForDay(cards, day), isToday = day===t
              return (
                <div key={day} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);}} onClick={()=>!dc.length&&onAddCard(day)}
                  style={{ background:isToday?'#FFFAF5':T.surface, border:`1px solid ${isToday?T.laranja:T.border}`, borderRadius:T.rSm, padding:5, minHeight:70, cursor:dc.length?'default':'pointer', transition:'all .1s' }}>
                  <div style={{ color:isToday?T.laranja:T.textSec, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:13, marginBottom:3 }}>{day.split('-')[2]}</div>
                  {dc.slice(0,3).map(c => (
                    <div key={c.id} draggable onDragStart={e=>{setDragCard(c);e.dataTransfer.effectAllowed='move';}} onClick={e=>{e.stopPropagation();onEdit(c);}}
                      style={{ borderLeft:`3px solid ${CARD_TYPES[c.type]?.color}`, background:CARD_TYPES[c.type]?.bg, borderRadius:'0 4px 4px 0', padding:'2px 5px', marginBottom:2, cursor:'pointer' }}>
                      <div style={{ color:T.text, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }}>{CARD_TYPES[c.type]?.icon} {c.client}</div>
                    </div>
                  ))}
                  {dc.length > 3 && <div style={{ color:T.textMuted, fontSize:8, fontFamily:'IBM Plex Sans,sans-serif' }}>+{dc.length-3}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ YEAR VIEW ════════════════════════════════════════════════════════════════ */
function YearView({ cards, year, onMonthClick }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {MONTH_NAMES.map((name,mi) => {
        const mc = cards.filter(c=>c.startDate?.startsWith(`${year}-${String(mi+1).padStart(2,'0')}`))
        const tc = {}; mc.forEach(c=>{tc[c.type]=(tc[c.type]||0)+1})
        const late = mc.filter(c=>c.status==='atrasado').length
        return (
          <div key={name} onClick={()=>onMonthClick(mi)}
            style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, padding:13, cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.laranja;e.currentTarget.style.boxShadow=T.shadowMd;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow='none';}}>
            <div style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:15, marginBottom:8 }}>{name}</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
              {Object.entries(tc).map(([k,n]) => (
                <div key={k} style={{ background:CARD_TYPES[k]?.bg, border:`1px solid ${CARD_TYPES[k]?.color}40`, borderRadius:6, padding:'1px 7px', color:CARD_TYPES[k]?.color, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>{CARD_TYPES[k]?.icon} {n}</div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif' }}>{mc.length} serviço{mc.length!==1?'s':''}</span>
              {late>0 && <span style={{ background:T.perigoLight, borderRadius:5, padding:'1px 6px', color:T.perigo, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>⚠ {late}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══ REQUESTS KANBAN ══════════════════════════════════════════════════════════ */
// ── DriversModal ──────────────────────────────────────────────────────────────
function DriversModal({ drivers, onSave, onDelete, onClose, onRotograma, addToast }) {
  const blank={name:'',cnh:'',category:'',phone:'',unit:'',active:true}
  const [form,setForm]=useState(blank)
  const [editing,setEdit]=useState(null)
  const [saving,setSaving]=useState(false)
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  const handleSave=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    await onSave(editing?{...form,id:editing}:form)
    setForm(blank);setEdit(null);setSaving(false)
    addToast(editing?'Motorista atualizado!':'Motorista adicionado!','success')
  }
  const handleEdit=d=>{setEdit(d.id);setForm({name:d.name,cnh:d.cnh||'',category:d.category||'',phone:d.phone||'',unit:d.unit||'',active:d.active!==false})}
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:680, maxHeight:'88vh', display:'flex', gap:20, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 12px' }}>👤 Motoristas Cadastrados</h3>
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
            {drivers.length===0&&<div style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center', padding:'20px 0' }}>Nenhum motorista cadastrado.</div>}
            {drivers.map(d=>(
              <div key={d.id} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'10px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{d.name}</div>
                  <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{d.cnh&&`CNH: ${d.cnh} · `}{d.category&&`Cat. ${d.category} · `}{d.phone&&`📱 ${d.phone}`}</div>
                  <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{d.unit||'—'} {d.active===false?'· 🔴 Inativo':''}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {onRotograma&&<button onClick={()=>onRotograma(d)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 10px' }}>🗺 Rotograma</button>}
                  <button onClick={()=>handleEdit(d)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontSize:10, padding:'4px 10px' }}>✏️ Editar</button>
                  <button onClick={()=>onDelete(d.id)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}30`, fontSize:10, padding:'4px 10px' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width:240, flexShrink:0 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 12px' }}>{editing?'✏️ Editar':'➕ Novo'} Motorista</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div><label style={LS}>Nome completo *</label><input value={form.name} onChange={e=>set('name',e.target.value)} style={IS} placeholder="Nome do motorista"/></div>
            <div><label style={LS}>CNH</label><input value={form.cnh} onChange={e=>set('cnh',e.target.value)} style={IS} placeholder="00000000000"/></div>
            <div><label style={LS}>Categoria CNH</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)} style={IS}>
                <option value="">—</option>
                {['A','B','C','D','E','AB','AC','AD','AE'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={LS}>Telefone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} style={IS} placeholder="(11) 99999-9999"/></div>
            <div><label style={LS}>Filial</label>
              <select value={form.unit} onChange={e=>set('unit',e.target.value)} style={IS}>
                <option value="">— selecione —</option>
                {FILIAIS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {editing&&<button onClick={()=>{setEdit(null);setForm(blank)}} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Cancelar</button>}
              <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{ ...BS, flex:1, background:form.name.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, fontSize:11 }}>{saving?'⏳...':editing?'💾 Salvar':'➕ Adicionar'}</button>
            </div>
          </div>
          <div style={{ marginTop:16 }}><button onClick={onClose} style={{ ...BS, width:'100%', background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button></div>
        </div>
      </motion.div>
    </div>
  )
}

// ── AssignDriverModal ─────────────────────────────────────────────────────────
function AssignDriverModal({ req, drivers, simClients, onConfirm, onCancel }) {
  const [execType,setExecType]=useState('motorista')
  const [driverId,setDriverId]=useState('')
  const [transpNome,setTranspNome]=useState('')
  const [transpCnpj,setTranspCnpj]=useState('')
  const [date,setDate]=useState(req?.desiredDate||todayStr())
  const [note,setNote]=useState('')
  const selectedDriver=drivers.find(d=>d.id===driverId)
  const handleConfirm=()=>{
    if(execType==='transportadora'){onConfirm({driverId:'',driverName:'',transportadoraNome:transpNome,transportadoraCnpj:transpCnpj,date,note})}
    else{onConfirm({driverId,driverName:selectedDriver?.name||'',transportadoraNome:'',transportadoraCnpj:'',date,note})}
  }
  const canConfirm=execType==='transportadora'?transpNome.trim():driverId
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:540, maxHeight:'92vh', overflowY:'auto', boxShadow:T.shadowLg, border:`2px solid ${T.verde}` }}>
        <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:'0 0 6px' }}>✅ Aceitar Solicitação</h2>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'0 0 4px' }}>Defina a execução para <strong style={{ color:T.laranja }}>{req?.clientName||req?.requesterName}</strong>.</p>
        <FreteEstimativa request={req} simClients={simClients}/>
        <div style={{ display:'flex', gap:8, marginBottom:16, marginTop:16 }}>
          {[['motorista','👤 Motorista Mills'],['transportadora','🚚 Transportadora Externa']].map(([v,l])=>(
            <div key={v} onClick={()=>setExecType(v)} style={{ flex:1, border:`2px solid ${execType===v?T.laranja:T.border}`, borderRadius:T.r, padding:'9px 12px', cursor:'pointer', textAlign:'center', background:execType===v?T.laranjaLight:T.surfaceAlt }}>
              <div style={{ color:T.text, fontFamily:FONT, fontSize:12, fontWeight:execType===v?800:500 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {execType==='motorista'&&(
            <div>
              <label style={LS}>Motorista responsável</label>
              <select value={driverId} onChange={e=>setDriverId(e.target.value)} style={IS}>
                <option value="">— selecione o motorista —</option>
                {drivers.filter(d=>d.active!==false).map(d=>(<option key={d.id} value={d.id}>{d.name}{d.unit?` · ${d.unit.replace(/ \(.*\)/,'')}`:''}{d.category?` (CNH ${d.category})`:''}</option>))}
              </select>
              {drivers.length===0&&<div style={{ marginTop:5, color:T.amarelo, fontSize:11, fontFamily:FONT }}>⚠️ Cadastre motoristas em 👤 Motoristas.</div>}
              {selectedDriver&&(<div style={{ marginTop:8, padding:'10px 13px', background:T.verdeLight, borderRadius:T.r, border:`1px solid ${T.verde}30` }}>
                <div style={{ color:T.verde, fontFamily:FONT, fontWeight:700, fontSize:12 }}>👤 {selectedDriver.name}</div>
                <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10, marginTop:2 }}>{selectedDriver.cnh&&`CNH: ${selectedDriver.cnh} · `}Cat. {selectedDriver.category||'—'} · {selectedDriver.phone||'—'}</div>
              </div>)}
            </div>
          )}
          {execType==='transportadora'&&(<>
            <div><label style={LS}>Nome da Transportadora <span style={{ color:T.perigo }}>*</span></label><input value={transpNome} onChange={e=>setTranspNome(e.target.value)} placeholder="Ex: Hengel Transportes" style={IS}/></div>
            <div><label style={LS}>CNPJ</label><input value={transpCnpj} onChange={e=>setTranspCnpj(e.target.value)} placeholder="00.000.000/0001-00" style={IS}/></div>
          </>)}
          <div><label style={LS}>Data de execução</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={IS}/></div>
          <div><label style={LS}>Observação para o solicitante</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex: Motorista confirmado, saída às 07h..." style={{ ...IS, height:68, resize:'vertical' }}/></div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={onCancel} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!canConfirm} style={{ ...BS, background:canConfirm?T.verde:T.borderMid, color:'white', fontWeight:700, opacity:canConfirm?1:0.5 }}>✅ Confirmar e criar no calendário</button>
        </div>
      </motion.div>
    </div>
  )
}

function RequestsKanban({ requests, teamsWebhookUrl, onRespond, onCancel, profile, simClients }) {
  const [reviewing, setReviewing]  = useState(null)
  const [messaging, setMessaging]  = useState(null)
  const [cancelling,setCancelling] = useState(null)
  const [cancelNote,setCancelNote] = useState('')
  const [saving,    setSaving]     = useState(false)
  const groups={
    pendente: requests.filter(r=>r.status==='pendente'),
    aceito:   requests.filter(r=>r.status==='aceito'),
    recusado: requests.filter(r=>r.status==='recusado'),
  }
  const cols=[
    {key:'pendente',label:'⏳ Pendentes',color:T.amarelo,bg:T.amareloLight},
    {key:'aceito',  label:'✅ Aceitas',  color:T.verde,  bg:T.verdeLight  },
    {key:'recusado',label:'❌ Recusadas',color:T.perigo, bg:T.perigoLight },
  ]
  const handleCancel=async()=>{
    if(!cancelNote.trim())return
    setSaving(true)
    await onCancel(cancelling.id,cancelNote,profile?.name)
    await addDoc(collection(db,'requests',cancelling.id,'messages'),{text:`Serviço cancelado. Motivo: ${cancelNote}`,authorId:profile?.uid||'',authorName:profile?.name||'Frotas',authorRole:profile?.role||'frotas',type:'status_change',statusEvent:'cancelado',createdAt:serverTimestamp()})
    await addDoc(collection(db,'notifications'),{userId:cancelling.requesterId,requestId:cancelling.id,type:'service_cancelled',title:'🚫 Serviço cancelado',message:`O serviço de ${cancelling.clientName||cancelling.requesterName} foi cancelado. Motivo: ${cancelNote}`,read:false,createdAt:serverTimestamp()})
    setCancelling(null);setCancelNote('');setSaving(false)
  }
  return (
    <>
      {reviewing&&<RequestReviewModal req={reviewing} teamsWebhookUrl={teamsWebhookUrl} onRespond={onRespond} onClose={()=>setReviewing(null)} profile={profile} simClients={simClients}/>}
      {messaging&&<MessageThread requestId={messaging.id} profile={profile} onClose={()=>setMessaging(null)}/>}
      {cancelling&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={e=>e.target===e.currentTarget&&setCancelling(null)}>
          <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:440, boxShadow:T.shadowLg, border:`2px solid ${T.amarelo}` }}>
            <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:18, margin:'0 0 6px' }}>⚠️ Cancelar Serviço</h3>
            <p style={{ color:T.textSec, fontFamily:FONT, fontSize:12, margin:'0 0 16px' }}>Cancelar serviço de <strong style={{ color:T.laranja }}>{cancelling.clientName||cancelling.requesterName}</strong>.<br/>O solicitante será notificado.</p>
            <div style={{ marginBottom:16 }}>
              <label style={LS}>Motivo do cancelamento <span style={{ color:T.perigo }}>*</span></label>
              <textarea value={cancelNote} onChange={e=>setCancelNote(e.target.value)} placeholder="Descreva o motivo..." style={{ ...IS, height:80, resize:'vertical', marginTop:5 }}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>{setCancelling(null);setCancelNote('')}} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Voltar</button>
              <button onClick={handleCancel} disabled={!cancelNote.trim()||saving}
                style={{ ...BS, background:cancelNote.trim()?T.amarelo:'#CCC', color:cancelNote.trim()?T.text:'white', fontWeight:700 }}>
                {saving?'⏳...':'⚠️ Confirmar Cancelamento'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, height:'100%', overflow:'hidden' }}>
        {cols.map(col=>(
          <div key={col.key} style={{ background:col.bg, borderRadius:T.rLg, border:`1px solid ${col.color}30`, padding:14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexShrink:0 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:col.color }}/>
              <span style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'0.04em' }}>{col.label}</span>
              <span style={{ marginLeft:'auto', background:col.color, color:'white', borderRadius:20, padding:'0 5px', fontSize:9, fontWeight:800 }}>{groups[col.key].length}</span>
            </div>
            <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
              {groups[col.key].length===0&&<div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, paddingTop:20 }}>—</div>}
              {groups[col.key].map(r=>{
                const ct=CARD_TYPES[r.type],ug=URGENCY[r.urgency]
                return (
                  <motion.div key={r.id} layout whileHover={{ y:-1, boxShadow:T.shadowMd }}
                    style={{ background:T.surface, borderRadius:T.r, padding:'13px 14px', boxShadow:T.shadow, border:`1px solid ${T.border}`, transition:'all .12s' }}>
                    <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                      <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 8px', color:ct?.color, fontSize:9, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                      <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 8px', color:ug?.color, fontSize:9, fontWeight:700, fontFamily:FONT }}>{ug?.icon}</span>
                      {r.subtype&&<span style={{ background:T.infoLight, borderRadius:20, padding:'2px 8px', color:T.info, fontSize:9, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(r.type,r.subtype)}</span>}
                      <span style={{ marginLeft:'auto', fontSize:11 }}>{r.channel==='teams'?'🟦':r.channel==='whatsapp'?'💬':'📧'}</span>
                    </div>
                    <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT, marginBottom:4 }}>{r.requesterName||'—'}</div>
                    <div style={{ color:T.textSec, fontSize:11, fontFamily:FONT, marginBottom:3 }}>{r.unit}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>🔧 {r.machine||'—'}</span>
                      <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>📅 {fmt(r.desiredDate)}</span>
                    </div>
                    {r.description&&<div style={{ marginBottom:6, color:T.textMuted, fontSize:10, fontFamily:FONT, fontStyle:'italic' }}>"{r.description.slice(0,60)}{r.description.length>60?'...':''}"</div>}
                    {r.responseNote&&<div style={{ marginBottom:6, padding:'5px 8px', background:col.key==='aceito'?T.verdeLight:T.perigoLight, borderRadius:T.rSm, color:col.key==='aceito'?T.verde:T.perigo, fontSize:10, fontFamily:FONT }}>{r.responseNote}</div>}
                    <div style={{ display:'flex', gap:5, justifyContent:'flex-end', flexWrap:'wrap' }}>
                      <button onClick={()=>setMessaging(r)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>💬 Histórico</button>
                      {col.key==='pendente'&&<button onClick={()=>setReviewing(r)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}40`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>Avaliar →</button>}
                      {col.key==='aceito'  &&<button onClick={()=>setCancelling(r)} style={{ ...BS, background:T.amareloLight, color:'#B8860B', border:`1px solid ${T.amarelo}50`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>⚠️ Cancelar</button>}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}


function CsvUploadModal({ onLoaded, onClose }) {
  const [status, setStatus] = useState('idle')
  const [count,  setCount]  = useState(0)
  const [preview, setPreview] = useState([])
  const inputRef = useRef()

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        // CORRIGIDO: usa import ESM do Papa (não require/window._Papa)
        const clients = parseSIMCsv(ev.target.result, Papa)
        setCount(clients.length)
        setPreview(clients.slice(0,4))
        setStatus('done')
        onLoaded(clients)
      } catch(err) {
        setStatus('error')
        console.error('CSV parse error:', err)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:32, width:500, maxHeight:'85vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>📂 Atualizar Base SIM</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {/* Colunas esperadas */}
        <div style={{ padding:'10px 13px', background:T.infoLight, borderRadius:T.rSm, border:`1px solid ${T.info}20`, marginBottom:16 }}>
          <div style={{ color:T.info, fontSize:11, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:4 }}>📋 Colunas lidas do CSV:</div>
          <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', lineHeight:1.6 }}>
            <strong>Cliente:</strong> "Planta/Obra"<br/>
            <strong>Frota:</strong> "N° Interno"<br/>
            <strong>Estado:</strong> "Estado (Planta/Obra)"<br/>
            <strong>Cidade:</strong> "Município (Planta/Obra)"<br/>
            Separador: ponto-e-vírgula (;) · Encoding: UTF-8
          </div>
        </div>

        <div style={{ padding:'10px 13px', background:T.infoLight, borderRadius:T.rSm, border:`1px solid ${T.info}20`, marginBottom:16 }}>
          <div style={{ color:T.info, fontSize:11, fontWeight:700, fontFamily:FONT, marginBottom:4 }}>📋 Colunas lidas do CSV:</div>
          <div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, lineHeight:1.6 }}>
            <strong>Cliente:</strong> "Planta/Obra"<br/>
            <strong>Frota:</strong> "N° Interno"<br/>
            <strong>Veículo:</strong> "Grupo de Modelo" <span style={{ color:T.verde, fontWeight:700 }}>← usado para calcular frete</span><br/>
            <strong>Estado:</strong> "Estado (Planta/Obra)"<br/>
            <strong>Cidade:</strong> "Município (Planta/Obra)"<br/>
            Separador: ponto-e-vírgula (;) · Encoding: UTF-8
          </div>
        </div>
        <div style={{ padding:20, background:T.surfaceAlt, borderRadius:T.r, border:`2px dashed ${T.borderMid}`, textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📊</div>
          <p style={{ color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13, margin:'0 0 12px' }}>CSV exportado do SIM</p>
          <button onClick={()=>inputRef.current?.click()} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>Escolher arquivo</button>
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
        </div>

        {status==='loading' && <div style={{ textAlign:'center', color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13 }}>⏳ Processando...</div>}

        {status==='done' && <>
          <div style={{ padding:'10px 14px', background:T.verdeLight, borderRadius:T.r, border:`1px solid ${T.verde}30`, marginBottom:12 }}>
            <div style={{ color:T.verde, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>✅ {count} registros carregados!</div>
            <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Base sincronizada para todos os usuários.</div>
          </div>
          {preview.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Prévia (primeiros registros):</div>
              {preview.map(c => (
                <div key={c.name} style={{ padding:'6px 10px', background:T.surfaceAlt, borderRadius:T.rSm, marginBottom:4, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11 }}>
                  <span style={{ fontWeight:700, color:T.text }}>{c.name}</span>
                  <span style={{ color:T.textMuted }}> · {c.city||'—'}/{c.state||'—'}</span>
                  {c.nInternos?.length > 0 && <span style={{ color:T.info }}> · N°: {c.nInternos.slice(0,3).join(', ')}</span>}
                </div>
              ))}
            </div>
          )}
        </>}

        {status==='error' && <div style={{ padding:'10px 14px', background:T.perigoLight, borderRadius:T.r, marginBottom:12 }}>
          <div style={{ color:T.perigo, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>❌ Erro ao processar. Verifique o formato do arquivo.</div>
          <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:4 }}>Certifique-se que o arquivo usa ; como separador e encoding UTF-8.</div>
        </div>}

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
        </div>
      </motion.div>
    </div>
  )
}

/* ══ MAIN FROTAS VIEW ════════════════════════════════════════════════════════ */
export function FrotasView() {
  const { profile, logout }              = useAuth()
  const { cards, saveCard, deleteCard, moveCard } = useCards()
  const { requests, respondRequest }     = useRequests('frotas')
  const { simClients, uploadClients }    = useSimClients()
  const { config, saveConfig }           = useConfig()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { toasts, add: addToast, dismiss } = useToasts()
  const { drivers, saveDriver, deleteDriver } = useDrivers()
  const { rotogramas } = useAllRotogramas()

  const [activeTab,    setActiveTab]    = useState('agenda')
  const [view,         setView]         = useState('semana')
  const [baseDate,     setBaseDate]     = useState(todayStr())
  const [yr,           setYr]           = useState(new Date().getFullYear())
  const [mo,           setMo]           = useState(new Date().getMonth())
  const [modal,        setModal]        = useState(null)
  const [editCard,     setEditCard]     = useState(null)
  const [defaultDate,  setDefaultDate]  = useState(null)
  const [exportModal,  setExportModal]  = useState(false)
  const [csvModal,     setCsvModal]     = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [driversModal,  setDriversModal]  = useState(false)
  const [assignModal,   setAssignModal]   = useState(null)
  const [rotogramaModal,setRotogramaModal]= useState(null)
  const [pendingCardForm, setPendingCardForm] = useState(null)

  const hoje      = todayStr()
  const atrasados = cards.filter(c=>c.endDate&&c.endDate<hoje&&!['concluido','cancelado'].includes(c.status)).length
  const conflicts = detectConflicts(cards)
  const weekDays  = getWeekDays(baseDate)
  const pending   = requests.filter(r=>r.status==='pendente').length

  const navWeek  = d => { const x=new Date(baseDate); x.setDate(x.getDate()+d*7); setBaseDate(x.toISOString().split('T')[0]) }
  const navMonth = d => { let m=mo+d,y=yr; if(m<0){m=11;y--;}if(m>11){m=0;y++;} setMo(m);setYr(y) }

  const handleSaveCard = async f => {
    const mapped = {
      ...f,
      client:      f.clientName || f.client || '',
      plantaObra:  f.clientName || f.plantaObra || '',
      origin:      f.originCity?.s || f.origin || '',
      destination: f.destCity?.s   || f.destination || '',
      originCity:  f.originCity?.m || f.originCity || '',
      destCity:    f.destCity?.m   || f.destCity || '',
      startDate:   f.desiredDate   || f.startDate || '',
      endDate:     f.desiredDate   || f.endDate   || '',
    }
    setModal(null); setEditCard(null)
    if (!f.id && editCard === null) {
      // Novo card → pedir motorista antes de salvar
      setPendingCardForm(mapped)
    } else {
      // Edição de card existente → salvar direto
      await saveCard(mapped)
      addToast(`Serviço de ${mapped.client||'novo'} atualizado.`, 'success')
    }
  }

  const handleCardDriverConfirm = async ({ driverId, driverName, transportadoraNome, transportadoraCnpj, date, note }) => {
    const motorista = driverName || transportadoraNome || ''
    const finalCard = {
      ...pendingCardForm,
      driver:              motorista,
      driverId:            driverId || '',
      transportadoraNome:  transportadoraNome || '',
      transportadoraCnpj:  transportadoraCnpj || '',
      startDate:           date || pendingCardForm.startDate,
      endDate:             date || pendingCardForm.endDate,
      status:              'confirmado',
      notes:               note ? `${pendingCardForm.notes||''} ${note}`.trim() : pendingCardForm.notes || '',
    }
    await saveCard(finalCard)
    setPendingCardForm(null)
    addToast(`✅ Serviço de ${finalCard.client||'novo'} criado${motorista ? ` — atribuído a ${motorista}` : ''}.`, 'accepted')
  }

  const handleCardDriverCancel = async () => {
    // Salva o card sem motorista e fecha
    await saveCard(pendingCardForm)
    setPendingCardForm(null)
    addToast(`Serviço de ${pendingCardForm.client||'novo'} salvo sem motorista.`, 'success')
  }
  const handleDeleteCard = async id => { await deleteCard(id); setModal(null); setEditCard(null); addToast('Serviço removido.', 'info') }
  const handleMoveCard = async (id, ns, ne, reason) => {
    await moveCard(id, ns, ne, reason)
    const card = cards.find(c=>c.id===id)
    if (card?.requestId) {
      const req = requests.find(r=>r.id===card.requestId)
      if (req?.requesterId) {
        await addDoc(collection(db,'notifications'),{userId:req.requesterId,requestId:card.requestId,type:'service_rescheduled',title:'📅 Serviço reagendado',message:`O serviço de ${card.client} foi reagendado para ${ns}. Motivo: ${reason}`,read:false,createdAt:serverTimestamp()})
        await addDoc(collection(db,'requests',card.requestId,'messages'),{text:`Serviço reagendado para ${ns}. Motivo: ${reason}`,authorId:profile?.uid||'',authorName:profile?.name||'Frotas',authorRole:profile?.role||'frotas',type:'status_change',statusEvent:'reagendado',createdAt:serverTimestamp()})
      }
    }
    addToast('Serviço reagendado — solicitante notificado.','success')
  }
  const handleRespond = async (id, status, note, webhook) => {
    if (status==='aceito') {
      const req = requests.find(r=>r.id===id)
      setAssignModal({ req, id, note, webhook })
    } else {
      await respondRequest(id,'recusado',note,webhook)
      addToast('❌ Solicitação recusada.','info')
    }
  }

  const validacoes = cards.filter(c => c.status === 'aguardando_validacao')

  const handleValidarCard = async (card) => {
    await updateDoc(doc(db,'cards',card.id), {
      status:       'concluido',
      concluidoEm:  serverTimestamp(),
      concluidoPor: profile?.name || 'Frotas',
      updatedAt:    serverTimestamp(),
    })
    addToast(`✅ Serviço de ${card.client||'motorista'} validado e encerrado.`, 'success')
  }

  const handleCancelRequest = async (requestId, reason, authorName) => {
    await updateDoc(doc(db,'requests',requestId),{status:'cancelado',cancelReason:reason,cancelledAt:serverTimestamp(),cancelledBy:authorName,updatedAt:serverTimestamp()})
    addToast('Serviço cancelado — solicitante notificado.','info')
  }

  const handleAssignConfirm = async ({ driverId, driverName, transportadoraNome, transportadoraCnpj, date, note }) => {
    const { req, id, webhook } = assignModal
    const motorista = driverName || transportadoraNome || ''
    await respondRequest(id,'aceito',note||`Motorista: ${motorista} · Data: ${date}`,webhook)
    await saveCard({
      type:req.type, subtype:req.subtype||'', client:req.clientName||req.requesterName||'',
      plantaObra:req.clientName||'', nInterno:req.nInterno||'', machine:req.machine||'',
      urgency:req.urgency||'medio', origin:req.origin||'', destination:req.destination||'',
      originCity:req.originCityName||'', destCity:req.destCityName||'',
      startDate:date, endDate:date, driver:motorista, driverId:driverId||'',
      transportadoraNome:transportadoraNome||'', transportadoraCnpj:transportadoraCnpj||'',
      unit:req.unit||profile?.unit||'', notes:req.description||'', requestId:id, status:'confirmado'
    })
    setAssignModal(null)
    addToast(`✅ Serviço aceito e atribuído a ${motorista||'motorista'}!`,'accepted')
  }

  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'IBM Plex Sans,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:${T.bg}} ::-webkit-scrollbar-thumb{background:${T.borderMid};border-radius:10px}`}</style>

      {/* HEADER */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0, boxShadow:`0 1px 0 ${T.border},0 2px 8px rgba(26,22,18,.04)` }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <MillsLogo height={30}/>
          <div style={{ width:1, height:26, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:14, letterSpacing:'0.04em', lineHeight:1.1 }}>GESTÃO DE FROTAS</div>
            <div style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase' }}>Logística · Operações de Campo</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:T.verdeLight, border:`1px solid ${T.verde}30`, borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.verde, animation:'pulse 2s infinite' }}/>
            <span style={{ color:T.verde, fontSize:9, fontWeight:700, letterSpacing:'0.06em' }}>LIVE</span>
          </div>
          <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, display:'flex', padding:3, gap:2 }}>
            {[['agenda','📅 Agenda'],['requests','📥 Solicitações']].map(([v,l])=>(
              <button key={v} onClick={()=>setActiveTab(v)}
                style={{ padding:'4px 12px', borderRadius:T.rSm, border:'none', background:activeTab===v?T.laranja:'transparent', color:activeTab===v?'white':T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:11, cursor:'pointer', transition:'all .12s', display:'flex', alignItems:'center', gap:5 }}>
                {l}
                {v==='requests'&&pending>0&&<span style={{ background:activeTab==='requests'?'rgba(255,255,255,.3)':T.perigo, color:'white', borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>{pending}</span>}
                {v==='agenda'&&validacoes.length>0&&<span style={{ background:activeTab==='agenda'?'rgba(255,255,255,.3)':T.info, color:'white', borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>{validacoes.length}</span>}
              </button>
            ))}
          </div>
          {activeTab==='agenda'&&<>
            <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, display:'flex', padding:3, gap:2 }}>
              {[['semana','Semana'],['mes','Mês'],['ano','Ano']].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{ padding:'4px 11px', borderRadius:T.rSm, border:'none', background:view===v?T.laranja:'transparent', color:view===v?'white':T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:11, cursor:'pointer', transition:'all .12s' }}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setExportModal(true)} style={{ ...BS, background:T.verdeLight, color:T.verde, border:`1px solid ${T.verde}40`, fontSize:11, fontWeight:700 }}>📤 Relatório</button>
            <button onClick={()=>{setEditCard(null);setDefaultDate(baseDate);setModal('card');}} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11 }}>+ Novo Serviço</button>
          </>}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={()=>setCsvModal(true)} title="Atualizar base SIM" style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11, padding:'5px 10px' }}>⬆ SIM</button>
          <button onClick={()=>setDriversModal(true)} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11, padding:'5px 10px' }}>👤 Motoristas</button>
          <button onClick={()=>setSettingsModal(true)} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11, padding:'5px 10px' }}>⚙️</button>
          <button onClick={logout} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Sair</button>
        </div>
      </div>

      {/* AGENDA TAB */}
      {activeTab==='agenda'&&<>
        <div style={{ flex:'1 1 62%', overflow:'hidden', padding:'12px 20px 6px', display:'flex', flexDirection:'column', minHeight:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>view==='semana'?navWeek(-1):view==='mes'?navMonth(-1):setYr(y=>y-1)} style={NB}>‹</button>
              <button onClick={()=>view==='semana'?navWeek(1):view==='mes'?navMonth(1):setYr(y=>y+1)} style={NB}>›</button>
              <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:17, margin:0, letterSpacing:'0.02em' }}>
                {view==='semana'&&`${fmt(weekDays[0])} — ${fmt(weekDays[6])}`}
                {view==='mes'&&`${MONTH_NAMES[mo]} ${yr}`}
                {view==='ano'&&`${yr}`}
              </h2>
              {view==='semana'&&<button onClick={()=>setBaseDate(todayStr())} style={{ ...NB, fontSize:10, padding:'3px 8px', letterSpacing:'0.04em' }}>HOJE</button>}
            </div>
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              {Object.entries(CARD_TYPES).map(([k,v])=>(
                <div key={k} style={{ display:'flex', alignItems:'center', gap:4, background:v.bg, border:`1px solid ${v.color}40`, borderRadius:20, padding:'2px 9px' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:v.color }}/><span style={{ color:v.color, fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{v.short}</span>
                </div>
              ))}
              {conflicts.length>0&&<div style={{ display:'flex', alignItems:'center', gap:4, background:T.amareloLight, border:`1px solid ${T.amarelo}50`, borderRadius:20, padding:'2px 9px' }}>
                <span style={{ color:'#B8860B', fontSize:8, fontWeight:700 }}>⚠ {conflicts.length} otimiz.</span>
              </div>}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-5 }} transition={{ duration:.1 }} style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {view==='semana'&&<WeekView cards={cards} baseDate={baseDate} conflicts={conflicts} onEdit={c=>{setEditCard(c);setModal('card');}} onAddCard={d=>{setDefaultDate(d);setEditCard(null);setModal('card');}} onMoveCard={handleMoveCard}/>}
              {view==='mes'&&<MonthView cards={cards} year={yr} month={mo} conflicts={conflicts} onEdit={c=>{setEditCard(c);setModal('card');}} onAddCard={d=>{setDefaultDate(d);setEditCard(null);setModal('card');}} onMoveCard={handleMoveCard}/>}
              {view==='ano'&&<div style={{ overflow:'auto', flex:1 }}><YearView cards={cards} year={yr} onMonthClick={m=>{setMo(m);setView('mes');}}/></div>}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom: Mapa maior + KPIs + solicitações rápidas */}
        <div style={{ flex:'0 0 35%', display:'grid', gridTemplateColumns:'1fr 340px', gap:12, padding:'0 20px 14px', minHeight:0, overflow:'hidden' }}>
          {/* MAPA — agora ocupa mais espaço */}
          <BrazilMap cards={cards}/>
          <div style={{ display:'flex', flexDirection:'column', gap:8, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, flexShrink:0 }}>
              {[
                {l:'Serviços',     v:cards.length,                                      c:T.laranja, bg:T.laranjaLight},
                {l:'Atrasados',    v:cards.filter(c=>c.status==='atrasado').length,      c:T.perigo,  bg:T.perigoLight},
                {l:'Otimizações',  v:conflicts.length,                                  c:'#B8860B', bg:T.amareloLight},
              ].map(s=>(
                <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}30`, borderRadius:T.r, padding:'8px 10px' }}>
                  <div style={{ color:s.c, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:800, fontSize:22, lineHeight:1 }}>{s.v}</div>
                  <div style={{ color:T.textSec, fontSize:8, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:13, flex:1, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:T.shadow }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ color:T.text, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em' }}>📥 Solicitações</span>
                  {pending>0&&<div style={{ background:T.perigo, color:'white', borderRadius:20, padding:'0 7px', fontSize:9, fontWeight:800 }}>{pending}</div>}
                </div>
                <button onClick={()=>setActiveTab('requests')} style={{ color:T.laranja, background:'none', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'IBM Plex Sans,sans-serif' }}>Ver todas →</button>
              </div>
              <div style={{ overflowY:'auto', flex:1 }}>
                {requests.length===0&&<p style={{ color:T.textMuted, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', margin:0 }}>Nenhuma solicitação.</p>}
                {[...requests].sort((a,b)=>a.status==='pendente'?-1:1).slice(0,5).map(r=>{
                  const sc={pendente:T.amarelo,aceito:T.verde,recusado:T.perigo}
                  const sl={pendente:'⏳',aceito:'✅',recusado:'❌'}
                  return (
                    <div key={r.id} style={{ border:`1px solid ${T.border}`, borderRadius:T.rSm, padding:'9px 11px', marginBottom:7, cursor:'pointer', background:T.surfaceAlt, transition:'all .1s' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=T.laranja} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}
                      onClick={()=>setActiveTab('requests')}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif' }}>{r.requesterName||'—'}</span>
                        <span style={{ color:sc[r.status], fontSize:11 }}>{sl[r.status]}</span>
                      </div>
                      <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif' }}>{r.unit} · {fmt(r.desiredDate)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Validações pendentes */}
            {validacoes.length>0&&(
              <div style={{ background:T.surface, borderRadius:T.rLg, border:`2px solid ${T.info}50`, padding:13, flexShrink:0, boxShadow:T.shadow }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ color:T.info, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em' }}>⏳ Aguardando validação</span>
                    <div style={{ background:T.info, color:'white', borderRadius:20, padding:'0 7px', fontSize:9, fontWeight:800 }}>{validacoes.length}</div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {validacoes.map(c=>(
                    <div key={c.id} style={{ border:`1px solid ${T.info}30`, borderRadius:T.rSm, padding:'9px 11px', background:T.infoLight }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                        <div>
                          <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{c.client||'—'}</div>
                          <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>👤 {c.driver||'—'} · 📅 {fmt(c.startDate)}</div>
                          {c.conclusaoNota&&<div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, fontStyle:'italic', marginTop:2 }}>"{c.conclusaoNota.slice(0,50)}{c.conclusaoNota.length>50?'...':''}"</div>}
                        </div>
                      </div>
                      {c.conclusaoFoto&&<img src={c.conclusaoFoto} alt="conclusão" style={{ width:'100%', borderRadius:T.rSm, maxHeight:80, objectFit:'cover', marginBottom:6 }}/>}
                      <button onClick={()=>handleValidarCard(c)}
                        style={{ ...BS, background:T.verde, color:'white', fontWeight:700, fontSize:10, width:'100%', marginTop:4 }}>
                        ✅ Validar e encerrar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* REQUESTS TAB */}
      {activeTab==='requests'&&(
        <div style={{ flex:1, overflow:'hidden', padding:'14px 20px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexShrink:0 }}>
            <div>
              <h2 style={{ fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:22, color:T.text, margin:0 }}>Solicitações de Serviço</h2>
              <p style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, margin:'2px 0 0' }}>Demandas recebidas em tempo real · {requests.length} total</p>
            </div>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <RequestsKanban requests={requests} teamsWebhookUrl={config?.teamsWebhookUrl} onRespond={handleRespond} onCancel={handleCancelRequest} profile={profile} simClients={simClients}/>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {modal==='card'&&<RequestForm
          simClients={simClients}
          profile={profile}
          initialData={editCard}
          title={editCard ? '✏️ Editar Serviço' : '➕ Novo Serviço'}
          submitLabel={editCard ? '💾 Salvar' : '➕ Criar Serviço'}
          onSubmit={handleSaveCard}
          onClose={()=>{setModal(null);setEditCard(null);}}
        />}
        {exportModal&&<ExportModal cards={cards} weekDays={weekDays} conflicts={conflicts} onClose={()=>setExportModal(false)}/>}
        {driversModal&&<DriversModal drivers={drivers} onSave={saveDriver} onDelete={deleteDriver} onClose={()=>setDriversModal(false)} onRotograma={d=>{setDriversModal(false);setRotogramaModal(d)}} addToast={addToast}/>}
        {assignModal&&<AssignDriverModal req={assignModal.req} drivers={drivers} simClients={simClients} onConfirm={handleAssignConfirm} onCancel={()=>setAssignModal(null)}/>}
        {pendingCardForm&&<AssignDriverModal
          req={{
            ...pendingCardForm,
            clientName:    pendingCardForm.client,
            requesterName: pendingCardForm.client,
            originCityName:pendingCardForm.originCity,
            destCityName:  pendingCardForm.destCity,
            desiredDate:   pendingCardForm.startDate,
            description:   pendingCardForm.notes,
            type:          pendingCardForm.type,
            machine:       pendingCardForm.machine,
            nInterno:      pendingCardForm.nInterno,
            nInternos:     pendingCardForm.nInterno ? [pendingCardForm.nInterno] : [],
          }}
          drivers={drivers}
          simClients={simClients}
          onConfirm={handleCardDriverConfirm}
          onCancel={handleCardDriverCancel}
        />}
        {rotogramaModal&&<RotogramaModal driver={rotogramaModal} cards={cards} profile={profile} rotogramaAtivo={rotogramas.find(r=>r.driverId===rotogramaModal.id)||null} onClose={()=>setRotogramaModal(null)} addToast={addToast}/>}
        {csvModal&&<CsvUploadModal onLoaded={async clients=>{await uploadClients(clients);setCsvModal(false);addToast(`${clients.length} registros sincronizados para todos os usuários.`,'success');}} onClose={()=>setCsvModal(false)}/>}
        {settingsModal&&<SettingsModal config={config} onSave={saveConfig} onClose={()=>setSettingsModal(false)}/>}
      </AnimatePresence>
    </div>
  )
}
