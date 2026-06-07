import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, runDailyBackup } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, BS } from '../lib/constants'
import { detectConflicts, parseSIMCsv } from '../lib/utils'
import Papa from 'papaparse'

function CsvUploadModal({ onLoaded }) {
  const [status, setStatus] = useState('idle')
  const [count,  setCount]  = useState(0)

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
    <div style={{ background:'white', borderRadius:16, border:'1px solid #E2DDD6', padding:24, maxWidth:500 }}>
      <div style={{ padding:20, background:'#FAF8F5', borderRadius:10, border:'2px dashed #CEC8C0', textAlign:'center', marginBottom:12 }}>
        <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
        <p style={{ color:'#6B6258', fontFamily:FONT, fontSize:13, margin:'0 0 12px' }}>CSV exportado do SIM · separador ; · UTF-8</p>
        <label style={{ ...BS, background:'#F37021', color:'white', cursor:'pointer' }}>
          Escolher arquivo
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
        </label>
      </div>
      {status==='loading' && <div style={{ color:'#6B6258', fontFamily:FONT, fontSize:13, textAlign:'center' }}>⏳ Processando...</div>}
      {status==='done'    && <div style={{ padding:'10px 14px', background:'#E0EEEE', borderRadius:10, color:'#004042', fontFamily:FONT, fontWeight:700 }}>✅ {count} registros carregados!</div>}
      {status==='error'   && <div style={{ padding:'10px 14px', background:'#FFEBEE', borderRadius:10, color:'#D32F2F', fontFamily:FONT, fontWeight:700 }}>❌ Erro. Verifique o arquivo.</div>}
    </div>
  )
}

export function MasterView({ simClients }) {
  const { profile, logout }                           = useAuth()
  const { cards }                                     = useCards()
  const { requests }                                  = useRequests('frotas')
  const { simClients: simClientsHook, uploadClients } = useSimClients()
  const { notifications, unreadCount, markAllRead }   = useNotifications()
  const { toasts, add:addToast, dismiss }             = useToasts()
  const [tab, setTab]                                 = useState('kpis')

  const simClientsList = simClientsHook.length > 0 ? simClientsHook : (simClients || [])
  const pending = requests.filter(r => r.status === 'pendente').length

  const TABS = [
    { id:'kpis',     label:'📊 Indicadores', badge:null },
    { id:'map',      label:'🗺 Mapa',          badge:null },
    { id:'requests', label:'📥 Solicitações', badge:pending||null },
    { id:'sim',      label:'⬆ Base SIM',      badge:null },
  ]

  return (
    <div style={{ background:'#F9F6F1', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      <div style={{ background:'#004042', padding:'0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.2)' }}/>
          <div>
            <div style={{ color:'white', fontFamily:FONT, fontWeight:900, fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' }}>⭐ MASTER</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>Painel Executivo · {profile?.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#6BFAC7' }}/>
            <span style={{ color:'#6BFAC7', fontSize:9, fontWeight:800 }}>LIVE</span>
          </div>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'5px 12px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:800, fontSize:11, position:'relative',
                background: tab===t.id ? '#F37021' : 'rgba(255,255,255,0.12)',
                color: tab===t.id ? 'white' : 'rgba(255,255,255,0.7)',
              }}>
              {t.label}
              {t.badge && <span style={{ position:'absolute', top:-4, right:-4, background:'#D32F2F', color:'white', borderRadius:20, fontSize:9, fontWeight:800, padding:'0 5px' }}>{t.badge}</span>}
            </button>
          ))}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}/>
          <button onClick={logout} style={{ ...BS, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.2)', fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='kpis' && <KPIView cards={cards} requests={requests}/>}

        {tab==='map' && (
          <div style={{ flex:1, padding:'16px 12px', overflow:'hidden' }}>
            <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:'#1A1612', margin:'0 0 12px' }}>Mapa de Operações</h3>
            <div style={{ height:'calc(100% - 44px)' }}>
              <BrazilMap cards={cards}/>
            </div>
          </div>
        )}

        {tab==='sim' && (
          <div style={{ flex:1, padding:'24px', overflowY:'auto' }}>
            <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:'#1A1612', margin:'0 0 6px' }}>⬆ Base SIM — Clientes e Frotas</h3>
            <p style={{ color:'#9E9590', fontFamily:FONT, fontSize:12, marginBottom:20 }}>Faça upload do CSV exportado do SIM para popular a base de clientes e frotas.</p>
            <CsvUploadModal onLoaded={async clients => { await uploadClients(clients); addToast(`${clients.length} registros carregados!`, 'success') }}/>
          </div>
        )}

        {tab==='requests' && (
          <div style={{ flex:1, overflow:'auto', padding:'16px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontFamily:FONT, fontWeight:900, fontSize:16, color:'#1A1612', margin:0 }}>
                Todas as Solicitações <span style={{ color:'#9E9590', fontWeight:600, fontSize:13 }}>({requests.length})</span>
              </h3>
              {pending > 0 && <span style={{ background:'#FFEBEE', color:'#D32F2F', borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:800, fontFamily:FONT }}>{pending} pendentes</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {requests.map(r => {
                const ct = CARD_TYPES[r.type]
                const sc = { pendente:{color:'#F5C400',bg:'#FFF8E1'}, aceito:{color:'#004042',bg:'#E0EEEE'}, recusado:{color:'#D32F2F',bg:'#FFEBEE'} }[r.status] || {}
                return (
                  <motion.div key={r.id} layout
                    style={{ background:'white', border:`1px solid ${sc.color||'#E2DDD6'}30`, borderRadius:16, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:'#1A1612' }}>{r.requesterName||'—'}</span>
                        <span style={{ color:'#9E9590', fontSize:11, fontFamily:FONT }}> · {r.unit}</span>
                      </div>
                      <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:800, fontFamily:FONT }}>{r.status}</span>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:10 }}>
                      <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'2px 8px', fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                      <span style={{ color:'#9E9590', fontFamily:FONT }}>🔧 {r.machine||'—'}</span>
                      <span style={{ color:'#9E9590', fontFamily:FONT }}>📅 {r.desiredDate}</span>
                      <span style={{ color:'#9E9590', fontFamily:FONT }}>{r.originCityName||r.origin||'—'} → {r.destCityName||r.destination||'—'}</span>
                    </div>
                  </motion.div>
                )
              })}
              {requests.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#9E9590', fontFamily:FONT }}>Nenhuma solicitação.</div>}
            </div>
          </div>
        )}
      </div>

      <div style={{ background:'white', borderTop:'1px solid #E2DDD6', padding:'5px 12px', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ color:'#9E9590', fontSize:9, fontFamily:FONT }}>Mills Pesados Locação, Serviços e Logística S.A.</span>
        <span style={{ color:'#2E7D32', fontSize:9, fontFamily:FONT, fontWeight:700 }}>🔒 Backup automático diário ativado</span>
      </div>
    </div>
  )
}
