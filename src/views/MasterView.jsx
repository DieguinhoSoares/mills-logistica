import React from 'react'
import { motion } from 'framer-motion'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, runDailyBackup } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell, ServiceCard, MoveModal, ClientInput, FrotaInput, MunicipioInput } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, buildReport, downloadTxt, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import Papa from 'papaparse'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, runDailyBackup } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, BR_STATES, FILIAIS, MONTH_NAMES, WD_SHORT, BS, IS, LS, NB } from '../lib/constants'
import { fmt, todayStr, getWeekDays, getMonthWeeks, cardsForDay, detectConflicts, buildReport, downloadTxt, parseSIMCsv, getSubtypeLabel } from '../lib/utils'
import Papa from 'papaparse'

// Master tem acesso a tudo: KPIs, todas as solicitações, todos os cards, backup
function CsvUploadModal({ onLoaded }) {
  const [status, setStatus] = React.useState('idle')
  const [count, setCount]   = React.useState(0)
  const inputRef = React.useRef()
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const clients = parseSIMCsv(ev.target.result, Papa)
        setCount(clients.length); setStatus('done'); onLoaded(clients)
      } catch(err) { setStatus('error') }
    }
    reader.readAsText(file, 'utf-8')
  }
  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:24, maxWidth:500 }}>
      <div style={{ padding:20, background:T.surfaceAlt, borderRadius:T.r, border:`2px dashed ${T.borderMid}`, textAlign:'center', marginBottom:12 }}>
        <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
        <p style={{ color:T.textSec, fontFamily:FONT, fontSize:13, margin:'0 0 12px' }}>CSV exportado do SIM · separador ; · UTF-8</p>
        <button onClick={()=>inputRef.current?.click()} style={{ ...BS, background:T.laranja, color:'white' }}>Escolher arquivo</button>
        <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
      </div>
      {status==='loading' && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:13, textAlign:'center' }}>⏳ Processando...</div>}
      {status==='done'    && <div style={{ padding:'10px 14px', background:T.verdeLight, borderRadius:T.r, color:T.verde, fontFamily:FONT, fontWeight:700 }}>✅ {count} registros carregados!</div>}
      {status==='error'   && <div style={{ padding:'10px 14px', background:T.perigoLight, borderRadius:T.r, color:T.perigo, fontFamily:FONT, fontWeight:700 }}>❌ Erro. Verifique o arquivo.</div>}
    </div>
  )
}
export function MasterView({ simClients }) {
  const { profile, logout }                           = useAuth()
  const { cards, saveCard, deleteCard, moveCard }     = useCards()
  const { requests, respondRequest }                  = useRequests('frotas')
  const { simClients: simClientsHook, uploadClients } = useSimClients()
  const { notifications, unreadCount, markAllRead }   = useNotifications()
  const { config, saveConfig }                        = useConfig()
  const { toasts, add:addToast, dismiss }             = useToasts()
  const [tab, setTab]                                 = useState('kpis')
  const simClientsList = simClientsHook.length > 0 ? simClientsHook : (simClients || [])
  const conflicts = detectConflicts(cards)
  const pending   = requests.filter(r=>r.status==='pendente').length

  useState(() => {
    if (cards.length > 0 || requests.length > 0) {
      runDailyBackup(cards, requests).catch(console.warn)
    }
  })

  const conflicts = detectConflicts(cards)
  const pending   = requests.filter(r=>r.status==='pendente').length

  const TABS = [
    { id:'kpis',     label:'📊 Indicadores',  badge:null },
    { id:'agenda',   label:'📅 Agenda',        badge:null },
    { id:'map',      label:'🗺 Mapa',           badge:null },
    { id:'requests', label:'📥 Solicitações',  badge:pending||null },
    { id:'sim',      label:'⬆ Base SIM',       badge:null },
  ]

  return (
    <div style={{ background:T.bg, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      {/* Header */}
      <div style={{ background:T.verde, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0, boxShadow:T.shadowMd }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.2)' }}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:900, fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>⭐ MASTER</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>Painel Executivo · {profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.verdeMint }}/>
            <span style={{ color:T.verdeMint, fontSize:9, fontWeight:800, letterSpacing:'0.06em' }}>LIVE</span>
          </div>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'5px 14px', borderRadius:T.r, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:800, fontSize:11, transition:'all .15s', position:'relative',
                background: tab===t.id ? T.laranja : 'rgba(255,255,255,0.12)',
                color: tab===t.id ? 'white' : 'rgba(255,255,255,0.7)',
              }}>
              {t.label}
              {t.badge && <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:800, padding:'0 5px', fontFamily:FONT }}>{t.badge}</span>}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='kpis' && <KPIView cards={cards} requests={requests}/>}

        {tab==='map' && (
          <div style={{ flex:1, padding:'16px 20px', overflow:'hidden' }}>
            <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:T.text, margin:'0 0 12px' }}>Mapa de Operações</h3>
            <div style={{ height:'calc(100% - 44px)' }}>
              <BrazilMap cards={cards}/>
            </div>
          </div>
        )}

        {tab==='agenda' && (
          <div style={{ flex:1, overflow:'hidden', padding:'8px 6px 4px', display:'flex', flexDirection:'column', minHeight:0 }}>
            <div style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:T.text, marginBottom:8 }}>Agenda Semanal</div>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, marginBottom:8 }}>Visualização completa disponível na versão Frotas. Em breve no Master.</p>
          </div>
        )}

        {tab==='sim' && (
          <div style={{ flex:1, padding:'16px 20px', overflowY:'auto' }}>
            <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:T.text, margin:'0 0 6px' }}>⬆ Base SIM — Clientes e Frotas</h3>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, marginBottom:16 }}>Faça upload do CSV exportado do SIM para popular a base de clientes e frotas.</p>
            <CsvUploadModal inline simClients={simClientsList} onLoaded={async clients => { await uploadClients(clients); addToast(`${clients.length} registros carregados!`, 'success') }}/>
          </div>
        )}

        {tab==='requests' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:T.text, margin:0 }}>
                Todas as Solicitações <span style={{ color:T.textMuted, fontWeight:600, fontSize:13 }}>({requests.length})</span>
              </h3>
              {pending>0 && <span style={{ background:T.perigoLight, color:T.perigo, borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:800, fontFamily:FONT }}>{pending} pendentes</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {requests.map(r => {
                const ct=CARD_TYPES[r.type], sc={pendente:{color:T.amarelo,bg:T.amareloLight},aceito:{color:T.verde,bg:T.verdeLight},recusado:{color:T.perigo,bg:T.perigoLight}}[r.status]||{}
                return (
                  <motion.div key={r.id} layout
                    style={{ background:T.surface, border:`1px solid ${sc.color||T.border}30`, borderRadius:T.rLg, padding:'14px 16px', boxShadow:T.shadow }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:T.text }}>{r.requesterName||'—'}</span>
                        <span style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}> · {r.unit}</span>
                      </div>
                      <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:800, fontFamily:FONT }}>{r.status}</span>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:10 }}>
                      <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'2px 8px', fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
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

      {/* Rodapé com info de backup */}
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:'5px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, letterSpacing:'0.06em' }}>mills infraestrutura · Gestão de Frotas</span>
        <span style={{ color:T.sucesso, fontSize:9, fontFamily:FONT, fontWeight:700 }}>🔒 Backup automático diário ativado</span>
      </div>
    </div>
  )
}
