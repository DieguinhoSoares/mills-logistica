import { useAuth }                              from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients } from '../hooks/useFirestore'
import { KPIView }                              from './KPIView'
import { MillsLogo, NotificationBell }          from '../components/UI'
import { T, FONT, BS }                          from '../lib/constants'

export function IndicadoresView() {
  const { profile, logout }          = useAuth()
  const { cards }                    = useCards()
  const { requests }                 = useRequests()
  const { simClients }               = useSimClients()
  const { notifications, markAllRead, markRead, deleteNotification, enablePush, disablePush } = useNotifications()
  const unread = notifications.filter(n => !n.read).length

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ background:T.verde, padding:'0 24px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.18)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <MillsLogo size={28}/>
          <div>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:'#FFFFFF', lineHeight:1 }}>
              {profile?.name || 'Gerência'}
            </div>
            <div style={{ fontFamily:FONT, fontSize:10, color:'rgba(255,255,255,.6)', marginTop:1 }}>
              PAINEL DE INDICADORES
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell
            notifications={notifications}
            unreadCount={unread}
            onMarkAllRead={markAllRead}
            onMarkRead={markRead}
            onDelete={deleteNotification}
            onEnablePush={enablePush}
            onDisablePush={disablePush}
          />
          <button onClick={logout}
            style={{ ...BS, background:'rgba(255,255,255,.15)', color:'#FFFFFF', fontSize:11, padding:'6px 14px', border:'1px solid rgba(255,255,255,.2)' }}>
            Sair
          </button>
        </div>
      </div>

      {/* KPIView ocupa o restante */}
      <div style={{ flex:1, overflow:'hidden' }}>
        <KPIView cards={cards} requests={requests} simClients={simClients}/>
      </div>

    </div>
  )
}
