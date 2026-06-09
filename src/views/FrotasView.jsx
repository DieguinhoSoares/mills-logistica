import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }        from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, useDrivers, useMessages } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, ServiceCard, BrazilMap, MoveModal, NotificationBell, ClientInput } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, buildReport, downloadTxt, sendTeamsNotification, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import { db } from '../lib/firebase'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import Papa from 'papaparse'

// ── Componente de histórico de mensagens ─────────────────────────────────────
function MessageThread({ requestId, profile, onClose }) {
  const { messages, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()

  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await sendMessage({
      requestId,
      text: text.trim(),
      authorId:   profile.uid || profile.id || '',
      authorName: profile.name,
      authorRole: profile.role,
      type: 'message',
    })
    // Notifica o solicitante
    const req = await import('../hooks/useFirestore')
    setText('')
    setSending(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:0, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>

        <div style={{ background:T.verde, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:14 }}>💬 Histórico da Solicitação</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, padding:'20px 0' }}>
              Nenhuma mensagem ainda.
            </div>
          )}
          {messages.map(m => {
            const isMe = m.authorRole === 'frotas' || m.authorRole === 'master'
            const isEvent = m.type === 'status_change'
            if (isEvent) return (
              <div key={m.id} style={{ textAlign:'center' }}>
                <span style={{ background:T.surfaceLow, color:T.textMuted, borderRadius:20, padding:'3px 12px', fontSize:10, fontFamily:FONT }}>
                  {m.text}
                </span>
              </div>
            )
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth:'75%', background: isMe ? T.verde : T.surfaceAlt, borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding:'9px 13px', boxShadow:T.shadow }}>
                  <div style={{ color: isMe ? 'rgba(255,255,255,0.7)' : T.textMuted, fontSize:9, fontFamily:FONT, fontWeight:700, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    {m.authorName}
                  </div>
                  <div style={{ color: isMe ? 'white' : T.text, fontSize:12, fontFamily:FONT, lineHeight:1.5 }}>{m.text}</div>
                </div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginTop:2, paddingLeft:4, paddingRight:4 }}>
                  {m.createdAt?.toDate?.()?.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) || ''}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef}/>
        </div>

        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8 }}>
          <input value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend() } }}
            placeholder="Digite uma mensagem..."
            style={{ ...IS, flex:1, margin:0 }}/>
          <button onClick={handleSend} disabled={sending||!text.trim()}
            style={{ ...BS, background:text.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, flexShrink:0 }}>
            {sending ? '⏳' : 'Enviar'}
          </button>
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
            style={{ border:`2px solid ${value===opt.value ? T.laranja : T.border}`, borderRadius:T.rSm, padding:'8px 10px', cursor:'pointer',
              background: value===opt.value ? T.laranjaLight : T.surfaceAlt, transition:'all .12s', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:14 }}>{opt.label.split(' ')[0]}</span>
            <span style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:value===opt.value?700:500, flex:1 }}>{opt.label.replace(/^[^\s]+\s/, '')}</span>
            {value===opt.value && <span style={{ color:T.laranja, fontSize:12 }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function CardModal({ card, defaultDate, simClients, onSave, onClose, onDelete }) {
  const blank = { type:'freteMillsInterno', subtype:'', client:'', clientState:'', clientCity:'', urgency:'medio', machine:'', om:'', nInterno:'', plantaObra:'', calendarStatus:'em_dia', origin:'SP', destination:'SP', startDate:defaultDate||todayStr(), endDate:defaultDate||todayStr(), notes:'', driver:'', unit:'' }
  const [form, setForm] = useState(card || blank)
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const handleTypeChange = v => setForm(p => ({ ...p, type: v, subtype: '' }))
  const handleClientSelect = c => {
    if (!c) return
    setForm(p => ({ ...p, client:c.name, plantaObra:c.name, clientState:c.state, clientCity:c.city, destination:c.state||p.destination, machine:c.families?.[0]||p.machine, nInterno:c.nInternos?.[0]||p.nInterno }))
  }
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false) }
  const subtypes = CARD_SUBTYPES[form.type] || []
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:640, maxHeight:'94vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>{card ? '✏️ Editar Serviço' : '➕ Novo Serviço'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={LS}>Tipo de Serviço</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {Object.entries(CARD_TYPES).map(([k,v]) => (
              <div key={k} onClick={() => handleTypeChange(k)} style={{ border:`2px solid ${form.type===k ? v.color : T.border}`, borderRadius:T.r, padding:'10px 12px', cursor:'pointer', textAlign:'center', background: form.type===k ? v.bg : T.surfaceAlt, transition:'all .12s' }}>
                <div style={{ fontSize:20, marginBottom:2 }}>{v.icon}</div>
                <div style={{ color:v.color, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v.short}</div>
              </div>
            ))}
          </div>
        </div>
        {subtypes.length > 0 && <div style={{ marginBottom:16, padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}><SubtypeSelect type={form.type} value={form.subtype} onChange={v => set('subtype', v)}/></div>}
        <div style={{ marginBottom:14, padding:'12px 14px', background:T.laranjaLight, borderRadius:T.r, border:`1px solid ${T.laranja}30` }}>
          <label style={LS}>🔍 Buscar Planta/Obra (base SIM)</label>
          <ClientInput value={form.client?{name:form.client}:null} onChange={handleClientSelect} simClients={simClients}/>
          {form.clientCity && <div style={{ marginTop:5, color:T.textSec, fontSize:11, fontFamily:FONT }}>📍 {form.clientCity} – {form.clientState}</div>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}><label style={LS}>Planta / Obra</label><input value={form.plantaObra||''} onChange={e=>set('plantaObra',e.target.value)} placeholder="Nome da planta ou obra" style={IS}/></div>
          <div style={{ gridColumn:'1/-1' }}><label style={LS}>Cliente (Empresa)</label><input value={form.client||''} onChange={e=>set('client',e.target.value)} style={IS}/></div>
          <div><label style={LS}>N° Interno (Frota)</label><input value={form.nInterno||''} onChange={e=>set('nInterno',e.target.value)} placeholder="Ex: XXX01234" style={IS}/></div>
          <div><label style={LS}>OM</label><input value={form.om||''} onChange={e=>set('om',e.target.value)} style={IS}/></div>
          <div><label style={LS}>Motorista</label><input value={form.driver||''} onChange={e=>set('driver',e.target.value)} style={IS}/></div>
          <div><label style={LS}>Unidade Mills</label>
            <select value={form.unit||''} onChange={e=>set('unit',e.target.value)} style={IS}>
              <option value="">— selecione —</option>
              {FILIAIS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div><label style={LS}>Urgência</label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}><label style={LS}>Máquina / Equipamento</label><input value={form.machine||''} onChange={e=>set('machine',e.target.value)} placeholder="Ex: Munck 50T, PA150..." style={IS}/></div>
          <div><label style={LS}>Origem</label>
            <select value={form.origin} onChange={e=>set('origin',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>
          <div><label style={LS}>Destino</label>
            <select value={form.destination} onChange={e=>set('destination',e.target.value)} style={IS}>
              {BR_STATES.map(s=><option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
            </select>
          </div>
          <div><label style={LS}>Data Início</label><input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} style={IS}/></div>
          <div><label style={LS}>Data Conclusão</label><input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} style={IS}/></div>
          <div style={{ gridColumn:'1/-1' }}><label style={LS}>Observações</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...IS, height:60, resize:'vertical' }}/></div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:18 }}>
          {card ? <button onClick={()=>onDelete(card.id)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40` }}>🗑 Excluir</button> : <div/>}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:700 }}>{saving ? '💾 Salvando...' : '💾 Salvar'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function RequestReviewModal({ req, teamsWebhookUrl, onRespond, onClose, profile }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type], ug = URGENCY[req.urgency]
  const chIcon  = { email:'📧', whatsapp:'💬', teams:'🟦' }
  const chLabel = { email:'E-mail corporativo', whatsapp:'WhatsApp', teams:'Microsoft Teams' }
  const handle = async status => {
    setSaving(true)
    await onRespond(req.id, status, note, teamsWebhookUrl)
    // Registra no histórico
    await addDoc(collection(db, 'requests', req.id, 'messages'), {
      text:       note || (status === 'aceito' ? 'Solicitação aceita.' : 'Solicitação recusada.'),
      authorId:   profile?.uid || '',
      authorName: profile?.name || 'Frotas',
      authorRole: profile?.role || 'frotas',
      type:       'status_change',
      statusEvent: status,
      createdAt:  serverTimestamp(),
    })
    setSaving(false)
    onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:540, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>📋 Avaliar Solicitação</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:16 }}>
          <div style={{ display:'flex', gap:10, marginBottom:8 }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
            <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type, req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['Solicitante',req.requesterName||'—'],['Unidade',req.unit||'—'],['Equipamento',req.machine||'—'],['Data desejada',fmt(req.desiredDate)],['Rota',`${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],['Planta/Obra',req.clientName||'—']].map(([label,value]) => (
              <div key={label}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{label}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{value}</div>
              </div>
            ))}
          </div>
          {req.description && <div style={{ marginTop:10, padding:'8px 10px', background:T.surface, borderRadius:T.rSm }}><div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:3 }}>Descrição</div><div style={{ color:T.text, fontSize:12, fontFamily:FONT }}>{req.description}</div></div>}
        </div>
        <div>
          <label style={LS}>Mensagem para o solicitante</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Mensagem que ficará registrada no histórico e será enviada ao solicitante..." style={{ ...IS, height:80, resize:'vertical', width:'100%', marginBottom:12 }}/>
          <div style={{ padding:'10px 13px', background:T.laranjaLight, borderRadius:T.rSm, border:`1px solid ${T.laranja}30`, marginBottom:16 }}>
            <div style={{ color:T.laranja, fontSize:11, fontWeight:700, fontFamily:FONT }}>{chIcon[req.channel]||'📬'} Resposta via {chLabel[req.channel]||req.channel}</div>
            {req.channel==='teams'&&teamsWebhookUrl&&<div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, marginTop:3 }}>Webhook configurado ✓</div>}
            {req.channel==='teams'&&!teamsWebhookUrl&&<div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Webhook não configurado.</div>}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={()=>handle('recusado')} disabled={saving} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40`, fontWeight:700 }}>❌ Recusar</button>
          <button onClick={()=>handle('aceito')} disabled={saving} style={{ ...BS, background:T.verde, color:'white', fontWeight:700 }}>{saving?'⏳...':'✅ Aceitar'}</button>
        </div>
      </motion.div>
    </div>
  )
}

function ExportModal({ cards, onClose }) {
  const today = todayStr()
  const [dateFrom, setDateFrom] = useState(getWeekDays(today)[0])
  const [dateTo,   setDateTo]   = useState(getWeekDays(today)[6])
  const [driver,   setDriver]   = useState('todos')
  const [done,     setDone]     = useState(false)

  const allDrivers = ['todos', ...Array.from(new Set(cards.map(c => c.driver || 'Sem motorista'))).sort()]

  const filtered = cards.filter(c => {
    if (!c.startDate) return false
    const inRange  = c.startDate >= dateFrom && c.startDate <= dateTo
    const inDriver = driver === 'todos' || (c.driver || 'Sem motorista') === driver
    return inRange && inDriver
  })

  const handleExport = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const hGreen  = { font:{ bold:true, color:{ rgb:'FFFFFF' }, name:'Arial', sz:13 }, fill:{ fgColor:{ rgb:'004042' } }, alignment:{ horizontal:'center', vertical:'center' } }
    const hOrange = { font:{ bold:true, color:{ rgb:'FFFFFF' }, name:'Arial', sz:10 }, fill:{ fgColor:{ rgb:'F37021' } }, alignment:{ horizontal:'center', vertical:'center', wrapText:true }, border:{ bottom:{ style:'thin', color:{ rgb:'C24003' } } } }
    const subHdr  = { font:{ bold:true, color:{ rgb:'004042' }, name:'Arial', sz:10 }, fill:{ fgColor:{ rgb:'E0EEEE' } }, alignment:{ horizontal:'center', vertical:'center' } }
    const kpiVal  = { font:{ bold:true, color:{ rgb:'F37021' }, name:'Arial', sz:22 }, alignment:{ horizontal:'center', vertical:'center' } }
    const kpiLbl  = { font:{ color:{ rgb:'4A3F35' }, name:'Arial', sz:9 }, alignment:{ horizontal:'center', vertical:'center' } }
    const subInfo = { font:{ color:{ rgb:'4A3F35' }, name:'Arial', sz:10 }, fill:{ fgColor:{ rgb:'FEF0E6' } }, alignment:{ horizontal:'center' } }
    const footSt  = { font:{ italic:true, color:{ rgb:'9E9590' }, name:'Arial', sz:8 }, alignment:{ horizontal:'center' } }
    const rowEven = (bold=false) => ({ font:{ name:'Arial', sz:10, bold }, fill:{ fgColor:{ rgb:'FAF8F5' } }, alignment:{ vertical:'center' }, border:{ bottom:{ style:'hair', color:{ rgb:'E2DDD6' } } } })
    const rowOdd  = (bold=false) => ({ font:{ name:'Arial', sz:10, bold }, fill:{ fgColor:{ rgb:'FFFFFF' } }, alignment:{ vertical:'center' }, border:{ bottom:{ style:'hair', color:{ rgb:'E2DDD6' } } } })
    const setCell = (ws, ref, v, s) => { ws[ref] = { v, t: typeof v === 'number' ? 'n' : 's', s } }
    const wsR = XLSX.utils.aoa_to_sheet([])
    wsR['!merges'] = []
    wsR['!merges'].push({ s:{r:0,c:0}, e:{r:0,c:5} })
    setCell(wsR, 'A1', 'Mills Pesados · Gestão de Frotas — Logística', hGreen)
    wsR['!merges'].push({ s:{r:1,c:0}, e:{r:1,c:5} })
    setCell(wsR, 'A2', `Relatório de Operações · ${fmt(dateFrom)} a ${fmt(dateTo)}`, subInfo)
    wsR['!merges'].push({ s:{r:2,c:0}, e:{r:2,c:5} })
    setCell(wsR, 'A3', `Emitido em: ${new Date().toLocaleString('pt-BR')} · Filtro: ${driver === 'todos' ? 'Todos os motoristas' : driver}`, { font:{ color:{ rgb:'9E9590' }, name:'Arial', sz:9 }, alignment:{ horizontal:'center' } })
    wsR['!merges'].push({ s:{r:4,c:0}, e:{r:4,c:5} })
    setCell(wsR, 'A5', 'KPIs DO PERÍODO', subHdr)
    const kpis = [
      ['Total de Serviços', filtered.length],
      ['Dias no Período',   Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1],
      ['Motoristas',        new Set(filtered.map(c => c.driver || '—')).size],
      ['Estados Atendidos', new Set(filtered.map(c => c.destination || c.origin).filter(Boolean)).size],
      ['Críticos / Altos',  filtered.filter(c => c.urgency === 'critico' || c.urgency === 'alto').length],
      ['Guindauto',         filtered.filter(c => c.type === 'guindauto').length],
    ]
    kpis.forEach(([lbl, val], i) => {
      const col = String.fromCharCode(65 + i)
      setCell(wsR, `${col}6`, String(val), kpiVal)
      setCell(wsR, `${col}7`, lbl,         kpiLbl)
    })
    wsR['!merges'].push({ s:{r:8,c:0}, e:{r:8,c:5} })
    setCell(wsR, 'A9', 'DISTRIBUIÇÃO POR TIPO DE SERVIÇO', subHdr)
    const tipos = Object.entries(filtered.reduce((acc, c) => { acc[c.type] = (acc[c.type]||0)+1; return acc }, {}))
    ;['A10','B10','C10','D10'].forEach((ref, i) => {
      const hdrs = ['Tipo de Serviço','Qtd','% do Total','Motoristas Envolvidos']
      setCell(wsR, ref, hdrs[i], hOrange)
    })
    tipos.forEach(([tipo, count], i) => {
      const label = { guindauto:'Guindauto', freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente' }[tipo] || tipo
      const pct   = filtered.length ? (count / filtered.length * 100).toFixed(1) + '%' : '0%'
      const mots  = new Set(filtered.filter(c => c.type === tipo).map(c => c.driver || '—')).size
      const st    = i % 2 === 0 ? rowEven() : rowOdd()
      setCell(wsR, `A${11+i}`, label, { ...st, alignment:{ horizontal:'left', vertical:'center' } })
      setCell(wsR, `B${11+i}`, count, { ...st, font:{ ...st.font, bold:true }, alignment:{ horizontal:'center', vertical:'center' } })
      setCell(wsR, `C${11+i}`, pct,   { ...st, font:{ ...st.font, color:{ rgb:'F37021' }, bold:true }, alignment:{ horizontal:'center' } })
      setCell(wsR, `D${11+i}`, mots,  { ...st, alignment:{ horizontal:'center', vertical:'center' } })
    })
    const footRow = 11 + tipos.length + 1
    wsR['!merges'].push({ s:{r:footRow,c:0}, e:{r:footRow,c:5} })
    setCell(wsR, `A${footRow+1}`, 'Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto', footSt)
    wsR['!ref']  = `A1:F${footRow+1}`
    wsR['!cols'] = [20,14,14,20,14,14].map(w => ({ wch:w }))
    wsR['!rows'] = [{ hpt:30 },{ hpt:18 },{ hpt:14 },,{ hpt:6 },{ hpt:30 },{ hpt:16 }]
    XLSX.utils.book_append_sheet(wb, wsR, 'Resumo')
    const WD         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    const TYPE_LABEL = { guindauto:'Guindauto', freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente' }
    const URG_LABEL  = { critico:'Crítico', alto:'Alto', medio:'Médio', baixo:'Baixo' }
    const colHeaders = ['Data','Dia','Tipo','Subtipo','Cliente / Planta','OM','N° Interno','Máquina','Origem','Destino','Motorista','Unidade','Urgência','Observações']
    const dataRows = filtered
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(c => [
        fmt(c.startDate),
        WD[new Date(c.startDate + 'T12:00:00').getDay()],
        TYPE_LABEL[c.type] || c.type,
        c.subtype ? c.subtype.replace(/_/g, ' ') : '—',
        c.client || c.plantaObra || '—',
        c.om       || '—',
        c.nInterno || '—',
        c.machine  || '—',
        c.originCity || c.origin      || '—',
        c.destCity   || c.destination || '—',
        c.driver   || '—',
        c.unit     || '—',
        URG_LABEL[c.urgency] || '—',
        c.notes    || '',
      ])
    const wsD = XLSX.utils.aoa_to_sheet([
      ['Mills Pesados · Relatório Detalhado de Operações', ...Array(13).fill('')],
      [`Período: ${fmt(dateFrom)} a ${fmt(dateTo)} · ${filtered.length} serviço(s)`, ...Array(13).fill('')],
      Array(14).fill(''),
      colHeaders,
      ...dataRows,
    ])
    wsD['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:13} }, { s:{r:1,c:0}, e:{r:1,c:13} }]
    wsD['A1'].s = hGreen
    wsD['A2'].s = subInfo
    colHeaders.forEach((_, i) => { const ref = XLSX.utils.encode_cell({ r:3, c:i }); if (wsD[ref]) wsD[ref].s = hOrange })
    dataRows.forEach((_, i) => {
      const st = i % 2 === 0 ? rowEven : rowOdd
      colHeaders.forEach((__, j) => {
        const ref = XLSX.utils.encode_cell({ r:4+i, c:j })
        if (wsD[ref]) wsD[ref].s = { ...st(j===0), alignment:{ vertical:'center', horizontal: j===0?'left':'center', wrapText: j===13 } }
      })
    })
    wsD['!cols'] = [10,5,14,14,28,8,12,18,12,12,16,14,10,28].map(w => ({ wch:w }))
    wsD['!rows'] = [{ hpt:28 },{ hpt:16 },,{ hpt:20 }]
    XLSX.utils.book_append_sheet(wb, wsD, 'Detalhamento')
    const byDriver = {}
    filtered.forEach(c => { const d = c.driver || 'Sem motorista'; if (!byDriver[d]) byDriver[d] = []; byDriver[d].push(c) })
    const mHeaders = ['Motorista','Total','Guindauto','Frete Mills','Frete Cliente','Estados','Críticos/Altos']
    const mRows = Object.entries(byDriver)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, cs]) => [
        name, cs.length,
        cs.filter(c => c.type === 'guindauto').length,
        cs.filter(c => c.type === 'freteMillsInterno').length,
        cs.filter(c => c.type === 'freteCliente').length,
        new Set(cs.map(c => c.destination || c.origin).filter(Boolean)).size,
        cs.filter(c => c.urgency === 'critico' || c.urgency === 'alto').length,
      ])
    const wsM = XLSX.utils.aoa_to_sheet([
      ['Mills Pesados · Consolidado por Motorista', ...Array(6).fill('')],
      [`Período: ${fmt(dateFrom)} a ${fmt(dateTo)}`, ...Array(6).fill('')],
      Array(7).fill(''),
      mHeaders,
      ...mRows,
    ])
    wsM['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:1,c:0}, e:{r:1,c:6} }]
    wsM['A1'].s = hGreen
    wsM['A2'].s = subInfo
    mHeaders.forEach((_, i) => { const ref = XLSX.utils.encode_cell({ r:3, c:i }); if (wsM[ref]) wsM[ref].s = hOrange })
    mRows.forEach((_, i) => {
      const st = i % 2 === 0 ? rowEven : rowOdd
      mHeaders.forEach((__, j) => {
        const ref = XLSX.utils.encode_cell({ r:4+i, c:j })
        if (wsM[ref]) wsM[ref].s = { ...st(j===0), alignment:{ vertical:'center', horizontal: j===0?'left':'center' } }
      })
    })
    wsM['!cols'] = [24,8,12,12,12,10,12].map(w => ({ wch:w }))
    wsM['!rows'] = [{ hpt:28 },{ hpt:16 },,{ hpt:20 }]
    XLSX.utils.book_append_sheet(wb, wsM, 'Por Motorista')
    const fname = `mills_frotas_${dateFrom}_a_${dateTo}${driver !== 'todos' ? '_' + driver.split(' ')[0] : ''}.xlsx`
    XLSX.writeFile(wb, fname)
    setDone(true)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:520, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>📊 Exportar Relatório Excel</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, padding:'14px 16px', marginBottom:14 }}>
          <label style={LS}>📅 Período</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center', marginTop:6 }}>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDone(false) }} style={IS}/>
            <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center' }}>até</span>
            <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setDone(false) }} style={IS}/>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
            {[
              ['Esta semana',     getWeekDays(today)[0], getWeekDays(today)[6]],
              ['Este mês',        `${today.slice(0,7)}-01`, `${today.slice(0,7)}-${new Date(Number(today.slice(0,4)), Number(today.slice(5,7)), 0).getDate().toString().pad
