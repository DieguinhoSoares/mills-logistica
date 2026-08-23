// ============================================================
// NovoEmbarqueModal — cria um Checklist de Embarque e gera o link do
// embarcador (sem login, pra preencher no celular). Primeira versão:
// só cria o registro e mostra o link pra copiar — a liberação final,
// aprovação de exceção e link do cliente vêm em fases seguintes.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS, FILIAIS_EMBARQUE } from '../lib/constants'

export function NovoEmbarqueModal({ onSave, onClose, addToast }) {
  const [filial, setFilial] = useState('')
  const [frota,  setFrota]  = useState('')
  const [saving, setSaving] = useState(false)
  const [link,   setLink]   = useState(null)

  const handleCriar = async () => {
    if (!filial || !frota.trim()) { addToast('Preencha a filial e a frota/equipamento.', 'error'); return }
    setSaving(true)
    try {
      const { embarcadorToken } = await onSave({ filial, frota:frota.trim() })
      setLink(`${window.location.origin}${window.location.pathname}?embarque=${embarcadorToken}`)
    } catch (err) {
      console.error('Erro ao criar checklist de embarque:', err)
      addToast('Erro ao criar checklist. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(link).then(
      () => addToast('Link copiado!', 'success'),
      () => addToast('Não consegui copiar — selecione o link manualmente.', 'error')
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:420, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 4px' }}>🛡️ Novo Checklist de Embarque</h3>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, margin:'0 0 16px' }}>
          Cria o registro e gera o link pro embarcador preencher pelo celular, sem login.
        </p>

        {!link ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div><label style={LS}>Filial Mills</label>
              <select value={filial} onChange={e=>setFilial(e.target.value)} style={IS}>
                <option value="">— selecione —</option>
                {FILIAIS_EMBARQUE.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label style={LS}>Frota / Equipamento</label>
              <input value={frota} onChange={e=>setFrota(e.target.value)} style={IS} placeholder="Ex: EHS01259 — Escavadeira CAT 320"/>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button onClick={onClose} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Cancelar</button>
              <button onClick={handleCriar} disabled={saving} style={{ ...BS, flex:1, background:saving?T.textMuted:T.laranja, color:'white', fontWeight:700, fontSize:11 }}>
                {saving ? '⏳...' : '➕ Criar e gerar link'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ background:T.sucessoLight, color:T.sucesso, borderRadius:T.rSm, padding:10, fontFamily:FONT, fontWeight:700, fontSize:12 }}>
              ✅ Checklist criado!
            </div>
            <div><label style={LS}>Link pro embarcador (sem login)</label>
              <input readOnly value={link} onFocus={e=>e.target.select()} style={{ ...IS, fontSize:10 }}/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={copiarLink} style={{ ...BS, flex:1, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontWeight:700, fontSize:11 }}>📋 Copiar link</button>
              <button onClick={onClose} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Fechar</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
