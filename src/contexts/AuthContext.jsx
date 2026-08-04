import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../lib/firebase'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { resetarSenhaApi } from '../lib/vercelApi'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // profile era um getDoc (leitura única) — um Master bloqueando ou
    // trocando o perfil/role de alguém (toggleUserStatus/updateUserRole) não
    // tinha NENHUM efeito em sessões já abertas: App.tsx já trava a tela
    // certinho quando profile.status==='bloqueado', só que só checava esse
    // valor uma vez, no login. Trocado pra onSnapshot (mesmo padrão de
    // useCards/useRequests) — agora um bloqueio/mudança de role aplicado
    // pelo Master reflete na sessão aberta em tempo real, sem precisar
    // esperar o usuário deslogar sozinho.
    let unsubProfile = null
    const unsubAuth = onAuthStateChanged(auth, u => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      setUser(u)
      if (u) {
        unsubProfile = onSnapshot(doc(db, 'users', u.uid),
          snap => { setProfile(snap.exists() ? snap.data() : null); setLoading(false) },
          () => { setLoading(false) }
        )
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => { unsubAuth(); if (unsubProfile) unsubProfile() }
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  // Antes chamava sendPasswordResetEmail(auth, email) — o template genérico
  // do Firebase (sem logo/cores da Mills). Agora passa por um endpoint na
  // Vercel (free, sem plano pago — diferente do Cloud Functions do Firebase)
  // que gera o mesmo link seguro via Admin SDK e manda o e-mail com HTML da
  // marca Mills via SendGrid (ver api/reset-password.js no projeto Vercel).
  const resetPassword = (email) => resetarSenhaApi(email)

  const register = async (email, password, name, role, unit) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password)
    const profileData = {
      name,
      role,
      unit,
      email,
      status:    'pendente',
      createdAt: new Date().toISOString(),
    }
    await setDoc(doc(db, 'users', u.uid), profileData)
    setProfile(profileData)
    return u
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
