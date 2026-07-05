// ============================================================
// RequestReviewModal — extraído de FrotasView.jsx (item 11 da revisão)
// Modal de avaliação de solicitação pelo time de Frotas.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, CARD_TYPES, URGENCY, BS, IS, LS } from '../lib/constants'
import { fmt, getSubtypeLabel } from '../lib/utils'
import { FreteEstimativa } from './FreteEstimativa'

/* ══ REQUEST REVIEW MODAL ════════════════════════════════════════════════════ */
export function RequestReviewModal({ req, teamsWebhookUrl, onRespond, onClose, profile, simClients }) {
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
