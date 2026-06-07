import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { T, FONT, CARD_TYPES, URGENCY, BR_STATES, MUNICIPIOS } from '../lib/constants'
import { fmt } from '../lib/utils'

export function MillsLogo({ height=32 }) {
  return (
    <svg height={height} viewBox="0 0 120 34" fill="none" style={{ flexShrink:0 }}>
      <rect width="120" height="34" rx="7" fill={T.laranja}/>
      <text x="9" y="24" fontFamily="Nunito, Arial Rounded MT Bold, sans-serif"
        fontWeight="900" fontSize="21" fill="white" letterSpacing="-0.3">mills</text>
      <rect x="70" y="6" width="6" height="6" rx="1.2" fill="white" opacity="0.9"/>
    </svg>
  )
}

export function MillsPattern({ opacity=0.07, color=T.laranja }) {
  const heights = [18,10,22,8,16,12,20,6,14,24,10,18,8,22,12,16,20,8,14,18]
  return (
    <svg style={{ position:'absolute', bottom:0, left:0, right:0, width:'100%', height:40, overflow:'hidden', pointerEvents:'none' }}
      viewBox="0 0 640 40" preserveAspectRatio="xMidYMax slice">
      {Array.from({length:36},(_,i) => (
        <rect key={i} x={i*18+2} y={40-heights[i%heights.length]} width="7" height={heights[i%heights.length]} rx="2"
          fill={color} opacity={opacity}/>
      ))}
    </svg>
  )
}

const TOAST_COLORS = { conflict:T.amarelo, late:T.perigo, accepted:T.verde, rejected:T.perigo, info:T.info, success:T.verde }
const TOAST_LABELS = { conflict:'⚠ Otimização', late:'🔴 Atrasado', accepted:'✅ Aceito', rejected:'❌ Recusado', info:'ℹ Info', success:'✅ Sucesso' }

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position:'fixed', top:70, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8, maxWidth:360, pointerEvents:'none' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ x:400, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:400, opacity:0 }}
            transition={{ type:'spring', damping:22, stiffness:220 }}
            style={{ background:T.surface, border:`2px solid ${TOAST_COLORS[t.type]||T.info}`, borderRadius:T.rLg,
              padding:'12px 14px', boxShadow:T.shadowLg, position:'relative', overflow:'hidden', pointerEvents:'all' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:TOAST_COLORS[t.type]||T.info, borderRadius:'4px 0 0 4px' }}/>
            <div style={{ paddingLeft:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:T.text, textTransform:'uppercase' }}>{TOAST_LABELS[t.type]||'Info'}</span>
                <button onClick={()=>onDismiss(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:18 }}>×</button>
              </div>
              <p style={{ fontFamily:FONT, fontSize:12, color:T.textSec, margin:'3px 0 0', lineHeight:1.4 }}>{t.msg}</p>
            </div>
            <motion.div initial={{ scaleX:1 }} animate={{ scaleX:0 }} transition={{ duration:7, ease:'linear' }}
              style={{ position:'absolute', bottom:0, left:0, height:2.5, background:TOAST_COLORS[t.type]||T.info, transformOrigin:'left' }}
              onAnimationComplete={()=>onDismiss(t.id)}/>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const add     = (msg, type='info') => setToasts(p => [...p, { id:Date.now()+Math.random(), msg, type }])
  const dismiss = id => setToasts(p => p.filter(t => t.id !== id))
  return { toasts, add, dismiss }
}

