import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { T, CARD_TYPES, URGENCY, BR_STATES, IS, BS } from '../lib/constants'
import { fmt } from '../lib/utils'

/* ══ MILLS LOGO ══════════════════════════════════════════════════════════════ */
export function MillsLogo({ height = 30 }) {
  return (
    <svg height={height} viewBox="0 0 112 30" fill="none">
      <rect width="112" height="30" rx="5" fill="#F37021"/>
      <text x="8" y="21" fontFamily="IBM Plex Sans,sans-serif" fontWeight="700" fontSize="17" fill="white" letterSpacing="-0.5">mills</text>
      <rect x="66" y="8"  width="37" height="2.5" rx="1.25" fill="white" opacity="0.65"/>
      <rect x="66" y="14" width="29" height="2.5" rx="1.25" fill="white" opacity="0.45"/>
      <rect x="66" y="20" width="33" height="2.5" rx="1.25" fill="white" opacity="0.65"/>
    </svg>
  )
}

/* ══ TOAST SYSTEM ════════════════════════════════════════════════════════════ */
const TOAST_COLORS = {
  conflict: T.amarelo, late: T.perigo, accepted: T.verde,
  rejected: T.perigo,  info: T.info,   success:  T.verde,
}
const TOAST_LABELS = {
  conflict: '⚠ Otimização detectada', late:     '🔴 Serviço atrasado',
  accepted: '✅ Aceito',               rejected: '❌ Recusado',
  info:     'ℹ Informação',           success:  '✅ Sucesso',
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position:'fixed', top:68, right:18, zIndex:9999, display:'flex', flexDirection:'column', gap:9, maxWidth:380, pointerEvents:'none' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ x:420, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:420, opacity:0 }}
            transition={{ type:'spring', damping:22, stiffness:220 }}
            style={{ background:T.surface, border:`1.5px solid ${TOAST_COLORS[t.type]||T.info}`,
              borderRadius:T.rLg, padding:'13px 15px', boxShadow:T.shadowLg,
              position:'relative', overflow:'hidden', pointerEvents:'all' }}
          >
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:TOAST_COLORS[t.type]||T.info, borderRadius:'4px 0 0 4px' }}/>
            <div style={{ paddingLeft:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'IBM Plex Sans,sans-serif', fontWeight:700, fontSize:11, color:T.text, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {TOAST_LABELS[t.type]||'Informação'}
                </span>
                <button onClick={() => onDismiss(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:17, lineHeight:1, marginLeft:8, pointerEvents:'all' }}>×</button>
              </div>
              <p style={{ fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, color:T.textSec, margin:'3px 0 0', lineHeight:1.4 }}>{t.msg}</p>
            </div>
            <motion.div initial={{ scaleX:1 }} animate={{ scaleX:0 }} transition={{ duration:7, ease:'linear' }}
              style={{ position:'absolute', bottom:0, left:0, height:2, background:TOAST_COLORS[t.type]||T.info, transformOrigin:'left' }}
              onAnimationComplete={() => onDismiss(t.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const add     = (msg, type='info') => setToasts(p => [...p, { id: Date.now()+Math.random(), msg, type }])
  const dismiss = id => setToasts(p => p.filter(t => t.id !== id))
  return { toasts, add, dismiss }
}

/* ══ NOTIFICATION BELL ════════════════════════════════════════════════════════ */
export function NotificationBell({ notifications, unreadCount, onMarkAllRead }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => { setOpen(o=>!o); if (unreadCount) onMarkAllRead() }}
        style={{ ...BS, background:unreadCount ? T.laranjaLight : T.surfaceAlt,
          border:`1px solid ${unreadCount ? T.laranja+'60' : T.border}`,
          color: unreadCount ? T.laranja : T.textSec, position:'relative', padding:'6px 12px' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white',
            borderRadius:20, fontSize:9, fontWeight:800, padding:'1px 5px', minWidth:14, textAlign:'center' }}>
            {unreadCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:8, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:.97 }}
            style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:340, background:T.surface,
              border:`1px solid ${T.border}`, borderRadius:T.rLg, boxShadow:T.shadowLg, zIndex:999, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'IBM Plex Sans,sans-serif', fontWeight:700, fontSize:12, color:T.text }}>Notificações</span>
              {notifications.length > 0 && <button onClick={onMarkAllRead} style={{ background:'none', border:'none', cursor:'pointer', color:T.laranja, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600 }}>Marcar todas como lidas</button>}
            </div>
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {notifications.length === 0 && <p style={{ padding:16, color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, margin:0, textAlign:'center' }}>Nenhuma notificação.</p>}
              {notifications.slice(0,10).map(n => (
                <div key={n.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`,
                  background: n.read ? T.surface : T.laranjaLight, transition:'all .1s' }}>
                  <div style={{ fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:12, color:T.text, marginBottom:2 }}>{n.title}</div>
                  <div style={{ fontFamily:'IBM Plex Sans,sans-serif', fontSize:11, color:T.textSec }}>{n.message}</div>
                  {n.createdAt?.toDate && <div style={{ fontFamily:'IBM Plex Sans,sans-serif', fontSize:10, color:T.textMuted, marginTop:4 }}>
                    {n.createdAt.toDate().toLocaleString('pt-BR')}
                  </div>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ══ CLIENT AUTOCOMPLETE ═════════════════════════════════════════════════════ */
export function ClientInput({ value, onChange, simClients }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState(value?.name || '')
  const filtered = search.length > 1
    ? simClients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).slice(0,8)
    : []
  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Digite o nome da planta/obra..." style={{ ...IS, paddingRight:30 }} autoComplete="off"
      />
      {value?.name === search && value && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:T.verde, fontSize:14 }}>✓</span>}
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface,
          border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:220, overflowY:'auto' }}>
          {filtered.map(c => (
            <div key={c.name} onMouseDown={() => { onChange(c); setSearch(c.name); setOpen(false) }}
              style={{ padding:'9px 12px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.laranjaLight}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}>
              <div style={{ fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:12, color:T.text }}>{c.name}</div>
              <div style={{ fontFamily:'IBM Plex Sans,sans-serif', fontSize:10, color:T.textMuted }}>
                {c.city ? `${c.city} — ` : ''}{c.state} · {c.segment} · {c.machines} máq.
                {c.nInternos?.length > 0 && ` · N°: ${c.nInternos.slice(0,3).join(', ')}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══ SERVICE CARD ════════════════════════════════════════════════════════════ */
export function ServiceCard({ card, conflicts, onEdit, onDragStart, compact=false }) {
  const ct  = CARD_TYPES[card.type]
  const ug  = URGENCY[card.urgency]
  const hasConf = conflicts?.some(c => c.a === card.id || c.b === card.id)
  const isLate  = card.status === 'atrasado'
  return (
    <motion.div layout whileHover={{ y:-1, boxShadow:T.shadowMd }}
      draggable onDragStart={e => onDragStart?.(e, card)}
      onClick={() => onEdit?.(card)}
      style={{ borderRadius:T.r, border:`2px solid ${ct?.color}`, background:ct?.bg,
        padding: compact ? '7px 9px' : '10px 12px', cursor:'grab', marginBottom:5,
        position:'relative', userSelect:'none',
        boxShadow: hasConf ? `0 0 0 2px ${T.amarelo},${T.shadow}` : isLate ? `0 0 0 2px ${T.perigo},${T.shadow}` : T.shadow,
        transition:'box-shadow .15s' }}
    >
      {hasConf && <div style={{ position:'absolute', top:-8, right:6, background:T.amarelo, color:'#000', fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:4, fontFamily:'IBM Plex Sans,sans-serif', letterSpacing:'0.06em' }}>OTIMIZAR</div>}
      {isLate   && <div style={{ position:'absolute', top:-8, left:6,  background:T.perigo,  color:'#fff', fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:4, fontFamily:'IBM Plex Sans,sans-serif' }}>ATRASADO</div>}
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom: compact ? 2 : 5 }}>
        <span style={{ fontSize: compact ? 11 : 13 }}>{ct?.icon}</span>
        <span style={{ color:ct?.color, fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'IBM Plex Sans,sans-serif' }}>{ct?.short}</span>
        <span style={{ marginLeft:'auto', fontSize: compact ? 10 : 12 }}>{ug?.icon}</span>
      </div>
      <div style={{ color:T.text, fontWeight:700, fontSize: compact ? 11 : 13, fontFamily:'IBM Plex Sans,sans-serif', marginBottom: compact ? 1 : 3, lineHeight:1.2 }}>{card.client}</div>
      {!compact && <>
        {card.subtype && <div style={{ color:ct?.color, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2, fontWeight:600, opacity:0.85 }}>{card.subtype.replace(/_/g,' ')}</div>}
        <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:2 }}>🔧 {card.machine}</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:T.textMuted, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif' }}>📋 {card.om}</span>
          <span style={{ color:T.textMuted, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif' }}>{card.origin}→{card.destination}</span>
        </div>
        {card.nInterno && <div style={{ color:T.info, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif', marginTop:2, fontWeight:600 }}>🔢 {card.nInterno}</div>}
        {card.driver && <div style={{ color:T.verde, fontSize:9, fontFamily:'IBM Plex Sans,sans-serif', marginTop:2, fontWeight:600 }}>👤 {card.driver}</div>}
      </>}
    </motion.div>
  )
}

/* ══ BRAZIL MAP — melhorado ══════════════════════════════════════════════════ */
// Polígonos aproximados dos estados brasileiros para visual mais rico
const STATE_PATHS = {
  AC: "M 68,238 L 110,238 L 118,258 L 100,272 L 68,268 Z",
  AL: "M 542,282 L 560,282 L 564,300 L 548,306 L 536,298 Z",
  AM: "M 100,148 L 240,148 L 258,178 L 248,228 L 200,248 L 148,228 L 100,218 Z",
  AP: "M 398,98 L 434,98 L 438,140 L 410,148 L 390,130 Z",
  BA: "M 440,278 L 548,278 L 560,318 L 538,370 L 498,390 L 448,368 L 430,330 Z",
  CE: "M 490,198 L 556,198 L 562,228 L 532,248 L 488,242 Z",
  DF: "M 412,362 L 432,362 L 434,382 L 414,382 Z",
  ES: "M 498,390 L 530,390 L 532,428 L 508,432 L 494,416 Z",
  GO: "M 352,330 L 422,330 L 428,392 L 400,408 L 352,398 L 340,368 Z",
  MA: "M 404,178 L 488,178 L 492,230 L 448,248 L 406,238 Z",
  MG: "M 410,360 L 534,360 L 548,400 L 520,440 L 454,448 L 408,428 Z",
  MS: "M 290,378 L 366,378 L 370,450 L 320,462 L 282,440 Z",
  MT: "M 228,268 L 344,268 L 352,358 L 284,368 L 228,338 Z",
  PA: "M 294,148 L 434,148 L 438,178 L 418,228 L 366,258 L 294,238 Z",
  PB: "M 538,236 L 580,236 L 578,258 L 536,260 Z",
  PE: "M 490,252 L 578,252 L 582,272 L 494,278 Z",
  PI: "M 440,198 L 490,198 L 492,268 L 440,268 Z",
  PR: "M 310,440 L 402,440 L 406,490 L 340,498 L 300,474 Z",
  RJ: "M 468,414 L 514,414 L 518,444 L 476,448 Z",
  RN: "M 534,216 L 584,216 L 582,238 L 532,238 Z",
  RO: "M 158,258 L 236,258 L 240,328 L 180,338 L 148,308 Z",
  RR: "M 214,98 L 292,98 L 298,158 L 248,168 L 208,148 Z",
  RS: "M 290,488 L 376,488 L 382,556 L 322,568 L 270,540 Z",
  SC: "M 320,466 L 406,466 L 410,500 L 338,508 L 304,490 Z",
  SE: "M 530,280 L 564,280 L 566,308 L 534,312 Z",
  SP: "M 362,408 L 462,408 L 468,464 L 388,472 L 346,448 Z",
  TO: "M 382,238 L 462,238 L 468,330 L 388,338 L 368,298 Z",
}

export function BrazilMap({ cards }) {
  const [hoveredState, setHoveredState] = useState(null)

  // Contagem de operações por estado
  const stateOpsCount = {}
  const stateOpTypes  = {}
  cards.forEach(c => {
    ;[c.origin, c.destination].filter(Boolean).forEach(st => {
      stateOpsCount[st] = (stateOpsCount[st] || 0) + 1
      if (!stateOpTypes[st]) stateOpTypes[st] = new Set()
      stateOpTypes[st].add(c.type)
    })
  })

  // Rotas entre estados
  const routeCounts = {}
  cards.filter(c => c.origin && c.destination && c.origin !== c.destination).forEach(c => {
    const key = [c.origin, c.destination].sort().join('-')
    if (!routeCounts[key]) routeCounts[key] = []
    routeCounts[key].push(c)
  })

  const getS = id => BR_STATES.find(s => s.id === id)

  // Cor de intensidade por qtd de operações
  const getStateColor = (stId) => {
    const count = stateOpsCount[stId] || 0
    if (count === 0) return { fill:'#E8E4DE', stroke:'#CEC8C0', opacity:1 }
    if (count === 1) return { fill:'#FEF0E6', stroke:'#F37021', opacity:1 }
    if (count <= 3)  return { fill:'#F37021', stroke:'#C24003', opacity:0.75 }
    return               { fill:'#C24003', stroke:'#8B2500', opacity:1 }
  }

  const maxOps = Math.max(1, ...Object.values(stateOpsCount))

  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:16, height:'100%', boxShadow:T.shadow, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:T.text, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em' }}>🗺 Operações Ativas</span>
          {Object.keys(stateOpsCount).length > 0 && (
            <span style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}40`, borderRadius:20, padding:'1px 8px', color:T.laranja, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif' }}>
              {Object.keys(stateOpsCount).length} estados
            </span>
          )}
        </div>
        {/* Legenda de intensidade */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:8, color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif' }}>Operações:</span>
          {[
            { fill:'#FEF0E6', stroke:'#F37021', label:'1' },
            { fill:'#F37021', stroke:'#C24003', label:'2–3' },
            { fill:'#C24003', stroke:'#8B2500', label:'4+' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <div style={{ width:10, height:10, background:l.fill, border:`1px solid ${l.stroke}`, borderRadius:2 }}/>
              <span style={{ fontSize:8, color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip estado hovered */}
      {hoveredState && stateOpsCount[hoveredState] && (
        <div style={{ background:T.verde, color:'white', borderRadius:T.rSm, padding:'4px 10px', marginBottom:6, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11, fontWeight:600, display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <span>{hoveredState} — {stateOpsCount[hoveredState]} operaç{stateOpsCount[hoveredState]>1?'ões':'ão'}</span>
          {stateOpTypes[hoveredState] && [...stateOpTypes[hoveredState]].map(t => (
            <span key={t} style={{ fontSize:13 }}>{CARD_TYPES[t]?.icon}</span>
          ))}
        </div>
      )}

      {/* SVG Mapa */}
      <svg viewBox="60 80 560 510" style={{ flex:1, width:'100%' }}>
        <defs>
          <filter id="stateShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000020"/>
          </filter>
          <filter id="activeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F37021" floodOpacity="0.5"/>
          </filter>
        </defs>

        {/* Grade de fundo */}
        <defs>
          <pattern id="mapgrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M30 0L0 0 0 30" fill="none" stroke="#E8E4DE" strokeWidth="0.4"/>
          </pattern>
        </defs>
        <rect x="60" y="80" width="560" height="510" fill="url(#mapgrid)" opacity="0.4"/>

        {/* Polígonos dos estados */}
        {BR_STATES.map(s => {
          const { fill, stroke, opacity } = getStateColor(s.id)
          const isActive  = !!stateOpsCount[s.id]
          const isHovered = hoveredState === s.id
          return (
            <g key={s.id}
              onMouseEnter={() => setHoveredState(s.id)}
              onMouseLeave={() => setHoveredState(null)}
              style={{ cursor: isActive ? 'pointer' : 'default' }}>
              {/* Halo de destaque para estados ativos */}
              {isActive && (
                <circle cx={s.x} cy={s.y} r={isHovered ? 22 : 18}
                  fill={fill} opacity={0.15}
                  style={{ transition:'r .2s, opacity .2s' }}/>
              )}
              {/* Círculo principal do estado */}
              <circle
                cx={s.x} cy={s.y}
                r={isActive ? (isHovered ? 13 : 11) : 5}
                fill={fill}
                stroke={stroke}
                strokeWidth={isActive ? (isHovered ? 2.5 : 2) : 1}
                opacity={opacity}
                filter={isActive && isHovered ? 'url(#activeGlow)' : isActive ? 'url(#stateShadow)' : undefined}
                style={{ transition:'all .18s' }}
              />
              {/* Label do estado */}
              <text
                x={s.x} y={s.y + (isActive ? -15 : -8)}
                textAnchor="middle"
                fill={isActive ? T.text : T.textMuted}
                fontSize={isActive ? (isHovered ? 10 : 9) : 7}
                fontWeight={isActive ? '800' : '400'}
                fontFamily="IBM Plex Sans,sans-serif"
                style={{ transition:'all .18s', pointerEvents:'none' }}
              >{s.id}</text>
              {/* Contador de operações dentro do círculo */}
              {isActive && (
                <text
                  x={s.x} y={s.y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={isHovered ? 10 : 9}
                  fontWeight="800"
                  fontFamily="IBM Plex Sans,sans-serif"
                  style={{ pointerEvents:'none' }}
                >{stateOpsCount[s.id]}</text>
              )}
            </g>
          )
        })}

        {/* Rotas (arcos) entre estados */}
        {Object.entries(routeCounts).map(([key, rts]) => {
          const o = getS(rts[0].origin), d = getS(rts[0].destination)
          if (!o || !d) return null
          const ct  = CARD_TYPES[rts[0].type]
          const mx  = (o.x+d.x)/2, my = (o.y+d.y)/2 - 28
          const isMulti = rts.length > 1
          return (
            <g key={key}>
              <path
                d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`}
                stroke={ct?.color}
                strokeWidth={isMulti ? 2.5 : 1.5}
                fill="none"
                strokeDasharray={isMulti ? 'none' : '5,4'}
                opacity={isMulti ? 0.9 : 0.65}
              />
              {/* Seta de direção */}
              <circle cx={mx} cy={my} r={isMulti ? 8 : 5}
                fill={isMulti ? T.amarelo : ct?.bg}
                stroke={ct?.color} strokeWidth={1.5}/>
              <text x={mx} y={my+4} textAnchor="middle"
                fill={isMulti ? '#000' : ct?.color}
                fontSize={isMulti ? 8 : 7} fontWeight="800"
                fontFamily="IBM Plex Sans,sans-serif">
                {isMulti ? rts.length : ct?.icon?.slice(0,1)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Rodapé com tipo legenda */}
      <div style={{ display:'flex', gap:10, marginTop:8, flexShrink:0, flexWrap:'wrap' }}>
        {Object.entries(CARD_TYPES).map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:3, background:v.color, borderRadius:2 }}/>
            <span style={{ fontSize:8, color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif' }}>{v.short}</span>
          </div>
        ))}
        <div style={{ marginLeft:'auto', color:T.textMuted, fontSize:8, fontFamily:'IBM Plex Sans,sans-serif' }}>
          Passe o mouse sobre um estado
        </div>
      </div>
    </div>
  )
}

/* ══ MOVE MODAL ══════════════════════════════════════════════════════════════ */
export function MoveModal({ card, targetDate, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:420, boxShadow:T.shadowLg, border:`2px solid ${T.laranja}` }}>
        <h3 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:18, marginTop:0 }}>⚠️ Justificar Remanejamento</h3>
        <p style={{ color:T.textSec, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif', margin:'0 0 14px' }}>
          Mover <strong style={{ color:T.laranja }}>{card?.client}</strong> para <strong>{fmt(targetDate)}</strong>.
        </p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo do reagendamento..."
          style={{ ...IS, height:76, resize:'vertical', width:'100%' }}/>
        <div style={{ display:'flex', gap:10, marginTop:16, justifyContent:'flex-end' }}>
          <button onClick={onCancel}  style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}
            style={{ ...BS, background:reason.trim()?T.laranja:'#CCC', color:'white', fontWeight:700 }}>Confirmar</button>
        </div>
      </motion.div>
    </div>
  )
}
