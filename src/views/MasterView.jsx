import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, BS, IS, LS } from '../lib/constants'
import { detectConflicts, fmt, getSubtypeLabel } from '../lib/utils'
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCards, useRequests, useNotifications, useConfig, usePendingUsers, useManagerialRequests, runDailyBackup, useMessages } from '../hooks/useFirestore'

const PERFIS = [
  ['frotas',      '🚛 Gestão de Frotas'],
  ['solicitante', '📋 Solicitante'],
  ['supervisor',  '👷 Supervisor de Programação'],
  ['gerente',     '👔 Gerente de Manutenção'],
]

function MessageThread({ requestId, profile, onClose }) {
  const { messages, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await sendMessage({ requestId, text:text.trim(), authorId:profile?.uid||'', authorName:profile?.name||'Master', authorRole:'master', type:'message' })
    setText(''); setSending(false)
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
            const isMe = m.authorRole==='master'||m.authorRole==='frotas'
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

function CancelCardModal({ card, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:440, boxShadow:T.shadowLg, border:`2px solid ${T.perigo}` }}>
        <h3 style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:18, margin:'0 0 6px' }}>🚫 Cancelar Serviço</h3>
        <p style={{ color:T.textSec, fontFamily:FONT, fontSize:12, margin:'0 0 16px' }}>
          Cancelar <strong style={{ color:T.laranja }}>{card?.client}</strong> — {fmt(card?.startDate)}.
        </p>
        <div style={{ marginBottom:16 }}>
          <label style={LS}>Motivo <span style={{ color:T.perigo }}>*</span></label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Descreva o motivo..."
            style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:80, resize:'vertical', marginTop:5 }}/>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Voltar</button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}
            style={{ ...BS, background:reason.trim()?T.perigo:'#CCC', color:'white', fontWeight:700 }}>Confirmar</button>
        </div>
      </motion.div>
    </div>
  )
}

