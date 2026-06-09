import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/firebase'
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { T, FONT, CARD_TYPES, URGENCY } from '../lib/constants'
import { fmt } from '../lib/utils'

function StatusBadge({ status }) {
  const cfg = {
    confirmado:          { label:'📋 Aguardando',      color:T.amarelo,  bg:T.amareloLight },
    em_execucao:         { label:'🚛 Em execução',      color:T.verde,    bg:T.verdeLight   },
    aguardando_validacao:{ label:'⏳ Aguard. validação',color:T.info,     bg:T.infoLight    },
    concluido:           { label:'✅ Concluído',         color:T.sucesso,  bg:T.sucessoLight },
    cancelado:           { label:'🚫 Cancelado',         color:T.textMuted,bg:T.surfaceLow  },
  }
  const c = cfg[status] || cfg.confirmado
  return (
    <span style={{ background:c.bg, color:c.color, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, fontFamily:FONT, whiteSpace:'nowrap' }}>
      {c.label}
    </span>
  )
}

function ServicoCard({ card, index, onUpdateStatus }) {
  const ct = CARD_TYPES[card.type]
  const ug = URGENCY[card.urgency]
  const [updating, setUpdating] = useState(false)

  const origem  = card.originCity  || card.origin      || '—'
  const destino = card.destCity    || card.destination  || '—'
  const origemUF  = card.origin    || ''
  const destinoUF = card.destination || ''

  const wazeUrl  = `https://waze.com/ul?q=${encodeURIComponent(destino + ' ' + destinoUF)}&navigate=yes`
  const mapsUrl  = `https://www.google.com/maps/dir/${encodeURIComponent(origem + ' ' + origemUF)}/${encodeURIComponent(destino + ' ' + destinoUF)}`

  const handleStatus = async (novoStatus) => {
    setUpdating(true)
    await onUpdateStatus(card.id, novoStatus)
    setUpdating(false)
  }

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: index * 0.05 }}
      style={{ background:T.surface, borderRadius:T.rLg, padding:'16px', marginBottom:12, boxShadow:T.shadowMd, border:`1.5px solid ${ct?.color}30`, position:'relative', overflow:'hidden' }}>

      {/* Faixa lateral colorida */}
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
            <div style={{ color:T.text, fontWeight:700, fontSize:15, fontFamily:FONT }}>{card.client || '—'}</div>
          </div>
          <StatusBadge status={card.status}/>
        </div>

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
            ['📅 Data',      fmt(card.startDate)],
            ['⚡ Urgência',  `${ug?.icon} ${ug?.label}`],
            ['🔧 Máquina',   card.machine || '—'],
            ['🔢 N° Interno',card.nInterno || '—'],
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

        {/* Botões de navegação */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <a href={wazeUrl} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#33CCFF', color:'white', borderRadius:T.r, padding:'10px', fontFamily:FONT, fontWeight:700, fontSize:12, textDecoration:'none' }}>
            <span style={{ fontSize:16 }}>🔵</span> Waze
          </a>
          <a href={mapsUrl} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#4285F4', color:'white', borderRadius:T.r, padding:'10px', fontFamily:FONT, fontWeight:700, fontSize:12, textDecoration:'none' }}>
            <span style={{ fontSize:16 }}>🗺</span> Maps
          </a>
        </div>

        {/* Ações de status */}
        {card.status === 'confirmado' && (
          <button onClick={() => handleStatus('em_execucao')} disabled={updating}
            style={{ width:'100%', background:T.verde, color:'white', border:'none', borderRadius:T.r, padding:'12px', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            {updating ? '⏳...' : '🚛 Iniciar Execução'}
          </button>
        )}
        {card.status === 'em_execucao' && (
          <button onClick={() => handleStatus('aguardando_validacao')} disabled={updating}
            style={{ width:'100%', background:T.laranja, color:'white', border:'none', borderRadius:T.r, padding:'12px', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            {updating ? '⏳...' : '✅ Marcar como Concluído'}
          </button>
        )}
        {card.status === 'aguardando_validacao' && (
          <div style={{ background:T.infoLight, borderRadius:T.r, padding:'10px 12px', textAlign:'center', color:T.info, fontFamily:FONT, fontSize:12, fontWeight:700 }}>
            ⏳ Aguardando validação do analista
          </div>
        )}
        {card.status === 'concluido' && (
          <div style={{ background:T.verdeLight, borderRadius:T.r, padding:'10px 12px', textAlign:'center', color:T.verde, fontFamily:FONT, fontSize:12, fontWeight:700 }}>
            ✅ Serviço concluído e validado
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function MotoristaView({ token }) {
  const [driver,   setDriver]   = useState(null)
  const [cards,    setCards]    = useState([])
  const [rotograma,setRotograma]= useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('hoje')

  useEffect(() => {
    if (!token) { setError('Link inválido.'); setLoading(false); return }

    // Busca motorista pelo token
    const q = query(collection(db, 'drivers'), where('token', '==', token), where('active', '==', true))
    const unsub = onSnapshot(q, async snap => {
      if (snap.empty) { setError('Link inválido ou motorista inativo.'); setLoading(false); return }
      const driverData = { id: snap.docs[0].id, ...snap.docs[0].data() }
      setDriver(driverData)

      // Busca cards atribuídos ao motorista
      const cardsQ = query(collection(db, 'cards'), where('driverId', '==', driverData.id))
      onSnapshot(cardsQ, cardsSnap => {
        const all = cardsSnap.docs.map(d => ({ id:d.id, ...d.data() }))
          .filter(c => c.status !== 'cancelado')
          .sort((a,b) => a.startDate?.localeCompare(b.startDate))
        setCards(all)
        setLoading(false)
      })

      // Busca rotograma ativo do motorista
      const rotQ = query(collection(db, 'rotogramas'), where('driverId', '==', driverData.id), where('status', '==', 'ativo'))
      onSnapshot(rotQ, rotSnap => {
        if (!rotSnap.empty) setRotograma({ id: rotSnap.docs[0].id, ...rotSnap.docs[0].data() })
        else setRotograma(null)
      })
    }, () => { setError('Erro ao carregar dados.'); setLoading(false) })

    return unsub
  }, [token])

  const handleUpdateStatus = async (cardId, novoStatus) => {
    await updateDoc(doc(db, 'cards', cardId), {
      status:    novoStatus,
      updatedAt: serverTimestamp(),
      ...(novoStatus === 'em_execucao'          ? { startedAt:   serverTimestamp() } : {}),
      ...(novoStatus === 'aguardando_validacao' ? { completedAt: serverTimestamp() } : {}),
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const cardsHoje    = cards.filter(c => c.startDate === today)
  const cardsSemana  = cards.filter(c => c.startDate > today)
  const cardsAntigos = cards.filter(c => c.startDate < today && c.status !== 'concluido')

  // Monta URL multi-parada para rotograma
  const rotogramaUrl = rotograma?.paradas?.length > 1
    ? `https://www.google.com/maps/dir/${rotograma.paradas.map(p => encodeURIComponent(`${p.destino} ${p.destinoUF}`)).join('/')}`
    : null

  if (loading) return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
        <div style={{ color:T.textMuted, fontFamily:FONT }}>Carregando...</div>
      </div>
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

      {/* Header */}
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

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'rgba(0,0,0,0.2)', borderRadius:T.r, padding:3 }}>
          {[['hoje','📅 Hoje'],['semana','📆 Próximos'],['rotograma','🗺 Rotograma']].map(([v,l]) => (
            <button key={v} onClick={()=>setTab(v)}
              style={{ flex:1, padding:'6px 4px', borderRadius:T.rSm, border:'none', background:tab===v?T.laranja:'transparent', color:tab===v?'white':'rgba(255,255,255,0.65)', fontFamily:FONT, fontWeight:700, fontSize:11, cursor:'pointer', transition:'all .15s' }}>
              {l}
              {v==='hoje'&&cardsHoje.length>0&&<span style={{ marginLeft:4, background:'rgba(255,255,255,0.3)', borderRadius:10, padding:'0 5px', fontSize:9 }}>{cardsHoje.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px' }}>

        {/* ABA HOJE */}
        {tab==='hoje' && (
          <>
            {cardsAntigos.length > 0 && (
              <div style={{ background:T.perigoLight, borderRadius:T.r, padding:'10px 14px', marginBottom:14, border:`1px solid ${T.perigo}30` }}>
                <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:12 }}>⚠️ {cardsAntigos.length} serviço(s) pendente(s) de dias anteriores</div>
              </div>
            )}
            {cardsHoje.length === 0 && cardsAntigos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🎉</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Nenhum serviço para hoje!</p>
              </div>
            ) : (
              <>
                {cardsAntigos.map((c,i) => <ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
                {cardsHoje.map((c,i)    => <ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
              </>
            )}
          </>
        )}

        {/* ABA PRÓXIMOS */}
        {tab==='semana' && (
          <>
            {cardsSemana.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
                <p>Nenhum serviço programado.</p>
              </div>
            ) : cardsSemana.map((c,i) => <ServicoCard key={c.id} card={c} index={i} onUpdateStatus={handleUpdateStatus}/>)}
          </>
        )}

        {/* ABA ROTOGRAMA */}
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
                  <div style={{ fontFamily:FONT, fontSize:11, opacity:0.7 }}>Criado por {rotograma.criadoPor} · {rotograma.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR') || ''}</div>
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

                {rotograma.paradas?.map((parada, i) => {
                  const card = cards.find(c => c.id === parada.cardId)
                  if (!card) return null
                  const ct = CARD_TYPES[card.type]
                  return (
                    <div key={parada.cardId} style={{ display:'flex', gap:10, marginBottom:10 }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:T.laranja, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontWeight:700, fontSize:13, flexShrink:0 }}>{i+1}</div>
                        {i < rotograma.paradas.length - 1 && <div style={{ width:2, flex:1, background:T.border, minHeight:20, marginTop:4 }}/>}
                      </div>
                      <div style={{ flex:1, background:T.surface, borderRadius:T.r, padding:'10px 12px', boxShadow:T.shadow, marginBottom:4, border:`1px solid ${T.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                          <div>
                            <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'1px 7px', fontSize:9, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                          </div>
                          <StatusBadge status={card.status}/>
                        </div>
                        <div style={{ color:T.text, fontWeight:700, fontSize:13, fontFamily:FONT, marginBottom:2 }}>{card.client}</div>
                        <div style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}>{parada.destino} · {fmt(card.startDate)}</div>
                        <a href={`https://waze.com/ul?q=${encodeURIComponent(parada.destino+' '+parada.destinoUF)}&navigate=yes`} target="_blank" rel="noreferrer"
                          style={{ display:'inline-block', marginTop:6, background:'#33CCFF', color:'white', borderRadius:T.rSm, padding:'4px 10px', fontSize:10, fontWeight:700, fontFamily:FONT, textDecoration:'none' }}>
                          🔵 Abrir no Waze
                        </a>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
