import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }         from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, useDrivers } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, ServiceCard, BrazilMap, MoveModal, NotificationBell, ClientInput } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, buildReport, downloadTxt, sendTeamsNotification, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import Papa from 'papaparse'

// ==========================================
// 1. COMPONENTE: UPLOAD DE CSV
// ==========================================
function CsvUploadModal({ onLoaded, onClose }) {
  const [parsing, setParsing] = useState(false)
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped = parseSIMCsv(results.data)
        onLoaded(mapped)
        setParsing(false)
        onClose()
      },
      error: () => {
        setParsing(false)
        alert('Erro ao ler arquivo CSV.')
      }
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:400, boxShadow:T.shadowLg }}>
        <h3 style={{ margin:'0 0 12px', fontFamily:FONT }}>📊 Importar Base SIM (.csv)</h3>
        <input type="file" accept=".csv" onChange={handleFile} disabled={parsing} style={{ marginBottom:16, display:'block', width:'100%' }} />
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec }}>Cancelar</button>
        </div>
      </motion.div>
    </div>
  )
}

// ==========================================
// 2. COMPONENTE: SUBTIPO SELECT
// ==========================================
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

// ==========================================
// 3. COMPONENTE: MODAL DE EDICAO/CRIACAO DE CARD
// ==========================================
function CardModal({ card, defaultDate, simClients, onSave, onClose, onDelete }) {
  const blank = { type:'freteMillsInterno', subtype:'', client:'', clientState:'', clientCity:'', urgency:'medio', machine:'', om:'', nInterno:'', plantaObra:'', calendarStatus:'em_dia', origin:'SP', destination:'SP', startDate:defaultDate||todayStr(), endDate:defaultDate||todayStr(), notes:'', driver:'', unit:'' }
  const [form, setForm] = useState(card || blank)
  const [saving, setSaving] = useState(false)
  
  // Autocomplete Corrigido do Equipamento/Frota (Filtro case-insensitive)
  const [searchTerm, setSearchTerm] = useState(form.nInterno || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const MASTER_FROTAS = ['PCP01730', 'PCP01120', 'PCP01540', 'PCP01890', 'MUN02210', 'MUN01430', 'PA150', 'PA210']

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
          
          <div style={{ position: 'relative' }}>
            <label style={LS}>N° Interno (Frota)</label>
            <input value={searchTerm} onChange={e=>{ setSearchTerm(e.target.value); set('nInterno', e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} placeholder="Ex: PCP01730" style={IS}/>
            {showDropdown && (
              <div style={{ position:'absolute', top:'62px', left:0, right:0, background:'white', border:`1px solid ${T.border}`, borderRadius:4, zIndex:1100, overflowY:'auto', maxHeight:150, boxShadow:T.shadowMd }}>
                {filteredFrotas.map(f => (
                  <div key={f} onClick={()=>{ set('nInterno', f); setSearchTerm(f); setShowDropdown(false); }} style={{ padding:'8px 12px', cursor:'pointer', fontFamily:FONT, fontSize:13 }} onMouseEnter={e=>e.currentTarget.style.background='#FFF3E8'} onMouseLeave={e=>e.currentTarget.style.background='none'}>🚚 {f}</div>
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
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:18 }}>
          {card ? (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onDelete(card.id)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40` }}>🗑 Excluir</button>
              <button onClick={async ()=>{ if(confirm('Deseja cancelar este serviço permanentemente?')){ await onSave({...form, calendarStatus:'cancelado'}); onClose(); } }} style={{ ...BS, background:'#FFF0F0', color:T.perigo, border:'1px solid #FFC1C1' }}>❌ Cancelar Serviço</button>
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

// ==========================================
// 4. COMPONENTE: REVIEW DE SOLICITAÇÃO
// ==========================================
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
        </div>
        <div>
          <label style={LS}>Resposta / observações para o solicitante</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Mensagem..." style={{ ...IS, height:80 }}/>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:12 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec }}>Cancelar</button>
          <button onClick={()=>handle('recusado')} disabled={saving} style={{ ...BS, background:T.perigoLight, color:T.perigo }}>❌ Recusar</button>
          <button onClick={()=>handle('aceito')} disabled={saving} style={{ ...BS, background:T.verde, color:'white' }}>✅ Aceitar</button>
        </div>
      </motion.div>
    </div>
  )
}

// ==========================================
// 5. COMPONENTE: EXPORTAR RELATÓRIO
// ==========================================
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
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:480 }}>
        <h2 style={{ margin:0, fontFamily:FONT }}>📤 Exportar Relatório</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
          {drivers.map(d => {
            const count = countFor(d), isDone = done.includes(d)
            return (
              <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:isDone?T.verdeLight:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
                <div><strong>{d}</strong><div>{count} serviços</div></div>
                <button onClick={()=>handleExport(d)} disabled={count===0} style={BS}>{isDone?'✓ Baixado':'⬇ Baixar'}</button>
              </div>
            )
          })}
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
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:500 }}>
        <h2 style={{ margin:0 }}>⚙️ Configurações</h2>
        <input value={webhook} onChange={e=>setWebhook(e.target.value)} style={{ ...IS, marginTop:12 }} placeholder="Teams Webhook URL"/>
        <button onClick={handleSave} style={{ ...BS, background:T.laranja, color:'white', marginTop:12 }}>💾 Salvar</button>
      </motion.div>
    </div>
  )
}

// ==========================================
// VISÕES DE GRID DO CALENDÁRIO
// ==========================================
function WeekView({ cards, baseDate, conflicts, onEdit, onAddCard, onMoveCard }) {
  const days = getWeekDays(baseDate)
  const [dragCard, setDragCard] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [pending, setPending]   = useState(null)
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason => { const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000; const ne=new Date(pending.card.endDate); ne.setDate(ne.getDate()+diff); onMoveCard(pending.card.id, pending.tgt, ne.toISOString().split('T')[0], reason); setPending(null) }}
        onCancel={() => setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:7, flex:1 }}>
        {days.map((day, idx) => {
          const dc = cardsForDay(cards, day).filter(c => c.calendarStatus !== 'cancelado')
          return (
            <div key={day} onDragOver={e=>{e.preventDefault();setDragOver(day);}} onDragLeave={()=>setDragOver(null)}
              onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);setDragOver(null);}}
              style={{ background:dragOver===day?'#FFF3E8':day===todayStr()?'#FFFAF5':T.surface, border:`1.5px solid ${T.border}`, borderRadius:T.r, padding:9, display:'flex', flexDirection:'column', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                <div><strong>{WD_SHORT[idx]}</strong> <div style={{ fontSize:20 }}>{day.split('-')[2]}</div></div>
                <button onClick={()=>onAddCard(day)} style={{ background:T.laranjaLight, color:T.laranja, border:'none', borderRadius:4, width:22, height:22, cursor:'pointer' }}>+</button>
              </div>
              {dc.map(c => <ServiceCard key={c.id} card={c} conflicts={conflicts} onEdit={onEdit} onDragStart={(e,c2)=>{setDragCard(c2);e.dataTransfer.effectAllowed='move';}}/>)}
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
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
      {pending && <MoveModal card={pending.card} targetDate={pending.tgt}
        onConfirm={reason=>{const diff=(new Date(pending.tgt)-new Date(pending.card.startDate))/86400000;const ne=new Date(pending.card.endDate);ne.setDate(ne.getDate()+diff);onMoveCard(pending.card.id,pending.tgt,ne.toISOString().split('T')[0],reason);setPending(null);}}
        onCancel={()=>setPending(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {weeks.map((wk,wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, width:'700%' }}>
            {wk.map((day,di) => {
              if (!day) return <div key={di} style={{ minHeight:70, background:T.bg }}/>
              const dc = cardsForDay(cards, day).filter(c => c.calendarStatus !== 'cancelado')
              return (
                <div key={day} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragCard&&day!==dragCard.startDate)setPending({card:dragCard,tgt:day});setDragCard(null);}}
                  style={{ background:T.surface, border:`1px solid ${T.border}`, padding:5, minHeight:75 }}>
                  <div style={{ fontWeight:700 }}>{day.split('-')[2]}</div>
                  {dc.slice(0,3).map(c => (
                    <div key={c.id} onClick={()=>onEdit(c)} style={{ background:CARD_TYPES[c.type]?.bg, borderLeft:`3px solid ${CARD_TYPES[c.type]?.color}`, fontSize:10, padding:2, marginBottom:2, cursor:'pointer' }}>{c.client}</div>
                  ))}
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
        return (
          <div key={name} onClick={()=>onMonthClick(mi)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, padding:13, cursor:'pointer' }}>
            <strong>{name}</strong>
            <div style={{ marginTop:6, fontSize:12, color:T.textSec }}>{mc.length} serviços agendados</div>
          </div>
        )
      })}
    </div>
  )
}

function RequestsKanban({ requests, teamsWebhookUrl, onRespond }) {
  const [reviewing, setReviewing] = useState(null)
  const groups = { pendente: requests.filter(r=>r.status==='pendente'), aceito: requests.filter(r=>r.status==='aceito'), recusado: requests.filter(r=>r.status==='recusado') }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, height:'100%' }}>
      {reviewing && <RequestReviewModal req={reviewing} teamsWebhookUrl={teamsWebhookUrl} onRespond={onRespond} onClose={()=>setReviewing(null)}/>}
      {['pendente','aceito','recusado'].map(col => (
        <div key={col} style={{ background:T.surfaceAlt, padding:14, borderRadius:T.rLg }}>
          <h4 style={{ textTransform:'uppercase', margin:'0 0 12px' }}>{col} ({groups[col].length})</h4>
          {groups[col].map(r => (
            <div key={r.id} onClick={()=>col==='pendente'&&setReviewing(r)} style={{ background:'white', padding:10, marginBottom:8, borderRadius:4, border:`1px solid ${T.border}`, cursor:col==='pendente'?'pointer':'default' }}>
              <strong>{r.requesterName}</strong><div>{r.machine} | {fmt(r.desiredDate)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ==========================================
// 6. COMPONENTE PRINCIPAL MESTRE: MASTERVIEW
// ==========================================
export function MasterView() {
  const { user, logout } = useAuth() // Recuperado o Botão e Contexto de Logout
  const { addToast, toasts, removeToast } = useToasts()
  const { cards, saveCard, deleteCard, moveCard } = useCards()
  const { requests, respondRequest } = useRequests()
  const { simClients, setSimClients } = useSimClients() // Upload da Base SIM conectado
  const { config, saveConfig } = useConfig()

  const [view, setView] = useState('week')
  const [baseDate, setBaseDate] = useState(todayStr())
  const [editing, setEditing] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCsvUpload, setShowCsvUpload] = useState(false) // Estado do Modal de CSV ativado

  const curYear = parseInt(baseDate.split('-')[0]), curMonth = parseInt(baseDate.split('-')[1]) - 1
  const weekDays = getWeekDays(baseDate)
  const conflicts = detectConflicts(cards)

  // ==========================================
  // LOGICA DOS KPIS DO DASHBOARD RESTAURADA
  // ==========================================
  const activeCards = cards.filter(c => c.calendarStatus !== 'cancelado')
  const totalAgendados = activeCards.length
  const totalPendentes = requests.filter(r => r.status === 'pendente').length
  const totalConflitos = conflicts.length

  const changeDate = days => {
    const d = new Date(baseDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setBaseDate(d.toISOString().split('T')[0])
  }

  // Correção da persistência do remanejamento por Arrastar
  const handleMoveCard = async (id, newStart, newEnd, reason) => {
    try {
      const cardOriginal = cards.find(c => c.id === id)
      if (!cardOriginal) return
      await moveCard(id, cardOriginal.laneId || 'agendado', user?.email, reason)
      await saveCard({ ...cardOriginal, startDate: newStart, endDate: newEnd })
      addToast({ type:'success', title:'Sucesso', text:'Serviço remanejado no calendário!' })
    } catch(e) {
      addToast({ type:'conflict', title:'Erro', text:'Erro ao salvar o novo dia.' })
    }
  }

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:T.bg, padding:'16px 24px', boxSizing:'border-box' }}>
      
      {/* HEADER PRINCIPAL COM LOGOUT E ACTIONS */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <MillsLogo height={28}/>
          <div style={{ display:'flex', background:T.surfaceAlt, padding:3, borderRadius:T.r, border:`1px solid ${T.border}` }}>
            {[['week','Semana'],['month','Mês'],['year','Ano'],['requests','Solicitações']].map(([v,l]) => (
              <button key={v} onClick={()=>setView(v)} style={{ border:'none', background:view===v?T.surface:'none', color:view===v?T.laranja:T.textSec, fontWeight:view===v?700:500, fontFamily:FONT, fontSize:12, padding:'6px 14px', borderRadius:T.rSm, cursor:'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
        
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>setShowCsvUpload(true)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>📊 Importar SIM</button>
          <button onClick={()=>setShowExport(true)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>📤 Exportar</button>
          <button onClick={()=>setShowSettings(true)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>⚙️</button>
          <NotificationBell/>
          <div style={{ width:1, height:20, background:T.border }}/>
          <span style={{ fontFamily:FONT, fontSize:12 }}><strong>{user?.email}</strong></span>
          <button onClick={() => logout()} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:'none', fontWeight:700 }}>Sair 🚪</button>
        </div>
      </header>

      {/* DASHBOARD DE KPIS DO TOP RESTAURADO */}
      <section style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:16 }}>
        <div style={{ background:T.surface, padding:16, borderRadius:T.r, border:`1px solid ${T.border}`, boxShadow:T.shadowSm }}>
          <div style={{ color:T.textMuted, fontSize:12, fontFamily:FONT }}>🗓️ TOTAL DE AGENDAMENTOS</div>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, marginTop:4 }}>{totalAgendados}</div>
        </div>
        <div style={{ background:T.surface, padding:16, borderRadius:T.r, border:`1px solid ${T.border}`, boxShadow:T.shadowSm }}>
          <div style={{ color:T.textMuted, fontSize:12, fontFamily:FONT }}>⏳ SOLICITAÇÕES PENDENTES</div>
          <div style={{ fontSize:24, fontWeight:700, color:T.amarelo, marginTop:4 }}>{totalPendentes}</div>
        </div>
        <div style={{ background:T.surface, padding:16, borderRadius:T.r, border:`1px solid ${T.border}`, boxShadow:T.shadowSm }}>
          <div style={{ color:T.textMuted, fontSize:12, fontFamily:FONT }}>⚠ CONFLITOS DE LOGÍSTICA</div>
          <div style={{ fontSize:24, fontWeight:700, color:T.perigo, marginTop:4 }}>{totalConflitos}</div>
        </div>
      </section>

      {/* CONTROLADOR DE DATAS E NAVEGAÇÃO */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {view==='week' && (
            <>
              <button onClick={()=>changeDate(-7)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>◀</button>
              <span style={{ fontFamily:FONT, fontWeight:700 }}>{fmt(weekDays[0])} — {fmt(weekDays[6])}</span>
              <button onClick={()=>changeDate(7)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>▶</button>
            </>
          )}
          {view==='month' && (
            <>
              <button onClick={()=>changeDate(-30)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>◀</button>
              <span style={{ fontFamily:FONT, fontWeight:700 }}>{MONTH_NAMES[curMonth]} de {curYear}</span>
              <button onClick={()=>changeDate(30)} style={{ ...BS, background:T.surface, border:`1px solid ${T.border}` }}>▶</button>
            </>
          )}
        </div>
        {view!=='requests' && <button onClick={()=>setEditing({})} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>➕ Novo Serviço</button>}
      </div>

      {/* GRID DO MAPA DO BRASIL E CALENDÁRIO LADO A LADO */}
      <div style={{ flex:1, display:'flex', gap:16, minHeight:0 }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
          {view==='week' && <WeekView cards={cards} baseDate={baseDate} conflicts={conflicts} onEdit={setEditing} onAddCard={d=>setEditing({startDate:d,endDate:d})} onMoveCard={handleMoveCard}/>}
          {view==='month' && <MonthView cards={cards} year={curYear} month={curMonth} conflicts={conflicts} onEdit={setEditing} onAddCard={d=>setEditing({startDate:d,endDate:d})} onMoveCard={handleMoveCard}/>}
          {view==='year' && <YearView cards={cards} year={curYear} onMonthClick={m=>{setBaseDate(`${curYear}-${String(m+1).padStart(2,'0')}-01`);setView('month');}}/>}
          {view==='requests' && <RequestsKanban requests={requests} teamsWebhookUrl={config?.teamsWebhookUrl} onRespond={respondRequest}/>}
        </div>
        
        {/* MAPA DO BRASIL INTEGRADO NA LATERAL DIREITA DO MASTER */}
        {view !== 'requests' && (
          <div style={{ width:320, background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:14, display:'flex', flexDirection:'column', boxShadow:T.shadow }}>
            <h3 style={{ margin:'0 0 10px', fontSize:14, fontFamily:FONT }}>📍 Mapa de Atendimento Mills</h3>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:T.surfaceAlt, borderRadius:T.r }}>
              <BrazilMap cards={activeCards} />
            </div>
          </div>
        )}
      </div>

      {/* ANIMACOES E MODAIS REATIVADOS */}
      <AnimatePresence>
        {editing && <CardModal card={editing.id?editing:null} defaultDate={editing.startDate} simClients={simClients} onSave={async f=>{await saveCard(f); setEditing(null); addToast({type:'success',title:'Salvo',text:'Alterações registradas com sucesso.'})}} onDelete={async id=>{if(confirm('Excluir permanentemente?')){await deleteCard(id);setEditing(null);addToast({type:'success',title:'Excluído',text:'Serviço removido.'})}}} onClose={()=>setEditing(null)} />}
        {showExport && <ExportModal cards={cards} weekDays={weekDays} conflicts={conflicts} onClose={()=>setShowExport(false)}/>}
        {showSettings && <SettingsModal config={config} onSave={saveConfig} onClose={()=>setShowSettings(false)}/>}
        {showCsvUpload && <CsvUploadModal onLoaded={setSimClients} onClose={()=>setShowCsvUpload(false)} />}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onClose={removeToast}/>
    </div>
  )
}
