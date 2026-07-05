// ============================================================
// RequestsKanban — extraído de FrotasView.jsx (item 11 da revisão)
// Kanban de solicitações (Pendentes/Aceitas/Recusadas) + faixa de atenção SLA.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, CARD_TYPES, URGENCY, URGENCY_SLA_MS, BS, IS, LS } from '../lib/constants'
import { fmt, getSubtypeLabel, sortByUrgency } from '../lib/utils'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { notifyUser } from '../hooks/useFirestore'
import { MessageThread } from './MessageThread'
import { RequestReviewModal } from './RequestReviewModal'

export function RequestsKanban({ requests, teamsWebhookUrl, onRespond, onCancel, profile, simClients }) {
  const [reviewing, setReviewing]  = useState(null)
  const [messaging, setMessaging]  = useState(null)
  const [cancelling,setCancelling] = useState(null)
  const [cancelNote,setCancelNote] = useState('')
  const [cancelError,setCancelError] = useState('')
  const [saving,    setSaving]     = useState(false)
  const groups={
    pendente:  sortByUrgency(requests.filter(r=>r.status==='pendente'),  'desiredDate'),
    aceito:    sortByUrgency(requests.filter(r=>r.status==='aceito'),    'desiredDate'),
    concluido: sortByUrgency(requests.filter(r=>r.status==='concluido'), 'desiredDate'),
    recusado:  sortByUrgency(requests.filter(r=>r.status==='recusado'),  'desiredDate'),
  }
  const cols=[
    {key:'pendente',label:'⏳ Pendentes',color:T.amarelo,bg:T.amareloLight},
    {key:'aceito',  label:'✅ Aceitas',  color:T.verde,  bg:T.verdeLight  },
    {key:'recusado',label:'❌ Recusadas',color:T.perigo, bg:T.perigoLight },
  ]
  const handleCancel=async()=>{
    if(!cancelNote.trim())return
    setSaving(true)
    try {
      await onCancel(cancelling.id,cancelNote,profile?.name)
      await addDoc(collection(db,'requests',cancelling.id,'messages'),{text:`Serviço cancelado. Motivo: ${cancelNote}`,authorId:profile?.uid||'',authorName:profile?.name||'Frotas',authorRole:profile?.role||'frotas',type:'status_change',statusEvent:'cancelado',createdAt:serverTimestamp()})
      await notifyUser(cancelling.requesterId, 'service_cancelled', '🚫 Serviço cancelado', `O serviço de ${cancelling.clientName||cancelling.requesterName} foi cancelado. Motivo: ${cancelNote}`, cancelling.id)
      setCancelling(null);setCancelNote('')
    } catch (err) {
      console.error('Erro ao cancelar serviço:', err)
      setCancelError('Erro ao cancelar. Verifique a conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }
  // Faixa de atenção: críticos/altos próximos de estourar o SLA
  const now = Date.now()
  const urgentes = groups.pendente.filter(r => {
    const sla = URGENCY_SLA_MS[r.urgency]
    if (!sla || !['critico','alto'].includes(r.urgency)) return false
    const vence = new Date(r.desiredDate).getTime() + sla
    return vence - now < 2 * 3600000 // menos de 2h pra vencer
  })

  return (
    <>
      {urgentes.length > 0 && (
        <div style={{ background:'#1A1612', borderRadius:T.r, padding:'10px 14px', marginBottom:12, flexShrink:0 }}>
          <div style={{ color:'#9E9590', fontSize:9, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            🚨 Atenção agora — {urgentes.length} {urgentes.length===1?'item':'itens'} próximo{urgentes.length===1?'':'s'} do prazo
          </div>
          {urgentes.map(r => {
            const ug = URGENCY[r.urgency]
            const vence = new Date(r.desiredDate).getTime() + URGENCY_SLA_MS[r.urgency]
            const diffH = Math.max(0, Math.round((vence - now) / 60000)) // minutos
            const label = diffH < 60 ? `${diffH}min` : `${Math.round(diffH/60)}h`
            const borda = r.urgency==='critico' ? '#D32F2F' : '#E65100'
            const bg    = r.urgency==='critico' ? 'rgba(211,47,47,.15)' : 'rgba(230,81,0,.15)'
            return (
              <div key={r.id} style={{ background:bg, border:`1px solid ${borda}`, borderRadius:T.rSm, padding:'7px 10px', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13 }}>{ug?.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {r.requesterName||'—'} · {r.clientName||r.plantaObra||'—'}
                  </div>
                  <div style={{ color:'#9E9590', fontFamily:FONT, fontSize:10 }}>vence em {label}</div>
                </div>
                <button onMouseDown={()=>setReviewing(r)}
                  style={{ ...BS, background:borda, color:'white', fontSize:10, fontWeight:700, padding:'4px 10px', whiteSpace:'nowrap' }}>
                  Avaliar →
                </button>
              </div>
            )
          })}
        </div>
      )}
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
              <textarea value={cancelNote} onChange={e=>{setCancelNote(e.target.value);setCancelError('')}} placeholder="Descreva o motivo..." style={{ ...IS, height:80, resize:'vertical', marginTop:5 }}/>
              {cancelError && <div style={{ color:T.perigo, fontSize:11, fontFamily:FONT, fontWeight:700, marginTop:6 }}>⚠ {cancelError}</div>}
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
