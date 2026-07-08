import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db, functions } from '../lib/firebase'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? snap.data() : null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  // Antes chamava sendPasswordResetEmail(auth, email) — o template genérico
  // do Firebase (sem logo/cores da Mills). Agora passa por uma Cloud
  // Function que gera o mesmo link seguro via Admin SDK e manda o e-mail
  // com HTML da marca Mills via SendGrid (ver functions/password-reset.js).
  const resetPassword = (email) => {
    const fn = httpsCallable(functions, 'sendPasswordResetEmailCustom')
    return fn({ email })
  }

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
