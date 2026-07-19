// ============================================================
// CalendarViews — WeekView / MonthView / YearView
// Extraído de FrotasView.jsx (item 11 da revisão)
// ============================================================
import { useState } from 'react'
import { T, CARD_TYPES, MONTH_NAMES, WD_SHORT, SHADOW_CARD, BORDER_SUBTLE } from '../lib/constants'
import { todayStr, getWeekDays, getMonthWeeks, cardsForDay } from '../lib/utils'
import { ServiceCard, MoveModal } from './UI'

/* ══ WEEK VIEW ════════════════════════════════════════════════════════════════ */
export function WeekView({ cards, baseDate, conflicts, onEdit, onAddCard, onMoveCard, compact=false }) {
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
              style={{ background:isDO?'#FFF3E8':isToday?'#FFFAF5':T.surface, border:isToday||isDO?`1.5px solid ${T.laranja}`:BORDER_SUBTLE, borderRadius:14, padding:9, minHeight:compact?110:340, display:'flex', flexDirection:'column', overflowY:'auto', boxShadow:isToday?`0 0 0 1px ${T.laranja}40, ${SHADOW_CARD}`:SHADOW_CARD, transition:'all .1s' }}>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, flexShrink:0 }}>
                <div>
                  <div style={{ color:T.textMuted, fontSize:9, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', textTransform:'uppercase', letterSpacing:'0.06em' }}>{WD_SHORT[idx]}</div>
                  <div style={{ color:isToday?T.laranja:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:22, lineHeight:1 }}>{day.split('-')[2]}</div>
                </div>
                <button onClick={()=>onAddCard(day)} style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:T.rSm, color:T.laranja, width:22, height:22, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
              </div>
              {dc.map(c => <ServiceCard key={c.id} card={c} conflicts={conflicts} onEdit={onEdit} compact={compact} onDragStart={(e,c2)=>{setDragCard(c2);e.dataTransfer.effectAllowed='move';}}/>)}
              {!dc.length && <div style={{ color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', textAlign:'center', marginTop:'auto', opacity:.4 }}>—</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══ MONTH VIEW ══════════════════════════════════════════════════════════════ */
export function MonthView({ cards, year, month, conflicts, onEdit, onAddCard, onMoveCard }) {
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
                  style={{ background:isToday?'#FFFAF5':T.surface, border:isToday?`1px solid ${T.laranja}`:BORDER_SUBTLE, borderRadius:T.rSm, padding:5, minHeight:70, cursor:dc.length?'default':'pointer', transition:'all .1s' }}>
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
export function YearView({ cards, year, onMonthClick }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {MONTH_NAMES.map((name,mi) => {
        const mc = cards.filter(c=>c.startDate?.startsWith(`${year}-${String(mi+1).padStart(2,'0')}`))
        const tc = {}; mc.forEach(c=>{tc[c.type]=(tc[c.type]||0)+1})
        const late = mc.filter(c=>c.status==='atrasado').length
        return (
          <div key={name} onClick={()=>onMonthClick(mi)}
            style={{ background:T.surface, border:BORDER_SUBTLE, borderRadius:14, padding:13, cursor:'pointer', transition:'all .15s', boxShadow:SHADOW_CARD }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.laranja;e.currentTarget.style.boxShadow=T.shadowMd;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(26,22,18,.05)';e.currentTarget.style.boxShadow=SHADOW_CARD;}}>
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
