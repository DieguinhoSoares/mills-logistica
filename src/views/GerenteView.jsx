import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useManagerialRequests, useCards, useNotifications, useConfig, approveAsSupervisor, refuseAsSupervisor, approveAsGerente, refuseAsGerente } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, URGENCY, URGENCY_SLA_MS, BS, IS, LS, SHADOW_CARD, BORDER_SUBTLE } from '../lib/constants'
import { fmt, getSubtypeLabel, sortByUrgency } from '../lib/utils'
import { db } from '../lib/firebase'
import { salvarWhatsAppConfig } from '../lib/vercelApi'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { FreteEstimativa } from '../components/FreteEstimativa'
import { formatBRL } from '../lib/freteCalc'

const STATUS_CONFIG = {
  pendente_supervisor: { label:'⏳ Aguard. Supervisor', color:'#B8860B', bg:'#FFF8E1' },
  pendente_gerente:    { label:'📋 Aguard. Gerência',   color:T.info,    bg:T.infoLight },
  pendente:            { label:'🚛 No time de Frotas',  color:T.verde,   bg:T.verdeLight },
  aceito:              { label:'✅ Aceito',              color:T.sucesso, bg:T.sucessoLight },
  recusado:            { label:'❌ Recusado',            color:T.perigo,  bg:T.perigoLight },
  cancelado:           { label:'🚫 Cancelado',           color:T.textMuted, bg:T.surfaceLow },
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

function ApprovalModal({ req, profile, onApprove, onRefuse, onClose, isMobile, simClients, linkedCard }) {
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const ct = CARD_TYPES[req.type]
  const ug = URGENCY[req.urgency]
  const isSupervisorStep = req.status === 'pendente_supervisor'
  const stepLabel = profile?.role === 'master' ? 'Master' : isSupervisorStep ? 'Supervisor' : 'Gerente'
  // Mesma regra já usada em Mobile/DesktopRequestCard pra decidir o rótulo
  // do botão que abre este modal ("Avaliar" vs "Ver Detalhes") — mas antes
  // só mudava o RÓTULO: o modal em si sempre deixava Aprovar/Recusar
  // habilitados, mesmo pra quem clicou em "Ver Detalhes" (etapa errada, ou
  // solicitação já decidida/recusada por outra pessoa). Qualquer
  // Supervisor/Gerente conseguia reverter uma decisão que não era da
  // alçada dele. Agora o modal recalcula a mesma regra e trava a ação.
  const podeDecidir =
    (profile?.role==='supervisor' && req.status==='pendente_supervisor') ||
    (profile?.role==='gerente'    && req.status==='pendente_gerente') ||
    (profile?.role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  const handleApprove = async () => {
    setSaving(true)
    try {
      await onApprove(req.id, note, profile?.name, profile?.role)
      await addDoc(collection(db,'requests',req.id,'messages'), {
        text: note || `Aprovado pelo ${stepLabel}.`,
        authorId: profile?.uid||'', authorName: profile?.name||stepLabel,
        authorRole: profile?.role||'gerente',
        type:'status_change', statusEvent:'aprovado_gerencial', createdAt:serverTimestamp(),
      })
      onClose()
    } catch (err) {
      console.error('Erro ao aprovar:', err)
      setError('Erro ao aprovar. Verifique a conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRefuse = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await onRefuse(req.id, note, profile?.name)
      await addDoc(collection(db,'requests',req.id,'messages'), {
        text: `Recusado pelo ${stepLabel}. Motivo: ${note}`,
        authorId: profile?.uid||'', authorName: profile?.name||stepLabel,
        authorRole: profile?.role||'gerente',
        type:'status_change', statusEvent:'recusado_gerencial', createdAt:serverTimestamp(),
      })
      onClose()
    } catch (err) {
      console.error('Erro ao recusar:', err)
      setError('Erro ao recusar. Verifique a conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.6)', zIndex:2000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ y:isMobile?100:0, scale:isMobile?1:.95, opacity:0 }} animate={{ y:0, scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:isMobile?'20px 20px 0 0':18, padding:isMobile?'20px 16px 32px':28,
          width:isMobile?'100%':540, maxHeight:isMobile?'92vh':'90vh', overflowY:'auto', boxShadow:SHADOW_CARD, border:BORDER_SUBTLE }}>

        {isMobile && <div style={{ width:40, height:4, background:T.borderMid, borderRadius:2, margin:'0 auto 16px', flexShrink:0 }}/>}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:isMobile?18:20, margin:0 }}>📋 Avaliar Solicitação</h2>
            <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:3 }}>
              Alçada: <strong style={{ color:T.laranja }}>{stepLabel}</strong>
            </div>
          </div>
          {!isMobile && <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>}
        </div>

        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
            <span style={{ background:ug?.bg, borderRadius:20, padding:'3px 10px', color:ug?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type, req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Solicitante',   req.requesterName||'—'],
              ['Unidade',       req.unit||'—'],
              ['Planta/Obra',   req.clientName||'—'],
              ['Data',          fmt(req.desiredDate)],
              ['Rota',          `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
              ['N° Interno(s)', req.nInternos?.join(', ')||req.nInterno||'—'],
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Frotas envolvidas — Troca Técnica / Sinistro / Garantia */}
          {['troca_tecnica','sinistro','garantia'].includes(req.subtype) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10, padding:'10px 12px', background:T.surfaceLow, borderRadius:T.rSm, border:`1px solid ${T.border}` }}>
              <div>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:4 }}>🚜 Reserva (vai ao cliente)</div>
                <div style={{ color:T.verde, fontWeight:700, fontSize:12, fontFamily:FONT }}>{req.machine||'—'}</div>
              </div>
              <div>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:4 }}>🔧 Danificada (retorna)</div>
                <div style={{ color:T.perigo, fontWeight:700, fontSize:12, fontFamily:FONT }}>
                  {req.nInternosDanificados?.length>0 ? req.nInternosDanificados.join(', ') : req.nInternos?.join(', ')||'—'}
                </div>
              </div>
              {req.podeEmbarcar && (
                <div>
                  <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:4 }}>Embarque</div>
                  <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>
                    {req.podeEmbarcar==='sim' ? '✅ Pode embarcar normalmente' : '⚠️ Requer equipamento especial'}
                  </div>
                </div>
              )}
              {req.destinoOficina && (
                <div>
                  <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:4 }}>Destino oficina</div>
                  <div style={{ color:T.info, fontWeight:600, fontSize:12, fontFamily:FONT }}>
                    {req.destinoOficina==='mills' ? '🏭 Oficina Mills' : '🏢 Concessionária'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <FreteEstimativa request={req} simClients={simClients} readOnly={true}/>

        {/* Custo real — só existe depois que a Frotas atribui motorista/transportadora
            (fica salvo no card, não na solicitação). A estimativa acima é sempre a
            tarifa Hengel padrão, calculada antes de saber quem vai executar; aqui é
            o valor de verdade, já com desconto de motorista Mills se for o caso. */}
        {linkedCard?.freteEstimado != null && (
          <div style={{ background:T.verdeLight, border:`1px solid ${T.verde}40`, borderRadius:T.r, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ color:T.verde, fontFamily:FONT, fontWeight:800, fontSize:11, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              💰 Custo real (atribuído pela Frotas)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase' }}>Executado por</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{linkedCard.driver||'—'}</div>
              </div>
              <div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase' }}>Veículo</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{linkedCard.veiculoLabel||'—'}</div>
              </div>
              <div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase' }}>Custo</div>
                <div style={{ color:T.laranja, fontWeight:800, fontSize:15, fontFamily:FONT }}>{formatBRL(linkedCard.freteEstimado)}</div>
              </div>
            </div>
          </div>
        )}

        {req.approvalLog?.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Histórico</div>
            {req.approvalLog.map((log, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:5, padding:'7px 10px', background:log.action==='approved'?T.verdeLight:T.perigoLight, borderRadius:T.rSm }}>
                <span>{log.action==='approved'?'✅':'❌'}</span>
                <div>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:700 }}>{log.approver} <span style={{ color:T.textMuted, fontWeight:400 }}>({log.step})</span></div>
                  {log.note && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10 }}>{log.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {podeDecidir ? <>
          <div style={{ marginBottom:14 }}>
            <label style={LS}>Observação <span style={{ color:T.textMuted, fontWeight:400, fontSize:10 }}>(obrigatório para recusa)</span></label>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Observação para o solicitante..."
              style={{ ...IS, height:isMobile?70:80, resize:'vertical', marginTop:5 }}/>
          </div>

          {error && (
            <div style={{ marginBottom:10, padding:'9px 12px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
              <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>⚠ {error}</div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <button onClick={handleRefuse} disabled={saving||!note.trim()}
              style={{ ...BS, background:note.trim()?T.perigoLight:T.borderMid, color:note.trim()?T.perigo:T.textMuted,
                border:`1px solid ${note.trim()?T.perigo+'40':T.border}`, fontWeight:700,
                padding:isMobile?'14px':'8px 16px', fontSize:isMobile?14:12, borderRadius:T.rLg, opacity:note.trim()?1:0.5 }}>
              ❌ Recusar
            </button>
            <button onClick={handleApprove} disabled={saving}
              style={{ ...BS, background:T.verde, color:'white', fontWeight:700,
                padding:isMobile?'14px':'8px 16px', fontSize:isMobile?14:12, borderRadius:T.rLg }}>
              {saving?'⏳...':'✅ Aprovar'}
            </button>
          </div>
        </> : (
          <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, color:T.textMuted, fontFamily:FONT, fontSize:11, lineHeight:1.5 }}>
            🔒 {['aceito','recusado','cancelado','pendente'].includes(req.status)
              ? 'Esta solicitação já foi decidida ou já passou dessa etapa — somente consulta.'
              : 'Esta solicitação não está na sua alçada no momento — somente consulta.'}
          </div>
        )}

        {isMobile && (
          <button onClick={onClose} style={{ ...BS, width:'100%', background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, marginTop:10, padding:'12px', fontSize:13, borderRadius:T.rLg }}>
            Cancelar
          </button>
        )}
      </motion.div>
    </div>
  )
}

function MobileRequestCard({ req, profile, onOpen }) {
  const ct = CARD_TYPES[req.type]
  const ug = URGENCY[req.urgency]
  const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente
  const canApprove =
    (profile?.role==='supervisor' && req.status==='pendente_supervisor') ||
    (profile?.role==='gerente'    && req.status==='pendente_gerente') ||
    (profile?.role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  return (
    <motion.div layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      style={{ background:T.surface, borderRadius:16, padding:'14px 16px', boxShadow:T.shadowCard, border:T.borderSubtle, marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
          {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
        </div>
        <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 10px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap', marginLeft:8 }}>{sc.label}</span>
      </div>

      <div style={{ marginBottom:8 }}>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:T.text }}>{req.requesterName||'—'}</div>
        <div style={{ fontFamily:FONT, fontSize:12, color:T.textMuted }}>{req.unit}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {[
          ['Equipamento', (req.nInternos?.length ? req.nInternos.join(', ') : req.machine) || '—'],
          ['Data', fmt(req.desiredDate)],
          ['Rota', `${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
          ['Urgência', `${ug?.icon} ${ug?.label}`],
        ].map(([l,v])=>(
          <div key={l}>
            <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
            <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
          </div>
        ))}
      </div>

      {canApprove && (
        <button onClick={()=>onOpen(req)}
          style={{ ...BS, width:'100%', background:T.laranja, color:'white', fontWeight:700, padding:'13px', fontSize:14, borderRadius:T.rLg }}>
          ✅ Avaliar Solicitação
        </button>
      )}
      {!canApprove && (
        <button onClick={()=>onOpen(req)}
          style={{ ...BS, width:'100%', background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontWeight:700, padding:'10px', fontSize:13, borderRadius:T.rLg }}>
          🔍 Ver Detalhes
        </button>
      )}
    </motion.div>
  )
}

function DesktopRequestCard({ req, profile, onView }) {
  const ct  = CARD_TYPES[req.type]
  const ug  = URGENCY[req.urgency]
  const sc  = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente
  const canApprove =
    (profile?.role==='supervisor' && req.status==='pendente_supervisor') ||
    (profile?.role==='gerente'    && req.status==='pendente_gerente') ||
    (profile?.role==='master'     && ['pendente_supervisor','pendente_gerente'].includes(req.status))

  return (
    <motion.div layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
      style={{ background:T.surface, border:T.borderSubtle, borderRadius:16, padding:'14px 16px', boxShadow:T.shadowCard, marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
          {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
          <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 9px', color:ug?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
        </div>
        <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        {[['Solicitante',req.requesterName||'—'],['Unidade',req.unit||'—'],['Equipamento',(req.nInternos?.length ? req.nInternos.join(', ') : req.machine)||'—'],
          ['Rota',`${req.originCityName||req.origin||'—'} → ${req.destCityName||req.destination||'—'}`],
          ['Data',fmt(req.desiredDate)],['Planta/Obra',req.clientName||'—']].map(([l,v])=>(
          <div key={l}>
            <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
            <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div>
          </div>
        ))}
      </div>
      {req.approvalLog?.length>0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
          {req.approvalLog.map((log,i)=>(
            <span key={i} style={{ background:log.action==='approved'?T.verdeLight:T.perigoLight, color:log.action==='approved'?T.verde:T.perigo, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>
              {log.action==='approved'?'✅':'❌'} {log.step}: {log.approver?.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={()=>onView(req)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 9px', fontWeight:700 }}>🔍 Detalhes</button>
        {canApprove && (
          <button onClick={()=>onView(req)} style={{ ...BS, background:T.verde, color:'white', fontSize:10, padding:'4px 12px', fontWeight:700 }}>✅ Avaliar</button>
        )}
      </div>
    </motion.div>
  )
}

export function GerenteView({ simClients = [] }) {
  const { profile, logout, user } = useAuth()
  // approveAsSupervisor/refuseAsSupervisor/approveAsGerente/refuseAsGerente agora são
  // funções standalone importadas direto — não criam mais um listener duplicado
  // e sem uso da coleção 'requests' (ver notas em useFirestore.js).
  const { requests: mgrReqs } = useManagerialRequests()
  // Custo real (com desconto de motorista Mills, se aplicável) só existe
  // depois que a Frotas atribui alguém — fica salvo no card, não na
  // solicitação. Sem isso, quem aprovou nunca tinha como saber quanto o
  // serviço custou de verdade — só via ao aprovar a estimativa Hengel
  // padrão, e o valor real ficava invisível pra sempre depois disso.
  const { cards } = useCards()
  const { notifications, unreadCount, markAllRead, markRead, deleteNotification, enablePush, disablePush } = useNotifications()
  const { config } = useConfig()
  const { toasts, add:addToast, dismiss } = useToasts()
  const isMobile = useIsMobile()

  const [tab,          setTab]        = useState('aprovacao')
  const [reviewing,    setReviewing]  = useState(null)
  const [filterStatus, setFilter]     = useState('todos')
  const [subTab,       setSubTab]      = useState('pendentes')
  const [waPhone,      setWaPhone]    = useState('')
  const [waApikey,     setWaApikey]   = useState('')
  const [savedWa,      setSavedWa]    = useState(false)

  const role = profile?.role

  const pendingSupervisor = mgrReqs.filter(r=>r.status==='pendente_supervisor')
  const pendingGerente    = mgrReqs.filter(r=>r.status==='pendente_gerente')
  const myPending = sortByUrgency(
    role==='supervisor' ? pendingSupervisor :
    role==='gerente'    ? pendingGerente    :
    role==='master'     ? [...pendingSupervisor, ...pendingGerente] : [],
    'desiredDate'
  )

  const filtered = filterStatus==='todos' ? mgrReqs : mgrReqs.filter(r=>r.status===filterStatus)

  const handleApproveFromModal = async (id, note, name, r) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    try {
      if (r==='supervisor' || (r==='master' && req.status==='pendente_supervisor')) await approveAsSupervisor(id, note, name, r)
      else await approveAsGerente(id, note, name, r)
      addToast('Solicitação aprovada!', 'success')
    } catch (err) {
      console.error('Erro ao aprovar solicitação:', err)
      addToast('Erro ao aprovar. Tente novamente.', 'error')
    }
  }

  const handleRefuseFromModal = async (id, note, name) => {
    const req = mgrReqs.find(x=>x.id===id)
    if (!req) return
    try {
      if (role==='supervisor' || (role==='master' && req.status==='pendente_supervisor')) await refuseAsSupervisor(id, note, name)
      else await refuseAsGerente(id, note, name)
      addToast('Solicitação recusada.', 'info')
    } catch (err) {
      console.error('Erro ao recusar solicitação:', err)
      addToast('Erro ao recusar. Tente novamente.', 'error')
    }
  }

  // Antes gravava direto em config/settings — documento legível por
  // QUALQUER usuário logado (item 1 da revisão de segurança). Agora chama
  // um endpoint no servidor (Vercel) que checa o role de quem está pedindo
  // e grava num lugar que o client nunca lê de volta.
  const handleSaveWhatsapp = async () => {
    try {
      const idToken = await user.getIdToken()
      await salvarWhatsAppConfig(waPhone, waApikey, idToken)
      setSavedWa(true); setTimeout(()=>setSavedWa(false), 2000)
      addToast('WhatsApp configurado!', 'success')
    } catch (err) {
      console.error('Erro ao salvar configuração do WhatsApp:', err)
      addToast(err.message || 'Erro ao salvar. Tente novamente.', 'error')
    }
  }

  const roleLabel = { supervisor:'👷 SUPERVISOR', gerente:'👔 GERENTE', master:'⭐ MASTER' }[role] || ''
  const totalPendentes = myPending.length
  const now = Date.now()
  const urgentesGer = myPending.filter(r => {
    const sla = URGENCY_SLA_MS[r.urgency]
    if (!sla || !['critico','alto'].includes(r.urgency)) return false
    return new Date(r.desiredDate).getTime() + sla - now < 2 * 3600000
  })
  const totalAprovados = mgrReqs.filter(r=>['pendente','aceito'].includes(r.status)).length
  const totalRecusados = mgrReqs.filter(r=>r.status==='recusado').length
  const historico = mgrReqs.filter(r=>!['pendente_supervisor','pendente_gerente'].includes(r.status))

  const TABS = [
    { id:'aprovacao', label:'📋 Aprovação', badge: totalPendentes||null },
    { id:'painel',    label:'📊 Painel',    badge: null },
    { id:'config',    label:'⚙️ Config',    badge: null },
  ]

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ background:T.bgCold, minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      {reviewing && <ApprovalModal req={reviewing} profile={profile} isMobile={true} onApprove={handleApproveFromModal} onRefuse={handleRefuseFromModal} onClose={()=>setReviewing(null)} simClients={simClients} linkedCard={cards.find(c=>c.requestId===reviewing.id)}/>}

      {/* Header mobile */}
      <div style={{ background:T.verde, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:T.shadowMd, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <MillsLogo height={24}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase' }}>{roleLabel}</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9 }}>{profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead} onDelete={deleteNotification} onEnablePush={enablePush} onDisablePush={disablePush}/>
          <button onClick={logout} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:T.r, padding:'5px 10px', fontFamily:FONT, fontSize:11, cursor:'pointer' }}>Sair</button>
        </div>
      </div>

      {/* Tab bar mobile */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, display:'flex', padding:'0 4px', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:11,
              color:tab===t.id?T.laranja:T.textMuted, borderBottom:`2px solid ${tab===t.id?T.laranja:'transparent'}`,
              transition:'all .15s', position:'relative' }}>
            {t.label}
            {t.badge>0 && <span style={{ position:'absolute', top:6, right:'calc(50% - 18px)', background:T.perigo, color:'white', borderRadius:10, fontSize:9, fontWeight:800, padding:'0 4px', fontFamily:FONT }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo mobile */}
      <div style={{ flex:1, overflow:'auto', padding:'12px 14px' }}>

        {tab==='aprovacao' && <>
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', gap:5, background:T.surfaceAlt, padding:3, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:12 }}>
              {[['pendentes','⏳ Pendentes'],['historico','📋 Histórico']].map(([id,label])=>(
                <button key={id} onClick={()=>setSubTab(id)}
                  style={{ flex:1, padding:'6px 8px', borderRadius:T.rSm, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:600, fontSize:11,
                    background: subTab===id ? T.laranja : 'transparent', color: subTab===id ? 'white' : T.textSec }}>
                  {label}{id==='pendentes'&&myPending.length>0?` (${myPending.length})`:''}
                </button>
              ))}
            </div>
          </div>
          {subTab==='pendentes' && (<>
            {myPending.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:50, marginBottom:10 }}>✅</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Tudo em dia!</p>
              </div>
            )}
            {myPending.map(r => <MobileRequestCard key={r.id} req={r} profile={profile} onOpen={setReviewing}/>)}
          </>)}
          {subTab==='historico' && (<>
            {historico.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📋</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Nenhum histórico.</p>
              </div>
            )}
            {historico.map(r => <MobileRequestCard key={r.id} req={r} profile={profile} onOpen={setReviewing}/>)}
          </>)}
        </>}

        {tab==='painel' && <>
          <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:T.text, margin:'0 0 14px' }}>Painel Gerencial</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              { l:'Total',        v:mgrReqs.length,   c:T.laranja, bg:T.laranjaLight },
              { l:'Aguardando',   v:myPending.length, c:'#B8860B',  bg:'#FFF8E1'     },
              { l:'No time Frotas',v:totalAprovados,  c:T.verde,   bg:T.verdeLight  },
              { l:'Recusadas',    v:totalRecusados,   c:T.perigo,  bg:T.perigoLight },
            ].map(s=>(
              <div key={s.l} style={{ background:s.bg, border:BORDER_SUBTLE, borderRadius:16, padding:'14px 12px', boxShadow:SHADOW_CARD }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:800, fontSize:28, lineHeight:1, letterSpacing:'-.02em' }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, fontWeight:600, letterSpacing:'-.005em', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
            {[['todos','Todos'],['pendente_supervisor','Supervisor'],['pendente_gerente','Gerência'],['pendente','Frotas'],['aceito','Aceito'],['recusado','Recusado']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ ...BS, background:filterStatus===v?T.laranja:T.surface, color:filterStatus===v?'white':T.textSec,
                  border:`1px solid ${filterStatus===v?T.laranja:T.border}`, fontSize:11, padding:'6px 12px', whiteSpace:'nowrap', flexShrink:0 }}>
                {l}
              </button>
            ))}
          </div>
          {filtered.map(r => <MobileRequestCard key={r.id} req={r} profile={profile} onOpen={setReviewing}/>)}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'30px 0', color:T.textMuted, fontFamily:FONT }}>📭 Nenhuma solicitação neste filtro.</div>}
        </>}

        {tab==='config' && (
          <div style={{ maxWidth:500 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:18, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
            <div style={{ background:T.surface, borderRadius:16, border:BORDER_SUBTLE, padding:16, boxShadow:SHADOW_CARD }}>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>💬 Número WhatsApp (ex: 5518999999999)</label>
                <input value={waPhone} onChange={e=>setWaPhone(e.target.value)} placeholder="5518999999999" style={{ ...IS, marginTop:6 }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>🔑 CallMeBot API Key</label>
                <input value={waApikey} onChange={e=>setWaApikey(e.target.value)} placeholder="Ex: 5517289" style={{ ...IS, marginTop:6 }}/>
                <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                  Ative: salve +34 644 52 74 88 e envie <strong>I allow callmebot to send me messages</strong>
                </p>
              </div>
              <button onClick={handleSaveWhatsapp} style={{ ...BS, width:'100%', background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700, padding:'13px', fontSize:14, borderRadius:T.rLg }}>
                {savedWa?'✅ Salvo!':'💾 Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav indicator */}
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'6px 16px', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
      </div>
    </div>
  )

  // ── DESKTOP LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ background:T.bgCold, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      {reviewing && <ApprovalModal req={reviewing} profile={profile} isMobile={false} onApprove={handleApproveFromModal} onRefuse={handleRefuseFromModal} onClose={()=>setReviewing(null)} simClients={simClients} linkedCard={cards.find(c=>c.requestId===reviewing.id)}/>}

      <div style={{ background:T.verde, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0, boxShadow:T.shadowMd }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.2)' }}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>{roleLabel}</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>Fluxo de Aprovação · {profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'5px 14px', borderRadius:T.r, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:11, transition:'all .15s', position:'relative',
                background:tab===t.id?T.laranja:'rgba(255,255,255,0.12)', color:tab===t.id?'white':'rgba(255,255,255,0.7)' }}>
              {t.label}
              {t.badge>0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead} onDelete={deleteNotification} onEnablePush={enablePush} onDisablePush={disablePush}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      {tab==='aprovacao' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>
                {subTab==='pendentes' ? 'Solicitações Aguardando Aprovação' : 'Histórico de Aprovações'}
              </h2>
              <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
                {subTab==='pendentes'
                  ? (myPending.length===0 ? 'Nenhuma solicitação pendente.' : `${myPending.length} solicitação(ões) aguardando sua avaliação`)
                  : `${historico.length} solicitação(ões) processada(s)`}
              </p>
            </div>
            <div style={{ display:'flex', gap:6, background:T.surfaceAlt, padding:3, borderRadius:T.r, border:`1px solid ${T.border}` }}>
              {[['pendentes','⏳ Pendentes'],['historico','📋 Histórico']].map(([id,label])=>(
                <button key={id} onClick={()=>setSubTab(id)}
                  style={{ padding:'5px 14px', borderRadius:T.rSm, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:600, fontSize:12, transition:'all .12s',
                    background: subTab===id ? T.laranja : 'transparent',
                    color:      subTab===id ? 'white'   : T.textSec }}>
                  {label}
                  {id==='pendentes'&&myPending.length>0&&<span style={{ marginLeft:5, background:'rgba(255,255,255,.3)', borderRadius:10, padding:'0 6px', fontSize:10, fontWeight:800 }}>{myPending.length}</span>}
                </button>
              ))}
            </div>
          </div>
          {subTab==='pendentes' && (<>
            {urgentesGer.length > 0 && (
              <div style={{ background:'#1A1612', borderRadius:T.r, padding:'12px 16px', marginBottom:14 }}>
                <div style={{ color:'#9E9590', fontSize:9, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                  🚨 Atenção agora — {urgentesGer.length} {urgentesGer.length===1?'item':'itens'} próximo{urgentesGer.length===1?'':'s'} do prazo
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {urgentesGer.map(r => {
                    const vence = new Date(r.desiredDate).getTime() + URGENCY_SLA_MS[r.urgency]
                    const diffM = Math.max(0, Math.round((vence - now) / 60000))
                    const borda = r.urgency==='critico' ? '#D32F2F' : '#E65100'
                    return (
                      <div key={r.id} onClick={()=>setReviewing(r)}
                        style={{ background:r.urgency==='critico'?'rgba(211,47,47,.15)':'rgba(230,81,0,.15)', border:`1px solid ${borda}`, borderRadius:T.rSm, padding:'8px 12px', cursor:'pointer', flex:'1 1 280px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                        <div>
                          <div style={{ color:'#fff', fontFamily:FONT, fontSize:12, fontWeight:700 }}>{URGENCY[r.urgency]?.icon} {r.requesterName||'—'}</div>
                          <div style={{ color:'#9E9590', fontFamily:FONT, fontSize:10 }}>{r.clientName||'—'} · {r.desiredDate||'—'}</div>
                        </div>
                        <span style={{ color:borda, fontFamily:FONT, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>vence em {diffM<60?`${diffM}min`:`${Math.round(diffM/60)}h`}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {myPending.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Tudo em dia!</p>
              </div>
            )}
            {myPending.map(r => <DesktopRequestCard key={r.id} req={r} profile={profile} onView={setReviewing}/>)}
          </>)}
          {subTab==='historico' && (<>
            {historico.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📋</div>
                <p style={{ fontWeight:700, fontSize:16 }}>Nenhum histórico ainda.</p>
              </div>
            )}
            {historico.map(r => <DesktopRequestCard key={r.id} req={r} profile={profile} onView={setReviewing}/>)}
          </>)}
        </div>
      )}

      {tab==='painel' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:0 }}>Painel Gerencial</h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>Troca Técnica · Garantia · Sinistro · Guindauto</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
            {[
              { l:'Total',             v:mgrReqs.length,   c:T.laranja, bg:T.laranjaLight },
              { l:'Aguard. Aprovação', v:myPending.length, c:'#B8860B',  bg:'#FFF8E1'     },
              { l:'No time de Frotas', v:totalAprovados,   c:T.verde,   bg:T.verdeLight  },
              { l:'Recusadas',         v:totalRecusados,   c:T.perigo,  bg:T.perigoLight },
            ].map(s=>(
              <div key={s.l} style={{ background:s.bg, border:BORDER_SUBTLE, borderRadius:16, padding:'14px 16px', boxShadow:SHADOW_CARD }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:800, fontSize:28, lineHeight:1, letterSpacing:'-.02em' }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:9.5, fontFamily:FONT, fontWeight:600, letterSpacing:'-.005em', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {[['todos','Todos'],['pendente_supervisor','Aguard. Supervisor'],['pendente_gerente','Aguard. Gerência'],['pendente','No time de Frotas'],['aceito','Aceito'],['recusado','Recusado']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ ...BS, background:filterStatus===v?T.laranja:T.surface, color:filterStatus===v?'white':T.textSec, border:`1px solid ${filterStatus===v?T.laranja:T.border}`, fontSize:10, padding:'4px 12px' }}>
                {l}
              </button>
            ))}
          </div>
          {filtered.map(r => <DesktopRequestCard key={r.id} req={r} profile={profile} onView={setReviewing}/>)}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}><div style={{ fontSize:36, marginBottom:8 }}>📭</div><p>Nenhuma solicitação neste filtro.</p></div>}
        </div>
      )}

      {tab==='config' && (
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px', maxWidth:600 }}>
          <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
          <div style={{ background:T.surface, borderRadius:16, border:BORDER_SUBTLE, padding:20, boxShadow:SHADOW_CARD }}>
            <div style={{ marginBottom:14 }}>
              <label style={LS}>💬 Número WhatsApp (com DDI+DDD, ex: 5518999999999)</label>
              <input value={waPhone} onChange={e=>setWaPhone(e.target.value)} placeholder="5518999999999" style={{ ...IS, marginTop:6 }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={LS}>🔑 CallMeBot API Key</label>
              <input value={waApikey} onChange={e=>setWaApikey(e.target.value)} placeholder="Ex: 5517289" style={{ ...IS, marginTop:6 }}/>
              <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                Para ativar: salve +34 644 52 74 88 e envie <strong>I allow callmebot to send me messages</strong>
              </p>
            </div>
            <button onClick={handleSaveWhatsapp} style={{ ...BS, background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700 }}>
              {savedWa?'✅ Salvo!':'💾 Salvar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>Fluxo de Aprovação Gerencial</span>
      </div>
    </div>
  )
}
