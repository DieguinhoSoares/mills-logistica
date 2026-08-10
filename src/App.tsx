import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginScreen }     from './views/LoginScreen'
import { FrotasView }      from './views/FrotasView'
import { MasterView }      from './views/MasterView'
import { GerenteView }     from './views/GerenteView'
import { SolicitanteView } from './views/SolicitanteView'
import { MotoristaView }     from './views/MotoristaView'
import { IndicadoresView }   from './views/IndicadoresView'
import { useSimClients, usePushInvite } from './hooks/useFirestore'
import { PushInviteBanner } from './components/UI'

function AppInner() {
  const { user, profile, logout } = useAuth()
  const { simClients, simClientsError } = useSimClients()
  const pushInvite = usePushInvite()

  if (!user || !profile) return <LoginScreen />

  if (profile.status === 'pendente') return (
    <div style={{ minHeight:'100vh', background:'#F9F6F1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'IBM Plex Sans','Nunito',sans-serif" }}>
      <div style={{ background:'#FFFFFF', borderRadius:16, border:'1px solid #E2DDD6', padding:'40px 48px', maxWidth:420, textAlign:'center', boxShadow:'0 4px 16px rgba(26,22,18,.11)' }}>
        <div style={{ fontSize:44, marginBottom:16 }}>⏳</div>
        <div style={{ fontWeight:800, fontSize:18, color:'#1A1612', marginBottom:8 }}>Cadastro em análise</div>
        <div style={{ fontSize:13, color:'#4A3F35', lineHeight:1.6, marginBottom:24 }}>
          Seu cadastro foi recebido e está aguardando aprovação do administrador.<br/>
          Você receberá uma notificação assim que o acesso for liberado.
        </div>
        <button onClick={logout} style={{ background:'#F37021', color:'white', border:'none', borderRadius:10, padding:'10px 28px', fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:13, cursor:'pointer' }}>
          Sair
        </button>
      </div>
    </div>
  )

  if (profile.status === 'bloqueado') return (
    <div style={{ minHeight:'100vh', background:'#F9F6F1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'IBM Plex Sans','Nunito',sans-serif" }}>
      <div style={{ background:'#FFFFFF', borderRadius:16, border:'1px solid #FFEBEE', padding:'40px 48px', maxWidth:420, textAlign:'center', boxShadow:'0 4px 16px rgba(26,22,18,.11)' }}>
        <div style={{ fontSize:44, marginBottom:16 }}>🚫</div>
        <div style={{ fontWeight:800, fontSize:18, color:'#D32F2F', marginBottom:8 }}>Acesso bloqueado</div>
        <div style={{ fontSize:13, color:'#4A3F35', lineHeight:1.6, marginBottom:24 }}>
          Seu acesso foi suspenso pelo administrador.<br/>
          Entre em contato com a equipe de Gestão de Frotas para mais informações.
        </div>
        <button onClick={logout} style={{ background:'#D32F2F', color:'white', border:'none', borderRadius:10, padding:'10px 28px', fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:13, cursor:'pointer' }}>
          Sair
        </button>
      </div>
    </div>
  )

  const view =
    profile.role === 'master'      ? <MasterView      simClients={simClients} /> :
    profile.role === 'frotas'      ? <FrotasView      simClients={simClients} /> :
    profile.role === 'supervisor'  ? <GerenteView     simClients={simClients} /> :
    profile.role === 'gerente'     ? <GerenteView     simClients={simClients} /> :
    profile.role === 'indicadores' ? <IndicadoresView /> :
    profile.role === 'solicitante' ? <SolicitanteView simClients={simClients} simClientsError={simClientsError} /> :
    <LoginScreen />

  // Overlay fixo no topo (não empurra o layout): as views já usam height:100vh
  // internamente, então "empurrar" com flex bagunçaria o rodapé delas. O
  // banner flutua por cima temporariamente, some sozinho ao ativar/dispensar.
  return (
    <>
      {pushInvite.mostrar && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9999 }}>
          <PushInviteBanner mostrar={pushInvite.mostrar} onAtivar={pushInvite.ativar} onDispensar={pushInvite.dispensar} />
        </div>
      )}
      {view}
    </>
  )
}

export default function App() {
  // Link de motorista — acesso sem login via token na URL. Checado ANTES de
  // montar o AuthProvider/AppInner: sem isso, todo acesso do motorista no
  // campo (i) disparava o listener de autenticação do Firebase à toa e
  // (ii) baixava a base inteira de ~3.375 ativos da Mills via useSimClients
  // (sequencial, ~68 documentos) — tudo pra uma tela que não usa nada disso.
  const params         = new URLSearchParams(window.location.search)
  const motoristaToken = params.get('motorista')
  if (motoristaToken) return <MotoristaView token={motoristaToken} />

  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
