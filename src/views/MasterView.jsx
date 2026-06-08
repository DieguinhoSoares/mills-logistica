import { usePendingUsers } from '../hooks/useFirestore'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, runDailyBackup } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, BS } from '../lib/constants'
import { detectConflicts } from '../lib/utils'

export function MasterView({ simClients }) {
  const { profile, logout }                = useAuth()
  const { cards }                          = useCards()
  const { requests, respondRequest }       = useRequests('frotas')
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { config }                         = useConfig()
  const { toasts, add:addToast, dismiss }  = useToasts()
  const [tab, setTab]                      = useState('kpis')

  useState(() => {
    if (cards.length > 0 || requests.length > 0) {
      runDailyBackup(cards, requests).catch(console.warn)
    }
  })

  const conflicts = detectConflicts(cards)
  const pending   = requests.filter(r=>r.status==='pendente').length

  const TABS = [
    { id:'kpis',    label:'📊 Indicadores', badge:null },
    { id:'map',     label:'🗺 Mapa',         badge:null },
    { id:'requests',label:'📥 Solicitações', badge:pending||null },
  ]

  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

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
                background: tab===t.id ? T.laranja : 'rgba(255,255,255,0.12)',
                color: tab===t.id ? 'white' : 'rgba(255,255,255,0.7)',
              }}>
              {t.label}
              {t.badge && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>}
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
            <div style={{ height:'calc(100% - 44px)' }}>
              <BrazilMap cards={cards}/>
            </div>
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
                const ct=CARD_TYPES[r.type], sc={pendente:{color:T.amarelo,bg:T.amareloLight},aceito:{color:T.verde,bg:T.verdeLight},recusado:{color:T.perigo,bg:T.perigoLight}}[r.status]||{}
                return (
                  <motion.div key={r.id} layout
                    style={{ background:T.surface, border:`1px solid ${sc.color||T.border}30`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{r.requesterName||'—'}</span>
                        <span style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}> · {r.unit}</span>
                      </div>
                      <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>{r.status}</span>
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
      </div>

      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>Mills Pesados · Gestão de Frotas</span>
        <span style={{ color:T.sucesso, fontSize:9, fontFamily:FONT, fontWeight:700 }}>🔒 Backup automático diário ativado</span>
      </div>
    </div>
  )
}
