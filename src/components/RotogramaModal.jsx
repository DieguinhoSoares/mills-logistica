// ============================================================
// RotogramaModal — extraído de FrotasView.jsx (item 11 da revisão)
// Monta a sequência de paradas do motorista e gera link do app.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, CARD_TYPES, BS } from '../lib/constants'
import { db } from '../lib/firebase'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { ensureDriverToken } from '../hooks/useFirestore'
import { calcularMatrizDistancias, otimizarOrdemParadas } from '../lib/freteCalc'

// ── RotogramaModal ────────────────────────────────────────────────────────────
export function RotogramaModal({ driver, cards, profile, rotogramaAtivo, onClose, addToast }) {
  const [paradas,setParadas]=useState(rotogramaAtivo?.paradas||[])
  const [saving,setSaving]=useState(false)
  const [linkGerado,setLinkGerado]=useState(null)
  const [otimizando,setOtimizando]=useState(false)
  const cardsDisponiveis=cards.filter(c=>c.driverId===driver.id&&['confirmado','em_execucao'].includes(c.status)).sort((a,b)=>a.startDate?.localeCompare(b.startDate))
  const addParada=card=>{if(paradas.find(p=>p.cardId===card.id))return;setParadas(prev=>[...prev,{cardId:card.id,cliente:card.client,destino:card.destCity||card.destination||'',destinoUF:card.destination||'',origem:card.originCity||card.origin||'',origemUF:card.origin||'',startDate:card.startDate}])}
  const removeParada=cardId=>setParadas(prev=>prev.filter(p=>p.cardId!==cardId))
  const moverParada=(i,dir)=>{const n=[...paradas];const t=i+dir;if(t<0||t>=n.length)return;[n[i],n[t]]=[n[t],n[i]];setParadas(n)}
  // Otimização de ordem (item 2) — usa o OSRM (mesmo motor já usado no frete
  // combinado) pra calcular a distância entre TODAS as paradas de uma vez
  // (endpoint /table/) e reordena pela heurística do vizinho mais próximo,
  // partindo da base Mills. Não precisa de rede extra por combinação
  // possível — é uma chamada só, não importa quantas paradas existam.
  const handleOtimizar = async () => {
    if (paradas.length < 2) return
    setOtimizando(true)
    try {
      const pontos = [{ cidade:'Sumaré', uf:'SP' }, ...paradas.map(p => ({ cidade:p.destino, uf:p.destinoUF }))]
      const matriz = await calcularMatrizDistancias(pontos)
      if (!matriz) { addToast('Não foi possível calcular a rota (cidade não encontrada).', 'error'); return }
      const ordem = otimizarOrdemParadas(matriz) // ex: [0, 3, 1, 2] — índice 0 é a origem
      // Se o OSRM não conseguir calcular rota até alguma parada (destino
      // sem rota rodoviária conhecida, por exemplo), a matriz tem essa
      // distância como Infinity e o algoritmo de otimização para cedo,
      // devolvendo uma ordem menor que o número real de paradas. Sem essa
      // checagem, a parada que ficou de fora simplesmente sumia da rota
      // sem nenhum aviso — igual apagar um destino sem querer.
      if (ordem.length !== matriz.length) {
        addToast('⚠️ Não foi possível calcular rota até alguma parada — ordem mantida como está, nada foi alterado.', 'error')
        return
      }
      const novaOrdem = ordem.slice(1).map(i => paradas[i - 1])
      setParadas(novaOrdem)
      addToast('🧭 Ordem otimizada pela distância entre as paradas!', 'success')
    } catch (err) {
      console.error('Erro ao otimizar rota:', err)
      addToast('Erro ao otimizar rota. A ordem manual continua válida.', 'error')
    } finally {
      setOtimizando(false)
    }
  }
  const gerarUrl=()=>{if(!paradas.length)return null;return `https://www.google.com/maps/dir/${paradas.map(p=>encodeURIComponent(`${p.destino} ${p.destinoUF}`)).join('/')}`}
  const handleSalvar=async()=>{
    setSaving(true)
    try {
      const url=paradas.length ? gerarUrl() : null
      const data={driverId:driver.id,driverName:driver.name,paradas,urlRota:url,status:paradas.length?'ativo':'inativo',criadoPor:profile?.name||'Frotas',updatedAt:serverTimestamp()}
      if(rotogramaAtivo?.id) await updateDoc(doc(db,'rotogramas',rotogramaAtivo.id),data)
      else if(paradas.length){ data.criadoEm=serverTimestamp(); await addDoc(collection(db,'rotogramas'),data) }
      setLinkGerado(url)
      addToast(paradas.length?`Rotograma de ${driver.name} salvo!`:`Rotograma de ${driver.name} limpo!`,'success')
    } catch(err) {
      console.error('Erro ao salvar rotograma:', err)
      addToast(`Erro ao salvar rotograma: ${err.message}`,'error')
    } finally {
      setSaving(false)
    }
  }
  const handleCopiarLink=async()=>{
    try {
      const token=await ensureDriverToken(driver.id)
      const link=`https://dieguinhosoares.github.io/mills-logistica/?motorista=${token}`
      navigator.clipboard.writeText(link)
      addToast('Link do motorista copiado!','success')
    } catch (err) {
      console.error('Erro ao gerar link do motorista:', err)
      addToast('Erro ao gerar link. Tente novamente.','error')
    }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, width:660, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ background:T.verde, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:16 }}>🗺 Rotograma — {driver.name}</div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontFamily:FONT, fontSize:11 }}>{driver.unit||''} · {paradas.length} parada(s)</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', flex:1, overflow:'hidden' }}>
          <div style={{ borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.07em' }}>Serviços disponíveis</div>
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'8px' }}>
              {cardsDisponiveis.length===0&&<div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:11, padding:'20px 0' }}>Nenhum serviço confirmado.</div>}
              {cardsDisponiveis.map(c=>{
                const ct=CARD_TYPES[c.type];const ja=paradas.some(p=>p.cardId===c.id)
                return (<div key={c.id} onClick={()=>!ja&&addParada(c)} style={{ padding:'9px 11px', borderRadius:T.r, marginBottom:6, border:`1px solid ${ja?T.verde:T.border}`, background:ja?T.verdeLight:T.surfaceAlt, cursor:ja?'default':'pointer', opacity:ja?0.6:1 }}>
                  <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{c.client}</div>
                  <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>{c.originCity||c.origin||'—'} → {c.destCity||c.destination||'—'}</div>
                  {ja&&<div style={{ color:T.verde, fontSize:9, fontFamily:FONT, fontWeight:700 }}>✓ Na rota</div>}
                </div>)
              })}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.border}`, flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.07em' }}>Sequência da rota</div>
              {paradas.length >= 2 && (
                <button onClick={handleOtimizar} disabled={otimizando}
                  title="Reordena as paradas pela distância mais curta entre elas"
                  style={{ background:'none', border:'none', color:T.laranja, fontFamily:FONT, fontWeight:700, fontSize:10, cursor:otimizando?'default':'pointer', padding:0 }}>
                  {otimizando ? '⏳ Calculando...' : '🧭 Otimizar ordem'}
                </button>
              )}
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'8px' }}>
              {paradas.length===0&&<div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:11, padding:'20px 0' }}>Adicione paradas da lista.</div>}
              {paradas.map((p,i)=>(
                <div key={p.cardId} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:T.laranja, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontWeight:700, fontSize:11, flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1, padding:'7px 9px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
                    <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{p.cliente}</div>
                    <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>{p.destino}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <button onClick={()=>moverParada(i,-1)} disabled={i===0} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, width:20, height:20, cursor:'pointer', fontSize:11, opacity:i===0?0.3:1 }}>↑</button>
                    <button onClick={()=>moverParada(i,1)} disabled={i===paradas.length-1} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, width:20, height:20, cursor:'pointer', fontSize:11, opacity:i===paradas.length-1?0.3:1 }}>↓</button>
                  </div>
                  <button onClick={()=>removeParada(p.cardId)} style={{ background:T.perigoLight, border:`1px solid ${T.perigo}30`, borderRadius:3, width:20, height:20, cursor:'pointer', color:T.perigo, fontSize:13 }}>×</button>
                </div>
              ))}
            </div>
            {linkGerado&&(<div style={{ padding:'8px 12px', background:T.verdeLight, borderTop:`1px solid ${T.verde}30`, flexShrink:0 }}>
              <div style={{ color:T.verde, fontFamily:FONT, fontSize:11, fontWeight:700, marginBottom:3 }}>✅ Rotograma salvo!</div>
              <a href={linkGerado} target="_blank" rel="noreferrer" style={{ color:T.info, fontFamily:FONT, fontSize:10 }}>Abrir rota no Maps →</a>
            </div>)}
          </div>
        </div>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8, justifyContent:'space-between', flexShrink:0 }}>
          <button onClick={handleCopiarLink} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:11, fontWeight:700 }}>📱 Copiar link do motorista</button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
            <button onClick={handleSalvar} disabled={saving} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>{saving?'⏳ Salvando...':paradas.length?'💾 Salvar Rotograma':'🗑 Limpar Rotograma'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
