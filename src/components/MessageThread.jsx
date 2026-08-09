import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMessages } from '../hooks/useFirestore'
import { T, FONT, BS, IS } from '../lib/constants'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// ── MessageThread ─────────────────────────────────────────────────────────────
export function MessageThread({ requestId, profile, onClose }) {
  const { messages, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [erro, setErro] = useState('')
  // Achado de auditoria: sem try/catch, uma falha no envio (offline,
  // permissão negada) deixava o botão travado em "⏳" pra sempre — sem erro,
  // sem conseguir enviar mais nenhuma mensagem nessa conversa sem recarregar
  // a página inteira.
  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    setErro('')
    try {
      await sendMessage({ requestId, text:text.trim(), authorId:profile?.uid||'', authorName:profile?.name||'Frotas', authorRole:profile?.role||'frotas', type:'message' })
      setText('')
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
      setErro('Não foi possível enviar. Tente de novo.')
    } finally {
      setSending(false)
    }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ background:T.verde, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:14 }}>💬 Histórico da Solicitação</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {messages.length===0 && <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, padding:'20px 0' }}>Nenhuma mensagem ainda.</div>}
          {messages.map(m => {
            const isMe=m.authorRole==='frotas'||m.authorRole==='master'
            if (m.type==='status_change') return (
              <div key={m.id} style={{ textAlign:'center' }}>
                <span style={{ background:T.surfaceLow, color:T.textMuted, borderRadius:20, padding:'3px 12px', fontSize:10, fontFamily:FONT }}>{m.text}</span>
              </div>
            )
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start' }}>
                <div style={{ maxWidth:'75%', background:isMe?T.verde:T.surfaceAlt, borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px', padding:'9px 13px', boxShadow:T.shadow }}>
                  <div style={{ color:isMe?'rgba(255,255,255,0.7)':T.textMuted, fontSize:9, fontFamily:FONT, fontWeight:700, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.authorName}</div>
                  <div style={{ color:isMe?'white':T.text, fontSize:12, fontFamily:FONT, lineHeight:1.5 }}>{m.text}</div>
                </div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginTop:2 }}>{m.createdAt?.toDate?.()?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})||''}</div>
              </div>
            )
          })}
        </div>
        {erro && <div style={{ padding:'0 16px 10px', color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:600 }}>⚠️ {erro}</div>}
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8 }}>
          <input value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}}
            placeholder="Digite uma mensagem..." style={{ ...IS, flex:1, margin:0 }}/>
          <button onClick={handleSend} disabled={sending||!text.trim()}
            style={{ ...BS, background:text.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, flexShrink:0 }}>
            {sending?'⏳':'Enviar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
