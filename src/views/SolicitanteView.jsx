import { useState, useMemo } from 'react'
import { buscarGrupoModelo } from '../lib/freteCalc'
import { RequestForm } from '../components/RequestForm'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useNotifications, useMessages } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ClientInput, FrotaInput, MunicipioInput, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, IS, LS, BS } from '../lib/constants'
import { fmt, todayStr, getSubtypeLabel } from '../lib/utils'
import { db } from '../lib/firebase'
import { MessageThread } from '../components/MessageThread'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// sortByUrgency inline — não depende de export do constants.js
const _URGENCY_ORDER = { critico: 0, alto: 1, medio: 2, baixo: 3 }
function sortByUrgency(items, dateField) {
  return [...items].sort((a, b) => {
    const d = (_URGENCY_ORDER[a.urgency]??99) - (_URGENCY_ORDER[b.urgency]??99)
    if (d !== 0) return d
    return new Date(a[dateField||'desiredDate']||'9999') - new Date(b[dateField||'desiredDate']||'9999')
  })
}

const STATUS_CONFIG = {
  pendente_supervisor: { label:'⏳ Aguard. Supervisor',  color:'#B8860B',  bg:'#FFF8E1'      },
  pendente_gerente:    { label:'📋 Aguard. Gerência',    color:T.info,     bg:T.infoLight    },
  pendente:            { label:'⏳ Aguardando análise',  color:T.amarelo,  bg:T.amareloLight },
  aceito:              { label:'✅ Aceito',               color:T.verde,    bg:T.verdeLight   },
  recusado:            { label:'❌ Recusado',             color:T.perigo,   bg:T.perigoLight  },
  cancelado:           { label:'🚫 Cancelado',            color:T.textMuted,bg:T.surfaceLow  },
  concluido:           { label:'✅ Concluído',             color:T.verde,    bg:T.verdeLight  },
}

const URGENCY_SLA = { critico:'até 4h', alto:'até 24h', medio:'até 3 dias', baixo:'até 7 dias' }
const SUBTYPES_NF       = ['desmobilizacao','rollout','quebra_contrato','troca_tecnica','sinistro','garantia']
const SUBTYPES_EMBARQUE = ['troca_tecnica','sinistro','garantia']
const SUBTYPES_OFICINA  = ['garantia']
const SUBTYPES_MAQUINA_RESERVA = ['troca_tecnica','sinistro','garantia']

