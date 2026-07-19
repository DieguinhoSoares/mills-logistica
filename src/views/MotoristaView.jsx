import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/firebase'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { T, FONT, CARD_TYPES, URGENCY } from '../lib/constants'
import { fmt, todayStr } from '../lib/utils'
import { notifyUser } from '../hooks/useFirestore'
import { ConfirmModal } from '../components/UI'

const INTERRUPCAO_MOTIVOS = [
  { value:'quebra_veiculo',    label:'🔧 Quebra do veículo' },
  { value:'acidente',          label:'🚨 Acidente' },
  { value:'bloqueio_via',      label:'🚧 Bloqueio de via' },
  { value:'problema_carga',    label:'📦 Problema com a carga' },
  { value:'cliente_ausente',   label:'👤 Cliente ausente' },
  { value:'local_inacessivel', label:'🚫 Local inacessível' },
  { value:'documento_faltando',label:'📄 Documento faltando' },
  { value:'descanso',          label:'⏸ Parada obrigatória' },
  { value:'outro',             label:'📝 Outro motivo' },
]

const SUBTYPES_OBS_OBRIG = ['sinistro', 'garantia']

async function comprimirImagem(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function StatusBadge({ status }) {
  const cfg = {
    confirmado:          { label:'📋 Aguardando',       color:T.amarelo,  bg:T.amareloLight },
    em_execucao:         { label:'🚛 Em execução',       color:T.verde,    bg:T.verdeLight   },
    interrompido:        { label:'⏸ Interrompido',      color:'#B8860B',  bg:'#FFF8E1'      },
    aguardando_validacao:{ label:'⏳ Aguard. validação', color:T.info,     bg:T.infoLight    },
    concluido:           { label:'✅ Concluído',          color:T.sucesso,  bg:T.sucessoLight },
    cancelado:           { label:'🚫 Cancelado',          color:T.textMuted,bg:T.surfaceLow  },
  }
  const c = cfg[status] || cfg.confirmado
  return (
    <span style={{ background:c.bg, color:c.color, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, fontFamily:FONT, whiteSpace:'nowrap' }}>
      {c.label}
    </span>
  )
}

function ConclusaoModal({ card, onConfirm, onClose }) {
  const [foto,     setFoto]     = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [obs,      setObs]      = useState('')
  const [saving,   setSaving]   = useState(false)
  const [compressing, setCompressing] = useState(false)
  const inputRef = useRef()

  const obsObrig = SUBTYPES_OBS_OBRIG.includes(card.subtype)
  const canConfirm = foto && (!obsObrig || obs.trim())

  const handleFoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCompressing(true)
    const b64 = await comprimirImagem(file)
    setFoto(b64)
    setPreview(b64)
    setCompressing(false)
  }

  const handleConfirm = async () => {
    if (!canConfirm) return
    setSaving(true)
    await onConfirm({ foto, obs })
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.6)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ y:300, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:300, opacity:0 }}
        style={{ background:T.surface, borderRadius:'20px 20px 0 0', padding:'20px 18px 36px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg }}>

        <div style={{ width:40, height:4, background:T.borderMid, borderRadius:2, margin:'0 auto 18px' }}/>

        <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:18, margin:'0 0 6px' }}>✅ Concluir Serviço</h2>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'0 0 18px' }}>
          <strong style={{ color:T.laranja }}>{card.client}</strong> · {card.destCity||card.destination||'—'}
        </p>

        {/* Foto */}
        <div style={{ marginBottom:16 }}>
          <label style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>
            📷 Foto de confirmação <span style={{ color:T.perigo }}>*</span>
          </label>

          {!preview ? (
            <button onClick={()=>inputRef.current?.click()}
              style={{ width:'100%', background:T.surfaceAlt, border:`2px dashed ${T.border}`, borderRadius:T.rLg, padding:'28px 0', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              {compressing ? (
                <>
                  <span style={{ fontSize:28 }}>⏳</span>
                  <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12 }}>Comprimindo imagem...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize:36 }}>📷</span>
                  <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, fontWeight:700 }}>Toque para fotografar</span>
                  <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>Foto da máquina/entrega no destino</span>
                </>
              )}
            </button>
          ) : (
            <div style={{ position:'relative' }}>
              <img src={preview} alt="foto" style={{ width:'100%', borderRadius:T.rLg, maxHeight:220, objectFit:'cover' }}/>
              <button onClick={()=>{setFoto(null);setPreview(null)}}
                style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', border:'none', color:'white', borderRadius:'50%', width:28, height:28, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display:'none' }}/>
        </div>

        {/* Observação */}
        <div style={{ marginBottom:20 }}>
          <label style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>
            📝 Observação {obsObrig ? <span style={{ color:T.perigo }}>*</span> : <span style={{ color:T.textMuted, fontWeight:400 }}>(opcional)</span>}
          </label>
          <textarea value={obs} onChange={e=>setObs(e.target.value)}
            placeholder={obsObrig ? 'Descreva a ocorrência (obrigatório)...' : 'Observações sobre a entrega...'}
            style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${obsObrig&&!obs.trim()?T.perigo:T.border}`, borderRadius:T.r, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:80, resize:'none' }}/>
        </div>

        <button onClick={handleConfirm} disabled={!canConfirm||saving}
          style={{ width:'100%', background:canConfirm?T.verde:T.borderMid, color:'white', border:'none', borderRadius:T.rLg, padding:'14px', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:canConfirm?'pointer':'default', opacity:canConfirm?1:0.6 }}>
          {saving ? '⏳ Registrando...' : '✅ Confirmar Conclusão'}
        </button>
        <button onClick={onClose}
          style={{ width:'100%', background:'none', border:'none', color:T.textMuted, fontFamily:FONT, fontSize:13, padding:'12px 0 0', cursor:'pointer' }}>
          Cancelar
        </button>
      </motion.div>
    </div>
  )
}

function InterrupcaoModal({ card, onConfirm, onClose }) {
  const [motivo,    setMotivo]    = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving,    setSaving]    = useState(false)

  const canConfirm = motivo && (motivo !== 'outro' || descricao.trim())

  const handleConfirm = async () => {
    if (!canConfirm) return
    setSaving(true)
    await onConfirm({ motivo, descricao })
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.6)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ y:300, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:300, opacity:0 }}
        style={{ background:T.surface, borderRadius:'20px 20px 0 0', padding:'20px 18px 36px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg }}>

        <div style={{ width:40, height:4, background:T.borderMid, borderRadius:2, margin:'0 auto 18px' }}/>

        <h2 style={{ color:'#B8860B', fontFamily:FONT, fontWeight:700, fontSize:18, margin:'0 0 6px' }}>⏸ Interromper Serviço</h2>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'0 0 18px' }}>
          Selecione o motivo da interrupção de <strong style={{ color:T.laranja }}>{card.client}</strong>.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {INTERRUPCAO_MOTIVOS.map(m => (
            <div key={m.value} onClick={()=>setMotivo(m.value)}
              style={{ border:`2px solid ${motivo===m.value?T.laranja:T.border}`, borderRadius:T.r, padding:'11px 14px', cursor:'pointer',
                background:motivo===m.value?T.laranjaLight:T.surfaceAlt, transition:'all .12s',
                color:T.text, fontFamily:FONT, fontSize:13, fontWeight:motivo===m.value?700:500 }}>
              {m.label}
            </div>
          ))}
        </div>

        {motivo === 'outro' && (
          <div style={{ marginBottom:16 }}>
            <textarea value={descricao} onChange={e=>setDescricao(e.target.value)}
              placeholder="Descreva o motivo..."
              style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:80, resize:'none' }}/>
          </div>
        )}

        <button onClick={handleConfirm} disabled={!canConfirm||saving}
          style={{ width:'100%', background:canConfirm?'#B8860B':T.borderMid, color:'white', border:'none', borderRadius:T.rLg, padding:'14px', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:canConfirm?'pointer':'default', opacity:canConfirm?1:0.6 }}>
          {saving ? '⏳ Registrando...' : '⏸ Confirmar Interrupção'}
        </button>
        <button onClick={onClose}
          style={{ width:'100%', background:'none', border:'none', color:T.textMuted, fontFamily:FONT, fontSize:13, padding:'12px 0 0', cursor:'pointer' }}>
          Cancelar
        </button>
      </motion.div>
    </div>
  )
}

function ServicoCard({ card, index, onUpdateStatus }) {
  const ct = CARD_TYPES[card.type]
  const ug = URGENCY[card.urgency]
  const [showConclusao,   setShowConclusao]   = useState(false)
  const [showInterrupcao, setShowInterrupcao] = useState(false)

  // Alerta de atraso individual — antes só existia um aviso geral ("N
  // serviço(s) pendente(s)") lá em cima da lista, sem indicar QUAL serviço
  // específico está atrasado nem há quanto tempo, direto no card dele.
  const isAtrasado = card.startDate && card.startDate < todayStr() && !['concluido','cancelado'].includes(card.status)
  const diasAtraso = isAtrasado ? Math.round((new Date(todayStr()) - new Date(card.startDate)) / 86400000) : 0

  const origem    = card.originCity  || card.origin       || '—'
  const destino   = card.destCity    || card.destination  || '—'
  const origemUF  = card.origin      || ''
  const destinoUF = card.destination || ''

  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(destino+' '+destinoUF)}&navigate=yes`
  const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(origem+' '+origemUF)}/${encodeURIComponent(destino+' '+destinoUF)}`

  const handleConclusao = async ({ foto, obs }) => {
    await onUpdateStatus(card.id, 'aguardando_validacao', { conclusaoFoto:foto, conclusaoNota:obs })
    setShowConclusao(false)
  }

  const handleInterrupcao = async ({ motivo, descricao }) => {
    const motivoLabel = INTERRUPCAO_MOTIVOS.find(m=>m.value===motivo)?.label || motivo
    await onUpdateStatus(card.id, 'interrompido', {
      interrupcaoMotivo:    motivo,
      interrupcaoDescricao: descricao || motivoLabel,
      interrupcaoEm:        new Date().toISOString(),
    })
    setShowInterrupcao(false)
  }

  const handleRetomar = async () => {
    // interrompidoEm também precisa ser limpo aqui — antes só interrupcaoMotivo/
    // interrupcaoDescricao eram apagados, deixando esse timestamp obsoleto no
    // card pra sempre (não aparece em nenhuma tela hoje, mas ficaria enganoso
    // se um relatório futuro vier a usar esse campo).
    await onUpdateStatus(card.id, 'em_execucao', { interrupcaoMotivo:null, interrupcaoDescricao:null, interrompidoEm:null })
  }

  return (
    <>
      <AnimatePresence>
        {showConclusao   && <ConclusaoModal   card={card} onConfirm={handleConclusao}   onClose={()=>setShowConclusao(false)}/>}
        {showInterrupcao && <InterrupcaoModal card={card} onConfirm={handleInterrupcao} onClose={()=>setShowInterrupcao(false)}/>}
      </AnimatePresence>

      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:index*0.05 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:'16px', marginBottom:12, boxShadow:T.shadowMd,
          border: isAtrasado ? `2px dashed ${T.perigo}` : `1.5px solid ${ct?.color}30`, position:'relative', overflow:'hidden' }}>

        {isAtrasado && (
          <div style={{ background:T.perigo, color:'white', borderRadius:20, padding:'2px 10px', fontSize:9, fontWeight:800, fontFamily:FONT, position:'absolute', top:10, right:10, zIndex:1 }}>
            🚨 Atrasado desde {fmt(card.startDate)} · {diasAtraso} dia{diasAtraso===1?'':'s'}
          </div>
        )}

        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:ct?.color, borderRadius:'4px 0 0 4px' }}/>

        <div style={{ paddingLeft:10 }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ fontSize:16 }}>{ct?.icon}</span>
                <span style={{ color:ct?.color, fontSize:9, fontWeight:700, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.08em' }}>{ct?.short}</span>
                {card.subtype && <span style={{ background:T.infoLight, color:T.info, borderRadius:20, padding:'1px 7px', fontSize:9, fontWeight:700, fontFamily:FONT }}>{card.subtype.replace(/_/g,' ')}</span>}
              </div>
              <div style={{ color:T.text, fontWeight:700, fontSize:15, fontFamily:FONT }}>{card.client||'—'}</div>
            </div>
            <StatusBadge status={card.status}/>
          </div>

          {/* Alerta de atraso individual */}
          {card.endDate && card.endDate < todayStr() && !['concluido','cancelado'].includes(card.status) && (
            <div style={{ background:'#3D1A1A', border:`1px solid #D32F2F40`, borderRadius:T.r, padding:'8px 12px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>🚨</span>
              <div>
                <div style={{ color:'#FF6B6B', fontFamily:FONT, fontSize:12, fontWeight:800 }}>Serviço em atraso</div>
                <div style={{ color:'#9E6B6B', fontFamily:FONT, fontSize:10 }}>Data prevista: {card.endDate} — Contate o time de Frotas</div>
              </div>
            </div>
          )}

          {/* Interrupção ativa */}
          {card.status==='interrompido' && card.interrupcaoDescricao && (
            <div style={{ background:'#FFF8E1', border:`1px solid #B8860B40`, borderRadius:T.r, padding:'8px 12px', marginBottom:10 }}>
              <div style={{ color:'#B8860B', fontFamily:FONT, fontSize:11, fontWeight:700 }}>
                ⏸ Motivo: {card.interrupcaoDescricao}
              </div>
            </div>
          )}

          {/* Rota */}
          <div style={{ background:T.surfaceAlt, borderRadius:T.r, padding:'10px 12px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Origem</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT }}>{origem}</div>
              </div>
              <div style={{ color:T.laranja, fontSize:18 }}>→</div>
              <div style={{ flex:1, textAlign:'right' }}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Destino</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT }}>{destino}</div>
              </div>
            </div>
          </div>

          {/* Detalhes */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              ['📅 Data',       `${fmt(card.startDate)}${card.endDate && card.endDate < todayStr() && !['concluido','cancelado'].includes(card.status) ? ' 🚨' : ''}`],
              ['⚡ Urgência',   `${ug?.icon} ${ug?.label}`],
              ['🔧 Máquina',    card.machine||'—'],
              ['🔢 N° Interno', card.nInterno||'—'],
            ].map(([l,v]) => (
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:11, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          {card.notes && (
            <div style={{ background:T.laranjaXLight, borderRadius:T.rSm, padding:'8px 10px', marginBottom:10, border:`1px solid ${T.laranja}20` }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginBottom:2 }}>📝 Observações</div>
              <div style={{ color:T.textSec, fontSize:11, fontFamily:FONT }}>{card.notes}</div>
            </div>
          )}

          {/* Foto de conclusão (se já enviou) */}
          {card.conclusaoFoto && (
            <div style={{ marginBottom:10 }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>📷 Foto de confirmação</div>
              <img src={card.conclusaoFoto} alt="conclusao" style={{ width:'100%', borderRadius:T.r, maxHeight:160, objectFit:'cover' }}/>
            </div>
          )}

          {/* Navegação */}
          {['confirmado','em_execucao','interrompido'].includes(card.status) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <a href={wazeUrl} target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#33CCFF', color:'white', borderRadius:T.r, padding:'10px', fontFamily:FONT, fontWeight:700, fontSize:12, textDecoration:'none' }}>
                🔵 Waze
              </a>
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#4285F4', color:'white', borderRadius:T.r, padding:'10px', fontFamily:FONT, fontWeight:700, fontSize:12, textDecoration:'none' }}>
                🗺 Maps
              </a>
            </div>
          )}

          {/* Ações */}
          {card.status==='confirmado' && (
            <button onClick={()=>onUpdateStatus(card.id,'em_execucao',{startedAt:new Date().toISOString()})}
              style={{ width:'100%', background:T.verde, color:'white', border:'none', borderRadius:T.r, padding:'13px', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
              🚛 Iniciar Execução
            </button>
          )}

          {card.status==='em_execucao' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={()=>setShowConclusao(true)}
                style={{ width:'100%', background:T.laranja, color:'white', border:'none', borderRadius:T.r, padding:'13px', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                ✅ Concluir Serviço
              </button>
              <button onClick={()=>setShowInterrupcao(true)}
                style={{ width:'100%', background:'#FFF8E1', color:'#B8860B', border:`1.5px solid #B8860B40`, borderRadius:T.r, padding:'11px', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                ⏸ Interromper
              </button>
            </div>
          )}

          {card.status==='interrompido' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={handleRetomar}
                style={{ width:'100%', background:T.verde, color:'white', border:'none', borderRadius:T.r, padding:'13px', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                ▶ Retomar Execução
              </button>
              <button onClick={()=>setShowConclusao(true)}
                style={{ width:'100%', background:T.laranja, color:'white', border:'none', borderRadius:T.r, padding:'11px', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                ✅ Concluir mesmo assim
              </button>
            </div>
          )}

          {card.status==='aguardando_validacao' && (
            <div style={{ background:T.infoLight, borderRadius:T.r, padding:'10px 12px', textAlign:'center', color:T.info, fontFamily:FONT, fontSize:12, fontWeight:700 }}>
              ⏳ Aguardando validação do analista
            </div>
          )}

          {card.status==='concluido' && (
            <div style={{ background:T.verdeLight, borderRadius:T.r, padding:'10px 12px', textAlign:'center', color:T.verde, fontFamily:FONT, fontSize:12, fontWeight:700 }}>
              ✅ Serviço concluído e validado
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

export function MotoristaView({ token }) {
  const [driver,    setDriver]    = useState(null)
  const [cards,     setCards]     = useState([])
  const [rotograma, setRotograma] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [tab,       setTab]       = useState('hoje')
  const [paradaRemover, setParadaRemover] = useState(null) // parada do rotograma aguardando confirmação de remoção

  useEffect(() => {
    if (!token) { setError('Link inválido.'); setLoading(false); return }
    // Guarda os unsubscribes internos — sem isso, a cada mudança no doc do motorista
    // novos listeners de cards/rotograma eram criados sem nunca desligar os antigos
    // (vazamento de memória + leituras duplicadas no Firestore).
    let unsubCards = null, unsubRot = null
    const q = query(collection(db,'drivers'), where('token','==',token), where('active','==',true))
    const unsub = onSnapshot(q, async snap => {
      if (snap.empty) { setError('Link inválido ou motorista inativo.'); setLoading(false); return }
      const driverData = { id:snap.docs[0].id, ...snap.docs[0].data() }
      setDriver(driverData)
      unsubCards?.(); unsubRot?.()
      const cardsQ = query(collection(db,'cards'), where('driverId','==',driverData.id))
      unsubCards = onSnapshot(cardsQ, cardsSnap => {
        // Mantém serviços cancelados visíveis (com o badge "🚫 Cancelado") em vez de
        // sumir silenciosamente da tela do motorista sem nenhuma explicação.
        const all = cardsSnap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>a.startDate?.localeCompare(b.startDate))
        setCards(all); setLoading(false)
      })
      const rotQ = query(collection(db,'rotogramas'), where('driverId','==',driverData.id), where('status','==','ativo'))
      unsubRot = onSnapshot(rotQ, rotSnap => {
        if (!rotSnap.empty) setRotograma({id:rotSnap.docs[0].id,...rotSnap.docs[0].data()})
        else setRotograma(null)
      })
    }, ()=>{ setError('Erro ao carregar dados.'); setLoading(false) })
    return () => { unsub(); unsubCards?.(); unsubRot?.() }
  }, [token])

  const handleUpdateStatus = async (cardId, novoStatus, extra={}) => {
    await updateDoc(doc(db,'cards',cardId), {
      status:    novoStatus,
      updatedAt: serverTimestamp(),
      ...(novoStatus==='em_execucao'          ? { startedAt:serverTimestamp()   } : {}),
      ...(novoStatus==='aguardando_validacao' ? { completedAt:serverTimestamp() } : {}),
      ...(novoStatus==='interrompido'         ? { interrompidoEm:serverTimestamp() } : {}),
      ...extra,
    })
    // Interrupção em campo é urgente e antes não avisava ninguém — nem Frotas,
    // nem o solicitante ficavam sabendo até alguém olhar o calendário por acaso.
    if (novoStatus === 'interrompido') {
      const card = cards.find(c => c.id === cardId)
      if (card) {
        const motivoLabel = extra.interrupcaoDescricao || 'Motivo não informado'
        const msg = `${driver?.name||'Motorista'} interrompeu o serviço de ${card.client||card.machine||'—'} (${card.nInterno||'—'}). Motivo: ${motivoLabel}`
        // notifyRoles(['frotas'], ...) foi removido daqui: ele faz um list() na
        // coleção 'users' para achar quem tem role='frotas', e esta tela do
        // motorista não passa por login (request.auth é null) — abrir 'users'
        // para leitura anônima só para preservar esse alerta exporia nome/email/
        // role de toda a equipe publicamente (ver firestore.rules). Frotas
        // continua vendo a interrupção em tempo real pelo próprio card
        // (status:'interrompido' já aparece na tela deles); só o solicitante
        // recebe o alerta in-app diretamente, que é um create simples e seguro
        // mesmo sem autenticação.
        if (card.requesterId) {
          await notifyUser(card.requesterId, 'service_interrupted', '⏸ Seu serviço foi interrompido', msg, card.requestId||null)
        }
      }
    }
  }

  const today      = todayStr()
  const cardsHoje  = cards.filter(c=>c.startDate===today)
  const cardsSemana= cards.filter(c=>c.startDate>today)
  const cardsAntigos=cards.filter(c=>c.startDate<today&&!['concluido','cancelado'].includes(c.status))

  const rotogramaUrl = rotograma?.paradas?.length>1
    ? `https://www.google.com/maps/dir/${rotograma.paradas.map(p=>encodeURIComponent(`${p.destino} ${p.destinoUF}`)).join('/')}`
    : null

  if (loading) return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ textAlign:'center' }}><div style={{ fontSize:40, marginBottom:12 }}>⏳</div><div style={{ color:T.textMuted }}>Carregando...</div></div>
    </div>
  )

  if (error) return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, padding:'20px' }}>
      <div style={{ textAlign:'center', maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:16, marginBottom:8 }}>Acesso não autorizado</div>
        <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:13 }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:FONT, maxWidth:480, margin:'0 auto' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      <div style={{ background:T.verde, padding:'16px', position:'sticky', top:0, zIndex:100, boxShadow:T.shadowMd }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:T.laranja, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:16, fontFamily:FONT, flexShrink:0 }}>
            {driver?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:15 }}>{driver?.name}</div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontFamily:FONT, fontSize:11 }}>mills · Gestão de Frotas</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.verdeMint }}/>
            <span style={{ color:T.verdeMint, fontSize:9, fontWeight:700 }}>LIVE</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, background:'rgba(0,0,0,0.2)', borderRadius:T.r, padding:3 }}>
          {[['hoje','📅 Hoje'],['semana','📆 Próximos'],['rotograma','🗺 Rotograma']].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{ flex:1, padding:'6px 4px', borderRadius:T.rSm, border:'none', background:tab===v?T.laranja:'transparent', color:tab===v?'white':'rgba(255,255,255,0.65)', fontFamily:FONT, fontWeight:700, fontSize:11, cursor:'pointer', transition:'all .15s' }}>
              {l}
              {v==='hoje'&&cardsHoje.length>0&&<span style={{ marginLeft:4, background:'rgba(255,255,255,0.3)', borderRadius:10, padding:'0 5px', fontSize:9 }}>{cardsHoje.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px' }}>

        {tab==='hoje' && (
          <>
            {cardsAntigos.length>0 && (
              <div style={{ background:T.perigoLight, borderRadius:T.r, padding:'10px 14px', marginBottom:14, border:`1px solid ${T.perigo}30` }}>
                <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:12 }}>⚠️ {cardsAntigos.length} serviço(s) pendente(s) de dias anteriores</div>
              </div>
            )}
            {cardsHoje.length===0&&cardsAntigos.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🎉</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Nenhum serviço para hoje!</p>
              </div>
            ) : (
              <>
                {cardsAntigos.map((c,i)=><ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
                {cardsHoje.map((c,i)   =><ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
              </>
            )}
          </>
        )}

        {tab==='semana' && (
          <>
            {cardsSemana.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
                <p>Nenhum serviço programado.</p>
              </div>
            ) : cardsSemana.map((c,i)=><ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
          </>
        )}

        {tab==='rotograma' && (
          <>
            {!rotograma ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🗺</div>
                <p style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Nenhum rotograma ativo</p>
                <p style={{ fontSize:13 }}>O analista ainda não montou seu rotograma.</p>
              </div>
            ) : (
              <>
                <div style={{ background:T.verde, borderRadius:T.rLg, padding:'14px 16px', marginBottom:16, color:'white' }}>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, marginBottom:4 }}>🗺 Rotograma — {rotograma.paradas?.length} parada(s)</div>
                  <div style={{ fontFamily:FONT, fontSize:11, opacity:0.7 }}>Criado por {rotograma.criadoPor} · {rotograma.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR')||''}</div>
                </div>
                {rotogramaUrl && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                    <a href={rotogramaUrl} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#33CCFF', color:'white', borderRadius:T.r, padding:'12px', fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none' }}>
                      🔵 Rota no Waze
                    </a>
                    <a href={rotogramaUrl} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#4285F4', color:'white', borderRadius:T.r, padding:'12px', fontFamily:FONT, fontWeight:700, fontSize:13, textDecoration:'none' }}>
                      🗺 Rota no Maps
                    </a>
                  </div>
                )}
                {rotograma.paradas?.map((parada,i)=>{
                  const card=cards.find(c=>c.id===parada.cardId)
                  if(!card) return null
                  const ct=CARD_TYPES[card.type]
                  // Expiração automática: parada concluída há mais de 48h some da visualização do motorista
                  const concluido = card.status==='concluido'
                  const concluidoEm = card.concluidoEm ? new Date(card.concluidoEm) : null
                  const expirado = concluido && concluidoEm && (Date.now()-concluidoEm.getTime()) > 48*3600*1000
                  if(expirado) return null

                  return (
                    <div key={parada.cardId} style={{ display:'flex', gap:10, marginBottom:10, opacity:concluido?0.6:1 }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:concluido?T.sucesso:T.laranja, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontWeight:700, fontSize:13, flexShrink:0 }}>{concluido?'✓':i+1}</div>
                        {i<rotograma.paradas.length-1&&<div style={{ width:2, flex:1, background:T.border, minHeight:20, marginTop:4 }}/>}
                      </div>
                      <div style={{ flex:1, background:T.surface, borderRadius:T.r, padding:'10px 12px', boxShadow:T.shadow, marginBottom:4, border:`1px solid ${concluido?T.sucesso+'40':T.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                          <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'1px 7px', fontSize:9, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <StatusBadge status={card.status}/>
                            <button onClick={()=>setParadaRemover(parada)}
                              style={{ background:T.perigoLight, border:`1px solid ${T.perigo}30`, borderRadius:T.rSm, padding:'1px 6px', cursor:'pointer', color:T.perigo, fontSize:10, fontFamily:FONT, fontWeight:700 }}>
                              × Remover
                            </button>
                          </div>
                        </div>
                        <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT, marginBottom:2 }}>{card.client}</div>
                        <div style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}>{parada.destino} · {fmt(card.startDate)}</div>
                        {concluido && concluidoEm && (
                          <div style={{ color:T.sucesso, fontSize:10, fontFamily:FONT, marginTop:3 }}>
                            ✅ Concluído — expira do rotograma em {new Date(concluidoEm.getTime()+48*3600*1000).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                          </div>
                        )}
                        {!concluido && <a href={`https://waze.com/ul?q=${encodeURIComponent(parada.destino+' '+parada.destinoUF)}&navigate=yes`} target="_blank" rel="noreferrer"
                          style={{ display:'inline-block', marginTop:6, background:'#33CCFF', color:'white', borderRadius:T.rSm, padding:'4px 10px', fontSize:10, fontWeight:700, fontFamily:FONT, textDecoration:'none' }}>
                          🔵 Abrir no Waze
                        </a>}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      <ConfirmModal open={!!paradaRemover} danger title="Remover parada"
        message={`Remover "${paradaRemover?.cliente}" do rotograma?`}
        confirmLabel="× Remover"
        onConfirm={async ()=>{
          try {
            const novasParadas = rotograma.paradas.filter(p=>p.cardId!==paradaRemover.cardId)
            await updateDoc(doc(db,'rotogramas',rotograma.id), { paradas:novasParadas, updatedAt:serverTimestamp() })
            setRotograma(prev=>prev?{...prev,paradas:novasParadas}:null)
          } catch(e){ console.error('Erro ao remover parada:',e) }
          setParadaRemover(null)
        }}
        onCancel={()=>setParadaRemover(null)}/>
    </div>
  )
}
