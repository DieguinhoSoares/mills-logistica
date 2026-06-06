import { AuthProvider } from './contexts/AuthContext'
import { LoginScreen } from './views/LoginScreen'
import { FrotasView } from './views/FrotasView'
import { SolicitanteView } from './views/SolicitanteView'
import { useSimClients } from './hooks/useFirestore'
import { useAuth } from './contexts/AuthContext'

function AppInner() {
  const { user, profile } = useAuth()
  const { simClients } = useSimClients()

  if (!user || !profile) return <LoginScreen />
  if (profile.role === 'frotas') return <FrotasView />
  if (profile.role === 'solicitante') return <SolicitanteView simClients={simClients} />
  return <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}