export function SolicitanteView({ simClients }) {
  const { profile, logout }         = useAuth()
  const { requests, submitRequest } = useRequests('solicitante')
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { toasts, add:addToast, dismiss } = useToasts()
  const [showForm,   setShowForm]   = useState(false)
  const [reopenData, setReopenData] = useState(null)
  const [messaging,  setMessaging]  = useState(null)
  const [search,     setSearch]     = useState('')

  const handleSubmit = async form => {
    const grupo = buscarGrupoModelo(form.nInternos || (form.nInterno ? [form.nInterno] : []), simClients)
    const machineLabel = form.nInternosReserva.length > 0 ? form.nInternosReserva.join(', ') : form.machine||''
    try {
      // O RequestForm já passa form.id quando é um reenvio (initialData.id).
      // Não precisa mais de lógica extra aqui — submitRequest detecta pelo form.id.
      await submitRequest({ ...form, grupoModelo: grupo || '', machine: machineLabel })
      addToast(form.id ? 'Solicitação ajustada e reenviada! O time de Frotas foi notificado.' : 'Solicitação enviada! O time de Frotas foi notificado.', 'success')
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err)
      throw err
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return sortByUrgency(requests, 'desiredDate')
    const normQ = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const normS  = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const q = normQ // alias
    return sortByUrgency(requests.filter(r =>
      normS(r.clientName).includes(normQ) ||
      normS(r.machine).includes(normQ) ||
      normS(r.originCityName||r.origin).includes(normQ) ||
      normS(r.destCityName||r.destination).includes(normQ) ||
      normS(r.nInterno).includes(normQ) ||
      normS(r.requesterName).includes(normQ) ||
      normS(r.status).includes(normQ)
    ), 'desiredDate')
  }, [requests, search])

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase' }}>Portal do Solicitante</div>
            <div style={{ color:T.textMuted, fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>{profile?.unit||'mills'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={logout} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 12px' }}>
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          style={{ background:`linear-gradient(135deg, ${T.verde}, #006466)`, borderRadius:T.rLg, padding:'24px 28px', marginBottom:22,
            display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:T.shadowMd, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ color:'rgba(255,255,255,.65)', fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>Mills Pesados · Gestão de Frotas</div>
            <h2 style={{ color:'white', fontFamily:FONT, fontWeight:900, fontSize:22, margin:'0 0 5px' }}>Precisa de frete ou guindauto?</h2>
            <p style={{ color:'rgba(255,255,255,.7)', fontFamily:FONT, fontSize:12, margin:0 }}>Solicite agora. O time de Frotas recebe em tempo real.</p>
          </div>
          <button onClick={()=>setShowForm(true)}
            style={{ ...BS, background:T.laranja, color:'white', fontWeight:900, fontSize:14, padding:'13px 22px', borderRadius:T.rLg, boxShadow:'0 4px 16px rgba(243,112,33,.4)', whiteSpace:'nowrap', position:'relative', zIndex:1 }}>
            + Nova Solicitação
          </button>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Total',     value:requests.length,                                  color:T.laranja, bg:T.laranjaLight },
            { label:'Pendentes', value:requests.filter(r=>['pendente','pendente_supervisor','pendente_gerente'].includes(r.status)).length, color:T.amarelo, bg:T.amareloLight },
            { label:'Aceitas',   value:requests.filter(r=>r.status==='aceito').length,   color:T.verde,   bg:T.verdeLight   },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}30`, borderRadius:T.rLg, padding:'14px 16px' }}>
              <div style={{ color:s.color, fontFamily:FONT, fontWeight:900, fontSize:26, lineHeight:1 }}>{s.value}</div>
              <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Campo de pesquisa */}
        <div style={{ marginBottom:14, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:T.textMuted }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Buscar por cliente, equipamento, rota, N° interno..."
            style={{ ...IS, paddingLeft:36, width:'100%', boxSizing:'border-box' }}/>
          {search && (
            <button onClick={()=>setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:16 }}>×</button>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:16, margin:0 }}>Minhas Solicitações</h3>
          {search && <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12 }}>{filtered.length} resultado(s)</span>}
        </div>

        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
            <div style={{ fontSize:44, marginBottom:10 }}>{search?'🔍':'📭'}</div>
            <p>{search?'Nenhuma solicitação encontrada.':'Nenhuma solicitação ainda.'}</p>
          </div>
        )}

        {/* Vista em colunas por estágio — escondida durante busca */}
        {!search && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:8, alignItems:'start' }}>
            {[
              { key:'pendentes', label:'⏳ Em análise', statuses:['pendente','pendente_supervisor','pendente_gerente'], color:T.amarelo, bg:T.amareloLight },
              { key:'aceitas',   label:'✅ Aceitas',    statuses:['aceito'],    color:T.verde,   bg:T.verdeLight   },
              { key:'historico', label:'📋 Histórico',  statuses:['concluido','recusado','cancelado'], color:T.textMuted, bg:T.surfaceAlt },
            ].map(col => {
              const items = sortByUrgency(requests.filter(r => col.statuses.includes(r.status)), 'desiredDate')
              return (
                <div key={col.key} style={{ background:col.bg, border:`1px solid ${col.color}30`, borderRadius:T.rLg, padding:'10px 12px', minHeight:80 }}>
                  <div style={{ color:col.color, fontFamily:FONT, fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                    {col.label}
                    {items.length > 0 && <span style={{ background:col.color+'30', borderRadius:10, padding:'1px 7px', fontSize:10 }}>{items.length}</span>}
                  </div>
                  {items.length===0 && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, textAlign:'center', padding:'16px 0' }}>—</div>}
                  {items.map(r => {
                    const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente
                    const ct = CARD_TYPES[r.type]
                    const ug = URGENCY[r.urgency]
                    return (
                      <motion.div key={r.id} layout initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                        style={{ background:T.surface, border:`1.5px solid ${sc.color}20`, borderRadius:T.r, padding:'10px 12px', marginBottom:8, boxShadow:T.shadow }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'1px 7px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                          <span style={{ fontSize:11 }}>{ug?.icon}</span>
                        </div>
                        <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT, marginBottom:2 }}>{r.clientName||r.plantaObra||'—'}</div>
                        <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginBottom:5 }}>{fmt(r.desiredDate)} · {r.nInterno||'—'}</div>
                        <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'1px 8px', fontSize:9, fontWeight:700, fontFamily:FONT }}>{sc.label}</span>
                        {r.responseNote && (
                          <div style={{ marginTop:6, padding:'5px 8px', background:T.perigoLight, borderRadius:T.rSm, color:T.perigo, fontSize:10, fontFamily:FONT }}>{r.responseNote}</div>
                        )}
                        <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                          <button onClick={()=>setMessaging(r)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, fontWeight:700 }}>💬</button>
                          {(r.status==='recusado' || r.status==='cancelado') && (
                            <button onClick={()=>setReopenData(r)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}40`, fontSize:10, fontWeight:700, flex:1 }}>🔄 Reabrir</button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Lista flat — só visível quando há busca ativa */}
        {search && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🔍</div>
                <p>Nenhuma solicitação encontrada.</p>
              </div>
            )}
            {filtered.map(r => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente
              const ct = CARD_TYPES[r.type]
              const ug = URGENCY[r.urgency]
              return (
                <motion.div key={r.id} layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                  style={{ background:T.surface, border:`1.5px solid ${sc.color}25`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                      {r.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(r.type,r.subtype)}</span>}
                      <span style={{ background:sc.bg, borderRadius:20, padding:'2px 9px', color:sc.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{sc.label}</span>
                    </div>
                    <span style={{ fontSize:14 }}>{ug?.icon}</span>
                  </div>
                  <div style={{ color:T.text, fontWeight:700, fontSize:14, fontFamily:FONT, marginBottom:4 }}>{r.clientName||r.plantaObra||'—'}</div>
                  <div style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, marginBottom:8 }}>{fmt(r.desiredDate)} · {r.nInterno||'—'} · {r.originCityName||r.origin||'—'} → {r.destCityName||r.destination||'—'}</div>
                  {r.responseNote && <div style={{ padding:'6px 10px', background:T.perigoLight, borderRadius:T.rSm, color:T.perigo, fontSize:10, fontFamily:FONT, marginBottom:8 }}>{r.responseNote}</div>}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={()=>setMessaging(r)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:11, fontWeight:700 }}>💬 Histórico</button>
                    {(r.status==='recusado' || r.status==='cancelado') && (
                      <button onClick={()=>setReopenData(r)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}40`, fontSize:11, fontWeight:700 }}>🔄 Reabrir e ajustar</button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {messaging && <MessageThread requestId={messaging.id} profile={profile} onClose={()=>setMessaging(null)}/>}
      {(showForm||reopenData) && (
        <RequestForm simClients={simClients||[]} profile={profile} initialData={reopenData||null}
          onSubmit={handleSubmit} onClose={()=>{setShowForm(false);setReopenData(null)}}/>
      )}
    </div>
  )
}
