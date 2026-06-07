import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { T, FONT, FILIAIS, IS, LS } from '../lib/constants'

function MillsLogoFull() {
  return (
    <svg height="50" viewBox="0 0 160 50" fill="none">
      <rect width="160" height="50" rx="8" fill="#F37021"/>
      <text x="12" y="36" fontFamily="Nunito, Arial Rounded MT Bold, sans-serif"
        fontWeight="900" fontSize="32" fill="white" letterSpacing="-1">mills</text>
      <rect x="96" y="9" width="8" height="8" rx="2" fill="white"/>
    </svg>
  )
}

export function LoginScreen() {
  const { login, register } = useAuth()
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [role,     setRole]     = useState('solicitante')
  const [unit,     setUnit]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handle = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name, role, unit)
    } catch (e) {
      const msgs = {
        'auth/invalid-credential':   'E-mail ou senha incorretos.',
        'auth/email-already-in-use': 'Este e-mail já está cadastrado. Clique em Entrar.',
        'auth/weak-password':        'Senha fraca. Mínimo 6 caracteres.',
        'auth/invalid-email':        'E-mail inválido.',
        'auth/user-not-found':       'Usuário não encontrado.',
      }
      setError(msgs[e.code] || e.message)
    }
    setLoading(false)
  }

  // Padrão de barras verticais mills
  const bars = Array.from({length:40},(_,i) => {
    const h = [18,10,22,8,16,12,20,6,14,24,10,18,8,22][i%14]
    return <rect key={i} x={i*16+2} y={36-h} width="6" height={h} rx="2" fill="#F37021" opacity="0.12"/>
  })

  return (
    <div style={{ minHeight:'100vh', background:T.verde, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, position:'relative', overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      {/* Pattern mills */}
      <svg style={{ position:'absolute', bottom:0, left:0, right:0, width:'100%', height:40, overflow:'hidden' }} viewBox="0 0 640 40" preserveAspectRatio="xMidYMax slice">
        {bars}
      </svg>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:5, background:`linear-gradient(to bottom, ${T.laranja}, ${T.laranjaDeep})` }}/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:410, padding:'0 20px' }}>
        <div style={{ background:'rgba(255,255,255,0.97)', borderRadius:20, padding:'36px 32px', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign:'center', marginBottom:26 }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
              <MillsLogoFull/>
            </div>
            <div style={{ color:T.verde, fontFamily:FONT, fontWeight:900, fontSize:13, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:3 }}>GESTÃO DE FROTAS</div>
            <div style={{ color:T.textMuted, fontSize:11, letterSpacing:'0.06em' }}>Logística · Operações de Campo</div>
          </div>

          <div style={{ display:'flex', gap:0, marginBottom:22, background:T.surfaceLow, borderRadius:T.rLg, padding:4 }}>
            {[['login','Entrar'],['register','Criar conta']].map(([m,l]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex:1, padding:'9px 0', borderRadius:T.r, border:'none', cursor:'pointer', fontFamily:FONT, fontWeight:800, fontSize:12, transition:'all .15s',
                  background: mode===m ? T.laranja : 'transparent',
                  color:      mode===m ? 'white'   : T.textSec,
                }}>
                {l}
              </button>
            ))}
          </div>

          {mode === 'register' && <>
            <div style={{ marginBottom:12 }}>
              <label style={LS}>Nome completo</label>
              <input value={name} onChange={e=>setName(e.target.value)} style={IS} placeholder="Seu nome completo"/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={LS}>Perfil de acesso</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[['solicitante','👤','Solicitante'],['frotas','🚛','Frotas']].map(([v,ic,l]) => (
                  <div key={v} onClick={() => setRole(v)}
                    style={{ border:`2px solid ${role===v?T.laranja:T.border}`, borderRadius:T.r, padding:'9px 6px', cursor:'pointer', textAlign:'center',
                      background:role===v?T.laranjaXLight:T.surface, transition:'all .12s' }}>
                    <div style={{ fontSize:16, marginBottom:2 }}>{ic}</div>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:10, color:role===v?T.laranja:T.textSec }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={LS}>Unidade Mills</label>
              <select value={unit} onChange={e=>setUnit(e.target.value)} style={IS}>
                <option value="">— selecione —</option>
                {FILIAIS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </>}

          <div style={{ marginBottom:12 }}>
            <label style={LS}>E-mail corporativo</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={IS}
              placeholder="seu@mills.com.br" onKeyDown={e=>e.key==='Enter'&&handle()}/>
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={LS}>Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={IS}
              placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handle()}/>
          </div>

          {error && <div style={{ background:T.perigoLight, color:T.perigo, borderRadius:T.rSm, padding:'9px 12px', fontSize:12, marginBottom:14, fontFamily:FONT, fontWeight:700 }}>⚠️ {error}</div>}

          <button onClick={handle} disabled={loading}
            style={{ width:'100%', padding:'13px 0', background:loading?T.borderMid:T.laranja, color:'white', border:'none', borderRadius:T.rLg, fontFamily:FONT, fontWeight:900, fontSize:14, cursor:loading?'default':'pointer', letterSpacing:'0.03em', boxShadow:loading?'none':T.shadowMd }}>
            {loading ? 'Aguarde...' : mode==='login' ? 'Entrar →' : 'Criar conta →'}
          </button>
        </div>
        <div style={{ textAlign:'center', marginTop:16, color:'rgba(255,255,255,0.45)', fontSize:10, fontFamily:FONT, letterSpacing:'0.08em' }}>
          Mills Pesados Locação, Serviços e Logística S.A. 
          <div style={{ textAlign:'center', marginTop:6, color:'rgba(255,255,255,0.45)', fontSize:10, fontFamily:FONT, letterSpacing:'0.08em' }}>
  Segurança para sonhar mais alto
</div>
        </div>
      </div>
    </div>
  )
}