export function MasterView({ simClients }) {
  const { profile, logout }                         = useAuth()
  const { cards }                                   = useCards()
  const { requests, respondRequest,
          approveAsSupervisor, refuseAsSupervisor,
          approveAsGerente,    refuseAsGerente }     = useRequests('master')
  const { requests: mgrReqs }                       = useManagerialRequests()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { config, saveConfig }                      = useConfig()
  const { toasts, add:addToast, dismiss }           = useToasts()
  const { pendingUsers, approveUser, refuseUser }   = usePendingUsers()

  const [tab,           setTab]           = useState('kpis')
  const [cancelModal,   setCancelModal]   = useState(null)
  const [approvingRole, setApprovingRole] = useState({})
  const [approvalModal, setApprovalModal] = useState(null)
  const [messaging, setMessaging] = useState(null)
  const [filterAprov,   setFilterAprov]   = useState('todos')
  const [waPhone,  setWaPhone]  = useState('')
  const [waApikey, setWaApikey] = useState('')
  const [savedWa,  setSavedWa]  = useState(false)

  useState(() => {
    if (cards.length > 0 || requests.length > 0) runDailyBackup(cards, requests).catch(console.warn)
  })

  const pending      = requests.filter(r => r.status==='pendente').length
  const pendingAprov = mgrReqs.filter(r => ['pendente_supervisor','pendente_gerente'].includes(r.status)).length
  const acceptedCards = cards.filter(c => c.status==='confirmado' || c.status==='aceito')

  const TABS = [
  { id:'kpis',      label:'📊 Indicadores',  badge: null },
  { id:'config', label:'⚙️ Config', badge: null },
  { id:'map',       label:'🗺 Mapa',          badge: null },
  { id:'requests',  label:'📥 Solicitações',  badge: pending || null },
  { id:'aprovacao', label:'📋 Aprovações',    badge: pendingAprov || null },
  { id:'usuarios',  label:'👥 Usuários',      badge: pendingUsers.length || null },
]

  const handleCancelCard = async (card, reason) => {
    await updateDoc(doc(db,'cards',card.id), { status:'cancelado', cancelReason:reason, cancelledAt:serverTimestamp(), cancelledBy:profile?.name||'Master', updatedAt:serverTimestamp() })
    if (card.requestId) {
      const req = requests.find(r => r.id===card.requestId)
      if (req?.requesterId) await addDoc(collection(db,'notifications'), { userId:req.requesterId, requestId:card.requestId, type:'service_cancelled', title:'🚫 Serviço cancelado', message:`O serviço de ${card.client} foi cancelado. Motivo: ${reason}`, read:false, createdAt:serverTimestamp() })
    }
    setCancelModal(null)
    addToast(`Serviço de ${card.client} cancelado.`, 'info')
  }

  const handleMasterApprove = async (req, note) => {
    if (req.status==='pendente_supervisor') await approveAsSupervisor(req.id, note, profile?.name, 'master')
    else await approveAsGerente(req.id, note, profile?.name, 'master')
    setApprovalModal(null)
    addToast('Solicitação aprovada!', 'success')
  }

  const handleMasterRefuse = async (req, note) => {
    if (req.status==='pendente_supervisor') await refuseAsSupervisor(req.id, note, profile?.name)
    else await refuseAsGerente(req.id, note, profile?.name)
    setApprovalModal(null)
    addToast('Solicitação recusada.', 'info')
  }

  const handleApproveUser = async (userId) => {
    const role = approvingRole[userId]
    if (!role) return
    await approveUser(userId, role)
    setApprovingRole(p => { const n={...p}; delete n[userId]; return n })
    addToast('Usuário aprovado!', 'success')
  }

  const handleSaveWhatsapp = async () => {
    await saveConfig({ whatsappPhone: waPhone, whatsappApikey: waApikey })
    setSavedWa(true); setTimeout(()=>setSavedWa(false), 2000)
    addToast('WhatsApp configurado!', 'success')
  }
 
  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      {cancelModal && <CancelCardModal card={cancelModal} onConfirm={r=>handleCancelCard(cancelModal,r)} onClose={()=>setCancelModal(null)}/>}

      {approvalModal && (
        <ApprovalModal req={approvalModal} profile={profile} onApprove={handleMasterApprove} onRefuse={handleMasterRefuse} onClose={()=>setApprovalModal(null)}/>
      )}
      {messaging && <MessageThread requestId={messaging} profile={profile} onClose={()=>setMessaging(null)}/>}

      <div style={{ background:T.verde, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0, boxShadow:T.shadowMd }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.2)' }}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>⭐ MASTER</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>Painel Executivo · {profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.verdeMint }}/>
            <span style={{ color:T.verdeMint, fontSize:9, fontWeight:700, letterSpacing:'0.06em' }}>LIVE</span>
          </div>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'5px 14px', borderRadius:T.r, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:11, transition:'all .15s', position:'relative',
                background:tab===t.id?T.laranja:'rgba(255,255,255,0.12)', color:tab===t.id?'white':'rgba(255,255,255,0.7)' }}>
              {t.label}
              {t.badge > 0 && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='kpis' && <KPIView cards={cards} requests={requests}/>}

        {tab==='map' && (
          <div style={{ flex:1, padding:'16px 20px', overflow:'hidden' }}>
            <h3 style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:T.text, margin:'0 0 12px' }}>Mapa de Operações</h3>
            <div style={{ height:'calc(100% - 44px)' }}><BrazilMap cards={cards}/></div>
          </div>
        )}

        {tab==='requests' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:T.text, margin:0 }}>
                Todas as Solicitações <span style={{ color:T.textMuted, fontWeight:600, fontSize:13 }}>({requests.length})</span>
              </h3>
              {pending>0 && <span style={{ background:T.perigoLight, color:T.perigo, borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{pending} pendentes</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {requests.map(r => {
                const ct = CARD_TYPES[r.type]
                const sc = { pendente_supervisor:{color:'#B8860B',bg:'#FFF8E1'}, pendente_gerente:{color:T.info,bg:T.infoLight}, pendente:{color:T.amarelo,bg:T.amareloLight}, aceito:{color:T.verde,bg:T.verdeLight}, recusado:{color:T.perigo,bg:T.perigoLight} }[r.status] || {}
                return (
                  <motion.div key={r.id} layout style={{ background:T.surface, border:`1px solid ${sc.color||T.border}30`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{r.requesterName||'—'}</span>
                        <span style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}> · {r.unit}</span>
                      </div>
                      <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>{r.status?.replace(/_/g,' ')}</span>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:10 }}>
                      <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'2px 8px', fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                      <span style={{ color:T.textMuted, fontFamily:FONT }}>🔧 {r.machine||'—'}</span>
                      <span style={{ color:T.textMuted, fontFamily:FONT }}>📅 {r.desiredDate}</span>
                      <span style={{ color:T.textMuted, fontFamily:FONT }}>{r.originCityName||r.origin||'—'} → {r.destCityName||r.destination||'—'}</span>
                    </div>
                  </motion.div>
                )
              })}
              {requests.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>Nenhuma solicitação.</div>}
            </div>
          </div>
        )}

        {tab==='aprovacao' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
            <div style={{ marginBottom:14 }}>
              <h3 style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:T.text, margin:0 }}>
                Aprovações Gerenciais
                {pendingAprov>0 && <span style={{ marginLeft:10, background:T.perigo, color:'white', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{pendingAprov} pendentes</span>}
              </h3>
              <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, margin:'3px 0 0' }}>Troca Técnica · Garantia · Sinistro · Guindauto</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
              {[
                { l:'Total',             v:mgrReqs.length,                                                              c:T.laranja, bg:T.laranjaLight },
                { l:'Aguard. Aprovação', v:pendingAprov,                                                                c:'#B8860B',  bg:'#FFF8E1'     },
                { l:'No time de Frotas', v:mgrReqs.filter(r=>['pendente','aceito'].includes(r.status)).length,          c:T.verde,   bg:T.verdeLight  },
                { l:'Recusadas',         v:mgrReqs.filter(r=>r.status==='recusado').length,                             c:T.perigo,  bg:T.perigoLight },
              ].map(s=>(
                <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}30`, borderRadius:T.rLg, padding:'12px 14px', boxShadow:T.shadow }}>
                  <div style={{ color:s.c, fontFamily:FONT, fontWeight:900, fontSize:24, lineHeight:1 }}>{s.v}</div>
                  <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:3 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              {[['todos','Todos'],['pendente_supervisor','Aguard. Supervisor'],['pendente_gerente','Aguard. Gerência'],['pendente','No time de Frotas'],['aceito','Aceito'],['recusado','Recusado']].map(([v,l])=>(
                <button key={v} onClick={()=>setFilterAprov(v)}
                  style={{ ...BS, background:filterAprov===v?T.laranja:T.surface, color:filterAprov===v?'white':T.textSec, border:`1px solid ${filterAprov===v?T.laranja:T.border}`, fontSize:10, padding:'4px 12px' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(filterAprov==='todos'?mgrReqs:mgrReqs.filter(r=>r.status===filterAprov)).map(r => {
                const ct = CARD_TYPES[r.type]
                const sc = { pendente_supervisor:{label:'⏳ Aguard. Supervisor',color:'#B8860B',bg:'#FFF8E1'}, pendente_gerente:{label:'📋 Aguard. Gerência',color:T.info,bg:T.infoLight}, pendente:{label:'🚛 No time de Frotas',color:T.verde,bg:T.verdeLight}, aceito:{label:'✅ Aceito',color:T.sucesso,bg:T.sucessoLight}, recusado:{label:'❌ Recusado',color:T.perigo,bg:T.perigoLight} }[r.status] || {}
                const canApprove = ['pendente_supervisor','pendente_gerente'].includes(r.status)
                return (
                  <motion.div key={r.id} layout style={{ background:T.surface, border:`1.5px solid ${sc.color||T.border}25`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                        {r.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(r.type,r.subtype)}</span>}
                      </div>
                      <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:10, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                      {[['Solicitante',r.requesterName||'—'],['Unidade',r.unit||'—'],['Equipamento',r.machine||'—'],['Rota',`${r.originCityName||r.origin||'—'} → ${r.destCityName||r.destination||'—'}`],['Data',fmt(r.desiredDate)],['Planta/Obra',r.clientName||'—']].map(([l,v])=>(
                        <div key={l}>
                          <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                          <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {r.approvalLog?.length>0 && (
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                        {r.approvalLog.map((log,i)=>(
                          <span key={i} style={{ background:log.action==='approved'?T.verdeLight:T.perigoLight, color:log.action==='approved'?T.verde:T.perigo, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>
                            {log.action==='approved'?'✅':'❌'} {log.step}: {log.approver?.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}
                 <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
  <button onClick={()=>setMessaging(r.id)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:11, fontWeight:700, padding:'5px 14px' }}>
    💬 Histórico
  </button>
  {canApprove && (
    <button onClick={()=>setApprovalModal(r)} style={{ ...BS, background:T.laranja, color:'white', fontSize:11, fontWeight:700, padding:'5px 14px' }}>
      ⭐ Aprovar/Recusar como Master
    </button>
  )}
</div>
                  </motion.div>
                )
              })}
              {mgrReqs.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}><div style={{ fontSize:36, marginBottom:8 }}>📭</div><p>Nenhuma solicitação gerencial ainda.</p></div>}
            </div>
          </div>
        )}
{tab==='config' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px', maxWidth:600 }}>
            <h2 style={{ fontFamily:FONT, fontWeight:700, fontSize:20, color:T.text, margin:'0 0 16px' }}>⚙️ Configurações</h2>
            <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:20, boxShadow:T.shadow }}>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>💬 Número WhatsApp (com DDI+DDD, ex: 5518999999999)</label>
                <input value={waPhone} onChange={e=>setWaPhone(e.target.value)}
                  placeholder="5518999999999" style={{ ...IS, marginTop:6 }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={LS}>🔑 CallMeBot API Key</label>
                <input value={waApikey} onChange={e=>setWaApikey(e.target.value)}
                  placeholder="Ex: 5517289" style={{ ...IS, marginTop:6 }}/>
                <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                  Para ativar: salve o número +34 644 52 74 88 na agenda e envie a mensagem<br/>
                  <strong>I allow callmebot to send me messages</strong><br/>
                  A API key chegará em resposta no WhatsApp.
                </p>
              </div>
              <button onClick={handleSaveWhatsapp}
                style={{ ...BS, background:savedWa?T.verde:T.laranja, color:'white', fontWeight:700 }}>
                {savedWa?'✅ Salvo!':'💾 Salvar'}
              </button>
            </div>
          </div>
        )}
        {tab==='usuarios' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:T.text, margin:0 }}>
                Aprovação de Cadastros
                {pendingUsers.length > 0 && <span style={{ marginLeft:10, background:T.perigo, color:'white', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, fontFamily:FONT }}>{pendingUsers.length} pendente{pendingUsers.length>1?'s':''}</span>}
              </h3>
            </div>
            {pendingUsers.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}><div style={{ fontSize:40, marginBottom:10 }}>✅</div><p>Nenhum cadastro pendente.</p></div>}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {pendingUsers.map(u => (
                <motion.div key={u.id} layout style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rLg, padding:'16px 18px', boxShadow:T.shadow }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:T.text }}>{u.name}</div>
                      <div style={{ fontFamily:FONT, fontSize:11, color:T.textMuted }}>{u.email} · {u.unit}</div>
                      <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, marginTop:2 }}>
                        Perfil: <strong style={{ color:T.laranja }}>{u.role}</strong> · Cadastrado em: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </div>
                    <span style={{ background:T.amareloLight, color:T.amarelo, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>⏳ Pendente</span>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={LS}>Definir perfil de acesso</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                      {PERFIS.map(([v,l]) => (
                        <div key={v} onClick={() => setApprovingRole(p=>({...p,[u.id]:v}))}
                          style={{ border:`2px solid ${approvingRole[u.id]===v?T.laranja:T.border}`, borderRadius:T.r, padding:'8px 12px', cursor:'pointer', textAlign:'center', background:approvingRole[u.id]===v?T.laranjaLight:T.surfaceAlt, transition:'all .12s' }}>
                          <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:approvingRole[u.id]===v?800:500 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button onClick={() => { refuseUser(u.id); addToast('Cadastro recusado.','info') }}
                      style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40`, fontSize:11, fontWeight:700 }}>❌ Recusar</button>
                    <button onClick={() => handleApproveUser(u.id)} disabled={!approvingRole[u.id]}
                      style={{ ...BS, background:approvingRole[u.id]?T.verde:T.borderMid, color:'white', fontSize:11, fontWeight:700, opacity:approvingRole[u.id]?1:0.5 }}>✅ Aprovar acesso</button>
                  </div>
                </motion.div>
              ))}
            </div>
            {acceptedCards.length > 0 && (
              <div style={{ marginTop:28 }}>
                <h3 style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:T.text, margin:'0 0 12px' }}>🚫 Cancelar Serviço Aceito <span style={{ color:T.textMuted, fontWeight:500, fontSize:12 }}>exclusivo Master</span></h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {acceptedCards.map(c => {
                    const ct = CARD_TYPES[c.type]
                    return (
                      <div key={c.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rLg, padding:'12px 16px', boxShadow:T.shadow, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                            <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'2px 8px', fontSize:9, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{c.client||'—'}</span>
                          </div>
                          <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>📅 {fmt(c.startDate)} · 👤 {c.driver||'—'} · {c.originCity||c.origin||'—'} → {c.destCity||c.destination||'—'}</div>
                        </div>
                        <button onClick={() => setCancelModal(c)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}40`, fontSize:11, fontWeight:700, flexShrink:0 }}>🚫 Cancelar</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>Mills Pesados, Locação Serviços e Logística S.A.</span>
        <span style={{ color:T.sucesso, fontSize:9, fontFamily:FONT, fontWeight:700 }}>🔒 Backup automático diário ativado</span>
      </div>
    </div>
  )
}

function ApprovalModal({ req, profile, onApprove, onRefuse, onClose }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ct = CARD_TYPES[req.type]
  const stepLabel = req.status==='pendente_supervisor' ? 'Supervisor' : 'Gerente'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2100, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:500, maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>📋 Aprovação Master</h2>
            <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:3 }}>Substituindo alçada: <strong style={{ color:T.laranja }}>{stepLabel}</strong></div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'3px 10px', color:ct?.color, fontSize:10, fontWeight:700, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
            {req.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'3px 10px', color:T.info, fontSize:10, fontWeight:700, fontFamily:FONT }}>{getSubtypeLabel(req.type,req.subtype)}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['Solicitante',req.requesterName||'—'],['Unidade',req.unit||'—'],['Equipamento',req.machine||'—'],['Data',fmt(req.desiredDate)]].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:600, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={LS}>Observação <span style={{ color:T.textMuted, fontWeight:400, fontSize:10 }}>(obrigatório para recusa)</span></label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Observação..."
            style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:12, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:70, resize:'vertical', marginTop:5 }}/>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={async()=>{ setSaving(true); await onRefuse(req, note); setSaving(false) }} disabled={saving||!note.trim()}
            style={{ ...BS, background:note.trim()?T.perigoLight:T.borderMid, color:note.trim()?T.perigo:T.textMuted, border:`1px solid ${note.trim()?T.perigo+'40':T.border}`, fontWeight:700, opacity:note.trim()?1:0.5 }}>
            ❌ Recusar
          </button>
          <button onClick={async()=>{ setSaving(true); await onApprove(req, note); setSaving(false) }} disabled={saving}
            style={{ ...BS, background:T.verde, color:'white', fontWeight:700 }}>
            {saving?'⏳...':'✅ Aprovar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
