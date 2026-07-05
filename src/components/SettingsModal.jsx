// ============================================================
// SettingsModal — extraído de FrotasView.jsx (item 11 da revisão)
// Configurações de integrações (Teams webhook etc.).
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS } from '../lib/constants'

/* ══ EXPORT MODAL ════════════════════════════════════════════════════════════ */
export function SettingsModal({ config, onSave, onClose }) {
  const [webhook, setWebhook] = useState(config?.teamsWebhookUrl || '')
  const [saved,   setSaved]   = useState(false)
  const handleSave = async () => {
    try {
      await onSave({ teamsWebhookUrl: webhook })
      setSaved(true); setTimeout(()=>setSaved(false),2000)
    } catch (err) { console.error('Erro ao salvar webhook:', err); alert('Não foi possível salvar a configuração.') }
  }
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
