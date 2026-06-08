import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { MillsLogo } from '../components/UI'
import { T, FONT, BS } from '../lib/constants'

export function PendingScreen({ recusado = false }) {
  const { profile, logout } = useAuth()

  return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rXl, padding:'40px 44px', maxWidth:480, width:'90%', boxShadow:T.shadowLg, textAlign:'center', border:`1px solid ${T.border}` }}>

        <MillsLogo height={36}/>

        <div style={{ marginTop:28, marginBottom:8 }}>
          {recusado ? (
            <>
              <div style={{ fontSize:48, marginBottom:12 }}>❌</div>
              <h2 style={{ color:T.perigo, fontFamily:FONT, fontWeight:800, fontSize:22, margin:'0 0 10px' }}>
                Cadastro não aprovado
              </h2>
              <p style={{ color:T.textSec, fontFamily:FONT, fontSize:13, lineHeight:1.6, margin:'0 0 6px' }}>
                Seu cadastro foi recusado pelo administrador do sistema.
              </p>
              <p style={{ color:T.textSec, fontFamily:FONT, fontSize:13, lineHeight:1.6 }}>
                Entre em contato com o time de Gestão de Frotas para mais informações.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize:48, marginBottom:12 }}>⏳</div>
              <h2 style={{ color:T.verde, fontFamily:FONT, fontWeight:800, fontSize:22, margin:'0 0 10px' }}>
                Cadastro em análise
              </h2>
              <p style={{ color:T.textSec, fontFamily:FONT, fontSize:13, lineHeight:1.6, margin:'0 0 6px' }}>
                Olá, <strong style={{ color:T.laranja }}>{profile?.name}</strong>! Seu cadastro foi recebido e está aguardando aprovação do administrador.
              </p>
              <p style={{ color:T.textSec, fontFamily:FONT, fontSize:13, lineHeight:1.6 }}>
                Você será notificado assim que o acesso for liberado. Normalmente isso ocorre em até 24 horas úteis.
              </p>
            </>
          )}
        </div>

        <div style={{ margin:'24px 0', padding:'12px 16px', background: recusado ? T.perigoLight : T.verdeLight, borderRadius:T.r, border:`1px solid ${recusado ? T.perigo : T.verde}30` }}>
          <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Cadastrado como</div>
          <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:13 }}>{profile?.name}</div>
          <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11 }}>{profile?.email} · {profile?.unit}</div>
          <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:2 }}>
            Perfil solicitado: <strong>{profile?.role === 'frotas' ? 'Gestão de Frotas' : 'Solicitante'}</strong>
          </div>
        </div>

        <button onClick={logout}
          style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, width:'100%' }}>
          Sair
        </button>
      </motion.div>

      <div style={{ marginTop:20, color:T.textMuted, fontSize:10, fontFamily:FONT }}>
        Mills Pesados, Locação Serviços e Logística S.A.
      </div>
    </div>
  )
}
