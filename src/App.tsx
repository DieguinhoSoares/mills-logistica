import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginScreen }           from './views/LoginScreen'
import { FrotasView }            from './views/FrotasView'
import { MasterView }            from './views/MasterView'
import { SolicitanteView }       from './views/SolicitanteView'
import { PendingScreen }         from './views/PendingScreen'
import { MotoristaView }         from './views/MotoristaView'
import { GerenteView }           from './views/GerenteView'
import { useSimClients }         from './hooks/useFirestore'

function AppInner() {
  const { user, profile } = useAuth()
  const { simClients }    = useSimClients()

  // Acesso por token de motorista — sem login
  const params     = new URLSearchParams(window.location.search)
  const motorToken = params.get('motorista')
  if (motorToken) return <MotoristaView token={motorToken} />

  if (!user || !profile)              return <LoginScreen />
  if (profile.role === 'master') return <GerenteView />
  if (profile.status === 'pendente')  return <PendingScreen />
  if (profile.status === 'recusado')  return <PendingScreen recusado />
  if (profile.role === 'master') return <MasterView simClients={simClients} />
  if (profile.role === 'master')      return <MasterView simClients={simClients} />
  if (profile.role === 'frotas')      return <FrotasView simClients={simClients} />
  if (profile.role === 'solicitante') return <SolicitanteView simClients={simClients} />
  if (profile.role === 'supervisor')  return <GerenteView />
  if (profile.role === 'gerente')     return <GerenteView />
  return <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