export function NotificationBell({ notifications, unreadCount, onMarkAllRead }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>{ setOpen(o=>!o); if(unreadCount) onMarkAllRead() }}
        style={{ background:unreadCount?T.laranjaLight:T.surfaceAlt, border:`1px solid ${unreadCount?T.laranja+'60':T.border}`,
          borderRadius:T.r, color:unreadCount?T.laranja:T.textSec, padding:'6px 12px', cursor:'pointer', position:'relative', fontFamily:FONT }}>
        🔔
        {unreadCount>0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:800, padding:'1px 5px', fontFamily:FONT }}>{unreadCount}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
            style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:320, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rLg, boxShadow:T.shadowLg, zIndex:999 }}>
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontFamily:FONT, fontWeight:800, fontSize:12, color:T.text }}>Notificações</span>
              {notifications.length>0 && <button onClick={onMarkAllRead} style={{ background:'none', border:'none', cursor:'pointer', color:T.laranja, fontSize:11, fontFamily:FONT, fontWeight:700 }}>Marcar todas lidas</button>}
            </div>
            <div style={{ maxHeight:280, overflowY:'auto' }}>
              {notifications.length===0 && <p style={{ padding:14, color:T.textMuted, fontFamily:FONT, fontSize:12, margin:0, textAlign:'center' }}>Nenhuma notificação.</p>}
              {notifications.slice(0,10).map(n => (
                <div key={n.id} style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`, background:n.read?T.surface:T.laranjaXLight }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{n.title}</div>
                  <div style={{ fontFamily:FONT, fontSize:11, color:T.textSec }}>{n.message}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ClientInput({ value, onChange, simClients }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState(value?.name||'')
  const filtered = search.length>1 ? simClients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).slice(0,8) : []
  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e=>{ setSearch(e.target.value); setOpen(true); if(!e.target.value) onChange(null) }}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)}
        placeholder="Digite a planta ou obra..." style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }} autoComplete="off"/>
      {open && filtered.length>0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:220, overflowY:'auto' }}>
          {filtered.map(c => (
            <div key={c.name} onMouseDown={()=>{ onChange(c); setSearch(c.name); setOpen(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.background=T.laranjaXLight}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{c.name}</div>
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>
                {c.city?`${c.city} — `:''}{c.state} · {c.segment} · {c.machines} máq.
                {c.nInternos?.length>0 && <span style={{ color:T.info }}> · N°: {c.nInternos.slice(0,3).join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FrotaInput({ value, onChange, simClients }) {
  const [search, setSearch]   = useState(value||'')
  const [open, setOpen]       = useState(false)
  const [notFound, setNotFound] = useState(false)
  const allFrotas = simClients.flatMap(c=>(c.nInternos||[]).map(n=>({ nInterno:n, client:c.name, state:c.state })))
  const filtered  = search.length>=2 ? allFrotas.filter(f=>f.nInterno.toLowerCase().includes(search.toLowerCase())).slice(0,8) : []

  const handleBlur = () => {
    setTimeout(()=>{
      setOpen(false)
      if (search.length>=2 && filtered.length===0) setNotFound(true)
      else setNotFound(false)
    }, 180)
  }

  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e=>{ setSearch(e.target.value); setOpen(true); onChange(e.target.value); setNotFound(false) }}
        onFocus={()=>setOpen(true)} onBlur={handleBlur}
        placeholder="Ex: 1234"
        style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${notFound?T.perigo:T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }} autoComplete="off"/>
      {notFound && (
        <div style={{ marginTop:5, padding:'7px 10px', background:T.perigoLight, borderRadius:T.rSm, color:T.perigo, fontSize:11, fontFamily:FONT, fontWeight:700 }}>
          ⚠️ Frota não encontrada. Entre em contato com a Gestão de Frotas.
        </div>
      )}
      {open && filtered.length>0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:200, overflowY:'auto' }}>
          {filtered.map((f,i) => (
            <div key={i} onMouseDown={()=>{ onChange(f.nInterno); setSearch(f.nInterno); setOpen(false); setNotFound(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.background=T.laranjaXLight}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{f.nInterno}</div>
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{f.client} · {f.state}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MunicipioInput({ value, onChange, placeholder='Cidade...' }) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState(value ? `${value.m} (${value.s})` : '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const buscar = async (texto) => {
    if (texto.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`)
      const data = await res.json()
      const filtered = data
        .filter(m => m.nome.toLowerCase().includes(texto.toLowerCase()))
        .slice(0, 10)
        .map(m => ({ m: m.nome, s: m.microrregiao.mesorregiao.UF.sigla }))
      setResults(filtered)
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); buscar(e.target.value); if(!e.target.value) onChange(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }}
        autoComplete="off"/>
      {loading && <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12 }}>⏳</div>}
      {open && results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:220, overflowY:'auto' }}>
          {results.map((m,i) => (
            <div key={i} onMouseDown={() => { onChange(m); setSearch(`${m.m} (${m.s})`); setOpen(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.laranjaXLight}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}>
              <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{m.m}</span>
              <span style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}> — {m.s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ServiceCard({ card, conflicts, onEdit, onDragStart, compact=false }) {
  const ct  = CARD_TYPES[card.type]
  const ug  = URGENCY[card.urgency]
  const hasConf = conflicts?.some(c=>c.a===card.id||c.b===card.id)
  const isLate  = card.calendarStatus === 'atrasado'
  return (
    <motion.div layout whileHover={{ y:-1, boxShadow:T.shadowMd }}
      draggable onDragStart={e=>onDragStart?.(e,card)} onClick={()=>onEdit?.(card)}
      style={{ borderRadius:T.r, border:`2px solid ${ct?.color}`, background:ct?.bg,
        padding:compact?'5px 7px':'9px 11px', cursor:'grab', marginBottom:4,
        position:'relative', userSelect:'none',
        boxShadow:hasConf?`0 0 0 2px ${T.amarelo},${T.shadow}`:isLate?`0 0 0 2px ${T.perigo},${T.shadow}`:T.shadow }}>
      {hasConf && <div style={{ position:'absolute', top:-8, right:6, background:T.amarelo, color:'#000', fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>OTIMIZAR</div>}
      {isLate   && <div style={{ position:'absolute', top:-8, left:6, background:T.perigo, color:'#fff', fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>ATRASADO</div>}
      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:compact?1:4 }}>
        <span style={{ fontSize:compact?10:12 }}>{ct?.icon}</span>
        <span style={{ color:ct?.color, fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:FONT }}>{ct?.short}</span>
        <span style={{ marginLeft:'auto', fontSize:compact?9:11 }}>{ug?.icon}</span>
      </div>
      <div style={{ color:T.text, fontWeight:800, fontSize:compact?10:12, fontFamily:FONT, marginBottom:compact?0:2, lineHeight:1.2 }}>{card.client}</div>
      {!compact && <>
        {card.subtype && <div style={{ color:ct?.color, fontSize:9, fontFamily:FONT, marginBottom:2, fontWeight:700 }}>{card.subtype.replace(/_/g,' ')}</div>}
        <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT }}>{card.originCity||card.origin||'—'} → {card.destCity||card.destination||'—'}</div>
        {card.nInterno && <div style={{ color:T.info, fontSize:9, fontFamily:FONT, fontWeight:700 }}>🔢 {card.nInterno}</div>}
        {card.driver   && <div style={{ color:T.verde, fontSize:9, fontFamily:FONT, fontWeight:700 }}>👤 {card.driver}</div>}
      </>}
    </motion.div>
  )
}

export function BrazilMap({ cards }) {
  const [hov, setHov] = useState(null)
  const cnt = {}; const types = {}
  cards.forEach(c => {
    [c.originState||c.origin, c.destState||c.destination].filter(Boolean).forEach(s => {
      cnt[s]=(cnt[s]||0)+1
      if(!types[s]) types[s]=new Set()
      types[s].add(c.type)
    })
  })
  const routes = {}
  cards.filter(c=>(c.originState||c.origin)&&(c.destState||c.destination)).forEach(c=>{
    const o=c.originState||c.origin, d=c.destState||c.destination
    if(o===d) return
    const k=[o,d].sort().join('-')
    if(!routes[k]) routes[k]=[]
    routes[k].push(c)
  })
  const getS = id => BR_STATES.find(s=>s.id===id)
  const getColor = id => {
    const n=cnt[id]||0
    if(!n)  return { fill:'rgba(243,112,33,0.06)', stroke:'rgba(243,112,33,0.18)' }
    if(n===1) return { fill:'rgba(243,112,33,0.28)', stroke:'rgba(243,112,33,0.8)' }
    if(n<=3)  return { fill:'rgba(243,112,33,0.65)', stroke:'rgba(194,64,3,0.9)' }
    return         { fill:'rgba(194,64,3,0.88)',    stroke:'rgba(140,30,0,1)' }
  }

  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:'12px 14px', height:'100%', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', boxShadow:T.shadow }}>
      <MillsPattern opacity={0.05} color={T.laranja}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, position:'relative', zIndex:1, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontFamily:FONT, fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.text }}>🗺 Operações Ativas</span>
          {Object.keys(cnt).length>0 && <span style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:20, padding:'1px 7px', color:T.laranja, fontSize:9, fontWeight:800, fontFamily:FONT }}>{Object.keys(cnt).length} estados</span>}
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[{f:'rgba(243,112,33,0.28)',s:T.laranja,l:'1'},{f:'rgba(243,112,33,0.65)',s:'#C24003',l:'2–3'},{f:'rgba(194,64,3,0.88)',s:'#8B2500',l:'4+'}].map(l=>(
            <div key={l.l} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <div style={{ width:8, height:8, background:l.f, border:`1px solid ${l.s}`, borderRadius:2 }}/>
              <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>
      {hov && cnt[hov] && (
        <div style={{ background:T.verde, color:'white', borderRadius:T.rSm, padding:'3px 10px', marginBottom:4, fontFamily:FONT, fontSize:11, fontWeight:700, display:'inline-flex', gap:8, alignItems:'center', flexShrink:0, position:'relative', zIndex:1 }}>
          <span>{hov} — {cnt[hov]} operaç{cnt[hov]>1?'ões':'ão'}</span>
          {types[hov] && [...types[hov]].map(t=><span key={t} style={{ fontSize:12 }}>{CARD_TYPES[t]?.icon}</span>)}
        </div>
      )}
      <svg viewBox="60 80 560 510" style={{ flex:1, width:'100%', position:'relative', zIndex:1, minHeight:0 }}>
        <defs>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F37021" floodOpacity="0.6"/></filter>
          <filter id="shadow2"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000022"/></filter>
        </defs>
        {BR_STATES.map(s => {
          const {fill,stroke}=getColor(s.id)
          const isActive=!!cnt[s.id], isHov=hov===s.id
          return (
            <g key={s.id} onMouseEnter={()=>setHov(s.id)} onMouseLeave={()=>setHov(null)} style={{ cursor:isActive?'pointer':'default' }}>
              {isActive && <circle cx={s.x} cy={s.y} r={isHov?24:19} fill={fill} opacity={0.2}/>}
              <circle cx={s.x} cy={s.y} r={isActive?(isHov?14:12):5} fill={fill} stroke={stroke}
                strokeWidth={isActive?(isHov?2.5:2):1}
                filter={isActive&&isHov?'url(#glow)':isActive?'url(#shadow2)':undefined}
                style={{ transition:'all .18s' }}/>
              <text x={s.x} y={s.y+(isActive?-15:-7)} textAnchor="middle"
                fill={isActive?T.text:T.textMuted}
                fontSize={isActive?(isHov?10:9):6.5} fontWeight={isActive?'800':'400'}
                fontFamily="Nunito,sans-serif" style={{ pointerEvents:'none' }}>{s.id}</text>
              {isActive && <text x={s.x} y={s.y+4} textAnchor="middle" fill="white"
                fontSize={isHov?10:9} fontWeight="800" fontFamily="Nunito,sans-serif"
                style={{ pointerEvents:'none' }}>{cnt[s.id]}</text>}
            </g>
          )
        })}
        {Object.entries(routes).map(([key,rts])=>{
          const oId=rts[0].originState||rts[0].origin, dId=rts[0].destState||rts[0].destination
          const o=getS(oId), d=getS(dId); if(!o||!d) return null
          const ct=CARD_TYPES[rts[0].type], mx=(o.x+d.x)/2, my=(o.y+d.y)/2-28
          return (
            <g key={key}>
              <path d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`} stroke={ct?.color} strokeWidth={rts.length>1?2.5:1.5} fill="none" strokeDasharray={rts.length>1?'none':'5,4'} opacity={0.7}/>
              <circle cx={mx} cy={my} r={rts.length>1?9:5} fill={rts.length>1?T.amarelo:ct?.bg} stroke={ct?.color} strokeWidth={1.5}/>
              <text x={mx} y={my+4} textAnchor="middle" fill={rts.length>1?'#000':ct?.color} fontSize={rts.length>1?9:7} fontWeight="800" fontFamily="Nunito,sans-serif">{rts.length>1?rts.length:ct?.icon?.slice(0,1)}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ display:'flex', gap:10, marginTop:5, flexShrink:0, flexWrap:'wrap', position:'relative', zIndex:1 }}>
        {Object.entries(CARD_TYPES).map(([k,v])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:3, background:v.color, borderRadius:2 }}/>
            <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{v.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MoveModal({ card, targetDate, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:420, boxShadow:T.shadowLg, border:`2px solid ${T.laranja}` }}>
        <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:17, marginTop:0 }}>⚠️ Justificar Remanejamento</h3>
        <p style={{ color:T.textSec, fontSize:13, fontFamily:FONT, margin:'0 0 13px' }}>
          Mover <strong style={{ color:T.laranja }}>{card?.client}</strong> para <strong>{fmt(targetDate)}</strong>.
        </p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo do reagendamento..."
          style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:76, resize:'vertical' }}/>
        <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'8px 16px', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:12 }}>Cancelar</button>
          <button onClick={()=>reason.trim()&&onConfirm(reason)} disabled={!reason.trim()}
            style={{ background:reason.trim()?T.laranja:'#CCC', color:'white', border:'none', borderRadius:T.r, padding:'8px 16px', cursor:'pointer', fontFamily:FONT, fontWeight:800, fontSize:12 }}>Confirmar</button>
        </div>
      </motion.div>
    </div>
  )
}
