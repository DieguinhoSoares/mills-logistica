import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../lib/firebase'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, deleteUser
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
          err => {
            // Achado de auditoria: antes só parava o loading, sem nunca
            // limpar o profile — se o listener morresse com erro, o app
            // continuava confiando num profile antigo pra sempre (o
            // listener morto nunca mais manda atualização nenhuma).
            // "permission-denied" é o sinal mais forte de que o acesso foi
            // revogado de verdade (ex: Master bloqueou/removeu o usuário e
            // as regras do Firestore agora negam a leitura do próprio
            // perfil) — nesse caso, limpa o perfil pra a tela cair
            // corretamente pro login/bloqueio (App.tsx já trata
            // !profile). Outros erros (rede instável, timeout) NÃO mexem
            // no perfil — não é razoável deslogar alguém por uma
            // instabilidade passageira de conexão.
            console.error('Erro no listener de perfil:', err)
            if (err.code === 'permission-denied') setProfile(null)
            setLoading(false)
          }
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
    try {
      await setDoc(doc(db, 'users', u.uid), profileData)
    } catch (err) {
      // Achado de auditoria: sem isso, uma falha aqui (rede caiu bem nesse
      // instante, erro transiente do Firestore) deixava a conta de Auth
      // criada mas SEM perfil — login() volta a funcionar (credencial
      // válida), só que profile nunca existe, prendendo a pessoa na tela
      // de login pra sempre (App.tsx exige user E profile pra liberar
      // qualquer tela); e um novo cadastro com o mesmo e-mail falha com
      // "e-mail já em uso", sem essa pessoa nunca ter conseguido entrar
      // nem uma vez. Desfaz a conta de Auth recém-criada nesse caso —
      // sem perfil, ela não serve pra nada mesmo — pra quem tentou se
      // cadastrar poder simplesmente tentar de novo do zero.
      await deleteUser(u).catch(delErr => {
        console.error('Falha ao desfazer conta de autenticação após erro no cadastro:', delErr)
      })
      throw err
    }
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
