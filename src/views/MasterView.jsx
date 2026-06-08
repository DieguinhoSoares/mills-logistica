import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }         from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, useDrivers } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, ServiceCard, BrazilMap, MoveModal, NotificationBell, ClientInput } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, buildReport, downloadTxt, sendTeamsNotification, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import Papa from 'papaparse'

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

function CardModal({ card, defaultDate, simClients, onSave, onClose, onDelete, userRole }) {
  const blank = { type:'freteMillsInterno', subtype:'', client:'', clientState:'', clientCity:'', urgency:'medio', machine:'', om:'', nInterno:'', plantaObra:'', calendarStatus:'em_dia', origin:'SP', destination:'SP', startDate:defaultDate||todayStr(), endDate:defaultDate||todayStr(), notes:'', driver:'', unit:'' }
  const [form, setForm] = useState(card || blank)
  const [saving, setSaving] = useState(false)
  
  // Estado para autocomplete do N° Interno/Frota (Item 8)
  const [searchTerm, setSearchTerm] = useState(form.nInterno || '')
  const [showDropdown, setShowDropdown] = useState(false)

  // Lista mestre de frotas da Mills incluindo a PCP01730 explicitamente
  const MASTER_FROTAS = [
    'PCP01730', 'PCP01120', 'PCP01540', 'PCP01890', 'MUN02210', 'MUN01430', 'PA150', 'PA210'
  ]

  const filteredFrotas = MASTER_FROTAS.filter(f => 
    f.toUpperCase().includes(searchTerm.toUpperCase())
  )

  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const handleTypeChange = v => setForm(p => ({ ...p, type: v, subtype: '' }))
  
  const handleClientSelect = c => {
    if (!c) return
    setForm(p => ({ ...p, client:c.name, plantaObra:c.name, clientState:c.state, clientCity:c.city, destination:c.state||p.destination, machine:c.families?.[0]||p.machine, nInterno:c.nInternos?.[0]||p.nInterno }))
    if(c.nInternos?.[0]) setSearchTerm(c.nInternos[0])
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
          
          {/* AUTOCOMPLETE CORRIGIDO DA FROTA - ITEM 8 */}
          <div style={{ position: 'relative' }}>
            <label style={LS}>N° Interno (Frota)</label>
            <input 
              value={searchTerm} 
              onChange={e=>{ setSearchTerm(e.target.value); set('nInterno', e.target.value); setShowDropdown(true); }} 
              onFocus={() => setShowDropdown(true)}
              placeholder="Ex: PCP01730" 
              style={IS}
            />
            {showDropdown && (
              <div style={{ position:'absolute', top:'10px', left:0, right:0, background:'white', border:`1px solid ${T.border}`, borderRadius:4, zIndex:1100, maxOverflowY:'auto', maxHeight:150, boxShadow:T.shadowMd }}>
                {filteredFrotas.map(f => (
                  <div key={f} onClick={()=>{ set('nInterno', f); setSearchTerm(f); setShowDropdown(false); }} style={{ padding:'8px 12px', cursor:'pointer', fontFamily:FONT, fontSize:13 }} onMouseEnter={e=>e.currentTarget.style.background='#FFF3E8'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    🚚 {f}
                  </div>
                ))}
              </div>
            )}
          </div>

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
        
        {/* ITEM 1 & 4 - BOTÕES EXCLUSIVOS E CONTROLE DE EXCLUSÃO/CANCELAMENTO */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:18 }}>
          {card ? (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onDelete(card.id)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40` }}>🗑 Excluir</button>
              <button onClick={async ()=>{ if(confirm('Deseja cancelar este serviço aprovado?')){ await onSave({...form, calendarStatus:'cancelado'}); onClose(); } }} style={{ ...BS, background:'#FFF0F0', color:T.perigo, border:'1px solid #FFC1C1' }}>❌ Cancelar Serviço</button>
            </div>
          ) : <div/>}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:700 }}>{saving ? '💾 Salvando...' : '💾 Salvar'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function RequestReviewModal({ req, teamsWebhookUrl, onRespond, onClose }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type], ug = URGENCY[req.urgency]
  const chIcon  = { email:'📧', whatsapp:'💬', teams:'🟦' }
  const chLabel = { email:'E-mail corporativo', whatsapp:'WhatsApp', teams:'Microsoft Teams' }
  const handle = async status => { setSaving(true); await onRespond(req.id, status, note, teamsWebhookUrl); setSaving(false); onClose() }
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
            {[['Solicitante',req.requesterName||'—'],['Unidade',req.unit||'—'],['Equipamento',req.machine||'—'],['Data desejada',fmt(req.desiredDate)],['Rota',`${req.origin} → ${req.destination}`],['Planta/Obra',req.clientName||'—']].map(([label,value]) => (
              <div key={label}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{label}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{value}</div>
              </div>
            ))}
          </div>
          {req.description && <div style={{ marginTop:10, padding:'8px 10px', background:T.surface, borderRadius:T.rSm }}><div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:3 }}>Descrição</div><div style={{ color:T.text, fontSize:12, fontFamily:FONT }}>{req.description}</div></div>}
        </div>
        <div>
          <label style={LS}>Resposta / observações para o solicitante</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Mensagem que será enviada ao solicitante..." style={{ ...IS, height:80, resize:'vertical', width:'100%', marginBottom:12 }}/>
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
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:480, maxHeight:'85vh', overflowY:'auto', boxShadow:T.shadowLg }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>📤 Exportar Relatório</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'0 0 18px' }}>{fmt(weekDays[0])} — {fmt(weekDays[6])} · {weekCards.length} serviço{weekCards.length!==1?'s':''}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {drivers.map(d => {
            const count = countFor(d), isDone = done.includes(d)
            return (
              <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:isDone?T.verdeLight:T.surfaceAlt, border:`1px solid ${isDone?T.verde+'50':T.border}`, borderRadius:T.r }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>{d==='Todos os motoristas'?'👥':'👤'}</span>
                  <div><div style={{ color:T.text, fontFamily:FONT, fontWeight:600, fontSize:13 }}>{d}</div><div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>{count} serviço{count!==1?'s':''}</div></div>
                </div>
                <button onClick={()=>handleExport(d)} disabled={count===0} style={{ ...BS, background:isDone?T.verde:count===0?'#E0E0E0':T.laranja, color:count===0?T.textMuted:'white', fontWeight:700, fontSize:11, minWidth:90, opacity:count===0?.5:1 }}>{isDone?'✓ Baixado':'⬇ Baixar'}</button>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
        </div>
      </motion.div>
    </div>
  )
}

function SettingsModal({ config, onSave, onClose }) {
  const [webhook, setWebhook] = useState(config?.teamsWebhookUrl || '')
  const [saved, setSaved] = useState(false)
  const handleSave = async () => { await onSave({ teamsWebhookUrl: webhook }); setSaved(true); setTimeout(()=>setSaved(false),2000) }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:500, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>⚙️ Configurações</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={LS}>🟦 Microsoft Teams — Incoming Webhook URL</label>
          <input value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder="https://outlook.office.com/webhook/..." style={IS}/>
          <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'8px 0 0', lineHeight:1.5 }}>Teams → Canal de Logística → ··· → Conectores → Incoming Webhook → Configurar → Copiar URL</p>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
          <button onClick={handleSave} style={{ ...BS, background:saved?T.verde:T.laranja, color:'white', fontWeight:700 }}>{saved?'✅ Salvo!':'💾 Salvar'}</button>
        </div>
      </motion.div>
    </div>
  )
}

function WeekView({ cards, baseDate, conflicts, onEdit, onAddCard, onMoveCard }) {
  const days = getWeekDays(baseDate)
  const [dragCard, setDragCard] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [pending, setPending]   = useState(null)
  const t = todayStr()
  return (
    <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason => { const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000; const ne=new Date(pending.card.endDate); ne.setDate(ne.getDate()+diff); onMoveCard(pending.card.id, pending.tgt, ne.toISOString().split('T')[0], reason); setPending(null) }}
        onCancel={() => setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:7, flex:1, minHeight:0 }}>
        {days.map((day, idx) => {
          const dc = cardsForDay(cards, day).filter(c => c.calendarStatus !== 'cancelado'), isToday = day===t, isDO = dragOver===day
          return (
            <div key={day} onDragOver={e=>{e.preventDefault();setDragOver(day);}} onDragLeave={()=>setDragOver(null)}
              onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);setDragOver(null);}}
              style={{ background:isDO?'#FFF3E8':isToday?'#FFFAF5':T.surface, border:`1.5px solid ${isToday?T.laranja:isDO?T.laranja:T.border}`, borderRadius:T.r, padding:9, minHeight:70, display:'flex', flexDirection:'column', overflowY:'auto', boxShadow:isToday?`0 0 0 1px ${T.laranja}40,${T.shadow}`:T.shadow, transition:'all .1s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, flexShrink:0 }}>
                <div>
                  <div style={{ color:T.textMuted, fontSize:9, fontWeight:700, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em' }}>{WD_SHORT[idx]}</div>
                  <div style={{ color:isToday?T.laranja:T.text, fontFamily:FONT, fontWeight:700, fontSize:22, lineHeight:1 }}>{day.split('-')[2]}</div>
                </div>
                <button onClick={()=>onAddCard(day)} style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:T.rSm, color:T.laranja, width:22, height:22, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
              </div>
              {dc.map(c => <ServiceCard key={c.id} card={c} conflicts={conflicts} onEdit={onEdit} onDragStart={(e,c2)=>{setDragCard(c2);e.dataTransfer.effectAllowed='move';}}/>)}
              {!dc.length && <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, textAlign:'center', marginTop:'auto', opacity:.4 }}>—</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({ cards, year, month, conflicts, onEdit, onAddCard, onMoveCard }) {
  const weeks = getMonthWeeks(year, month)
  const [dragCard, setDragCard] = useState(null)
  const [pending, setPending]   = useState(null)
  const t = todayStr()
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason=>{const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000;const ne=new Date(pending.card.endDate);ne.setDate(ne.getDate()+diff);onMoveCard(pending.card.id,pending.tgt,ne.toISOString().split('T')[0],reason);setPending(null);}}
        onCancel={()=>setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3, flexShrink:0 }}>
        {WD_SHORT.map(d => <div key={d} style={{ textAlign:'center', color:T.textMuted, fontSize:9, fontWeight:700, fontFamily:FONT, padding:'3px 0', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>)}
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {weeks.map((wk,wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
            {wk.map((day,di) => {
              if (!day) return <div key={di} style={{ minHeight:70, background:T.bg, borderRadius:T.rSm }}/>
              const dc = cardsForDay(cards, day).filter(c => c.calendarStatus !== 'cancelado'), isToday = day===t
              return (
                <div key={day} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);}} onClick={()=>!dc.length&&onAddCard(day)}
                  style={{ background:isToday?'#FFFAF5':T.surface, border:`1px solid ${isToday?T.laranja:T.border}`, borderRadius:T.rSm, padding:5, minHeight:70, cursor:dc.length?'default':'pointer', transition:'all .1s' }}>
                  <div style={{ color:isToday?T.laranja:T.textSec, fontFamily:FONT, fontWeight:700, fontSize:13, marginBottom:3 }}>{day.split('-')[2]}</div>
                  {dc.slice(0,3).map(c => (
                    <div key={c.id} draggable onDragStart={e=>{setDragCard(c);e.dataTransfer.effectAllowed='move';}} onClick={e=>{e.stopPropagation();onEdit(c);}}
                      style={{ borderLeft:`3px solid ${CARD_TYPES[c.type]?.color}`, background:CARD_TYPES[c.type]?.bg, borderRadius:'0 4px 4px 0', padding:'2px 5px', marginBottom:2, cursor:'pointer' }}>
                      <div style={{ color:T.text, fontSize:9, fontFamily:FONT, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }}>{CARD_TYPES[c.type]?.icon} {c.client}</div>
                    </div>
                  ))}
                  {dc.length > 3 && <div style={{ color:T.textMuted, fontSize:8, fontFamily:FONT }}>+{dc.length-3}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function YearView({ cards, year, onMonthClick }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {MONTH_NAMES.map((name,mi) => {
        const mc = cards.filter(c=>c.startDate?.startsWith(`${year}-${String(mi+1).padStart(2,'0')}`) && c.calendarStatus !== 'cancelado')
        const tc = {}; mc.forEach(c=>{tc[c.type]=(tc[c.type]||0)+1})
        const late = mc.filter(c=>c.status==='atrasado').length
        return (
          <div key={name} onClick={()=>onMonthClick(mi)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, padding:13, cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.laranja;e.currentTarget.style.boxShadow=T.shadowMd;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow='none';}}>
            <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:15, marginBottom:8 }}>{name}</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
              {Object.entries(tc).map(([k,n]) => (
                <div key={k} style={{ background:CARD_TYPES[k]?.bg, border:`1px solid ${CARD_TYPES[k]?.color}40`, borderRadius:6, padding:'1px 7px', color:CARD_TYPES[k]?.color, fontSize:9, fontWeight:700, fontFamily:FONT }}>{CARD_TYPES[k]?.icon} {n}</div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:T.textSec, fontSize:10, fontFamily:FONT }}>{mc.length} serviço{mc.length!==1?'s':''}</span>
              {late>0 && <span style={{ background:T.perigoLight, borderRadius:5, padding:'1px 6px', color:T.perigo, fontSize:9, fontWeight:700, fontFamily:FONT }}>⚠ {late}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RequestsKanban({ requests, teamsWebhookUrl, onRespond }) {
  const [reviewing, setReviewing] = useState(null)
  const groups = { pendente: requests.filter(r=>r.status==='pendente'), aceito: requests.filter(r=>r.status==='aceito'), recusado: requests.filter(r=>r.status==='recusado') }
  const cols = [
    { key:'pendente', label:'⏳ Pendentes', color:T.amarelo, bg:T.amareloLight },
    { key:'aceito',   label:'✅ Aceitas',   color:T.verde,   bg:T.verdeLight   },
    { key:'recusado', label:'❌ Recusadas', color:T.perigo,  bg:T.perigoLight  },
  ]
  return (
    <>
      {reviewing && <RequestReviewModal req={reviewing} teamsWebhookUrl={teamsWebhookUrl} onRespond={onRespond} onClose={()=>setReviewing(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, height:'100%', overflow:'hidden' }}>
        {cols.map(col => (
          <div key={col.key} style={{ background:col.bg, borderRadius:T.rLg, border:`1px solid ${col.color}30`, padding:14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexShrink:0 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:col.color }}/>
              <span style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'0.04em' }}>{col.label}</span>
              <span style={{ marginLeft:'auto', background:col.color, color:'white', borderRadius:20, padding:'0 5px', fontSize:9, fontWeight:800 }}>{groups[col.key].length}</span>
            </div>
            <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
              {groups[col.key].length === 0 && <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, paddingTop:20 }}>—</div>}
              {groups[col.key].map(r => {
                const ct = CARD_TYPES[r.type], ug = URGENCY[r.urgency]
                return (
                  <motion.div key={r.id} layout whileHover={{ y:-1, boxShadow:T.shadowMd }}
                    onClick={() => col.key==='pendente' && setReviewing(r)}
                    style={{ background:T.surface, borderRadius:T.r, padding:'13px 14px', boxShadow:T.shadow, cursor:col.key==='pendente'?'pointer':'default', border:`1px solid ${T.border}`, transition:'all .12s' }}>
                    <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                      <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 8px', color:ct?.color, fontSize:9, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                      <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 8px', color:ug?.color, fontSize:9, fontWeight:700, fontFamily:FONT }}>{ug?.icon}</span>
                      {r.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 8px', color:T.info, fontSize:9, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(r.type, r.subtype)}</span>}
                      <span style={{ marginLeft:'auto', fontSize:11 }}>{r.channel==='teams'?'🟦':r.channel==='whatsapp'?'💬':'📧'}</span>
                    </div>
                    <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT, marginBottom:4 }}>{r.requesterName||'—'}</div>
                    <div style={{ color:T.textSec, fontSize:11, fontFamily:FONT, marginBottom:3 }}>{r.unit}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>🔧 {r.machine||'—'}</span>
                      <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>📅 {fmt(r.desiredDate)}</span>
                    </div>
                    {r.description && <div style={{ marginTop:6, color:T.textMuted, fontSize:10, fontFamily:FONT, fontStyle:'italic' }}>"{r.description.slice(0,60)}{r.description.length>60?'...':''}"</div>}
                    {col.key==='pendente' && <div style={{ marginTop:8, textAlign:'right' }}><span style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}40`, borderRadius:5, padding:'2px 8px', color:T.laranja, fontSize:10, fontWeight:700, fontFamily:FONT }}>Avaliar →</span></div>}
                    {r.responseNote && <div style={{ marginTop:6, padding:'5px 8px', background:col.key==='aceito'?T.verdeLight:T.perigoLight, borderRadius:T.rSm, color:col.key==='aceito'?T.verde:T.perigo, fontSize:10, fontFamily:FONT }}>{r.responseNote}</div>}
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

// CORREÇÃO EXPORTAÇÃO EXPLICITA EXIGIDA PELO APP.TSX (NÃO USAR DEFAULT)
export function MasterView() {
  const { user } = useAuth()
  const { addToast, toasts, removeToast } = useToasts()
  const { cards, saveCard, deleteCard, moveCard } = useCards()
  const { requests, respondRequest } = useRequests()
  const { simClients } = useSimClients()
  const { config, saveConfig } = useConfig()

  const [view, setView] = useState('week')
  const [baseDate, setBaseDate] = useState(todayStr())
  const [editing, setEditing] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const curYear = parseInt(baseDate.split('-')[0]), curMonth = parseInt(baseDate.split('-')[1]) - 1
  const weekDays = getWeekDays(baseDate)
  const conflicts = detectConflicts(cards)

  const changeDate = days => {
    const d = new Date(baseDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setBaseDate(d.toISOString().split('T')[0])
  }

  const changeMonth = mDiff => {
    const d = new Date(curYear, curMonth + mDiff, 1)
    setBaseDate(d.toISOString().split('T')[0])
  }

  // CORREÇÃO: Função que força o salvamento imediato da nova data arrastada no calendário
  const handleMoveCard = async (id, newStart, newEnd, reason) => {
    try {
      const cardOriginal = cards.find(c => c.id === id)
      if (!cardOriginal) return
      
      await moveCard(id, cardOriginal.laneId || 'agendado', user?.email, reason)
      await saveCard({
        ...cardOriginal,
        startDate: newStart,
        endDate: newEnd
      })
      addToast({ type:'success', title:'Remanejado', text:'O dia do serviço foi alterado com sucesso.' })
    } catch(e) {
      addToast({ type:'conflict', title:'Erro', text:'Falha ao salvar remanejamento.' })
    }
  }

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:T.bg, padding:'16px 24px', boxSizing:'border-box' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <MillsLogo height={28}/>
          <div style={{ display:'flex', background:T.surfaceAlt, padding:3, borderRadius:T.r, border:`1px solid ${T.border}` }}>
            {[['week','Semana'],['month','Mês'],['year','Ano'],['requests','Solicitações']].map(([v,l]) => (
              <button key={v} onClick={()=>setView(v)} style={{ border:'none', background:view===v?T.surface:'none', color:view===v?T.laranja:T.textSec, fontWeight:view===v?700:500, fontFamily:FONT, fontSize:12, padding:'6px 14px', borderRadius:T.rSm, cursor:'pointer', boxShadow:view===v?T.shadowSm:'none', transition:'all .1s' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>setShowExport(true)} style={{ ...BS, background:T.surface, color:T.text, border:`1px solid ${T.border}`, fontWeight:600 }}>📤 Exportar</button>
          <button onClick={()=>setShowSettings(true)} style={{ ...BS, background:T.surface, color:T.text, border:`1px solid ${T.border}`, padding:'8px 10px' }}>⚙️</button>
          <NotificationBell/>
          <div style={{ width:1, height:20, background:T.border }}/>
          <span style={{ fontFamily:FONT, fontSize:12, color:T.textSec }}>Perfil: <strong>{user?.email || 'Master'}</strong></span>
        </div>
      </header>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {view==='week' && (
            <>
              <button onClick={()=>changeDate(-7)} style={{ ...BS, padding:'6px 12px', background:T.surface, border:`1px solid ${T.border}` }}>◀</button>
              <span style={{ fontFamily:FONT, fontWeight:700, color:T.text, fontSize:15 }}>{fmt(weekDays[0])} — {fmt(weekDays[6])}</span>
              <button onClick={()=>changeDate(7)} style={{ ...BS, padding:'6px 12px', background:T.surface, border:`1px solid ${T.border}` }}>▶</button>
            </>
          )}
          {view==='month' && (
            <>
              <button onClick={()=>changeMonth(-1)} style={{ ...BS, padding:'6px 12px', background:T.surface, border:`1px solid ${T.border}` }}>◀</button>
              <span style={{ fontFamily:FONT, fontWeight:700, color:T.text, fontSize:15 }}>{MONTH_NAMES[curMonth]} de {curYear}</span>
              <button onClick={()=>changeMonth(1)} style={{ ...BS, padding:'6px 12px', background:T.surface, border:`1px solid ${T.border}` }}>▶</button>
            </>
          )}
          {view==='year' && <span style={{ fontFamily:FONT, fontWeight:700, color:T.text, fontSize:16 }}>Planejamento Anual {curYear}</span>}
        </div>
        {view!=='requests' && <button onClick={()=>setEditing({})} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>➕ Novo Serviço</button>}
      </div>

      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
        {view==='week' && <WeekView cards={cards} baseDate={baseDate} conflicts={conflicts} onEdit={setEditing} onAddCard={d=>setEditing({startDate:d,endDate:d})} onMoveCard={handleMoveCard}/>}
        {view==='month' && <MonthView cards={cards} year={curYear} month={curMonth} conflicts={conflicts} onEdit={setEditing} onAddCard={d=>setEditing({startDate:d,endDate:d})} onMoveCard={handleMoveCard}/>}
        {view==='year' && <YearView cards={cards} year={curYear} onMonthClick={m=>{setBaseDate(`${curYear}-${String(m+1).padStart(2,'0')}-01`);setView('month');}}/>}
        {view==='requests' && <RequestsKanban requests={requests} teamsWebhookUrl={config?.teamsWebhookUrl} onRespond={respondRequest}/>}
      </div>

      <AnimatePresence>
        {editing && <CardModal card={editing.id?editing:null} defaultDate={editing.startDate} simClients={simClients} onSave={async f=>{await saveCard(f); setEditing(null); addToast({type:'success',title:'Salvo',text:'Alterações registradas.'})}} onDelete={async id=>{if(confirm('Excluir permanentemente?')){await deleteCard(id);setEditing(null);addToast({type:'success',title:'Excluído',text:'Serviço removido.'})}}} onClose={()=>setEditing(null)} userRole="master"/>}
        {showExport && <ExportModal cards={cards} weekDays={weekDays} conflicts={conflicts} onClose={()=>setShowExport(false)}/>}
        {showSettings && <SettingsModal config={config} onSave={saveConfig} onClose={()=>setShowSettings(false)}/>}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onClose={removeToast}/>
    </div>
  )
}
