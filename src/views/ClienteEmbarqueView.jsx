// ============================================================
// ClienteEmbarqueView — confirmação de recebimento + pesquisa de
// satisfação (Fase 2 do Checklist de Embarque), sem login, acesso só por
// token na URL (?cliente=<token>, gerado quando o analista autoriza a
// saída — ver EmbarquesModal). Nome completo = "assinatura digital" do
// aceite. A pesquisa é incentivada mas NÃO bloqueia o envio.
// ============================================================
import { useState } from 'react'
import { T, FONT, BS, IS, LS, PESQUISA_SATISFACAO_PERGUNTAS } from '../lib/constants'
import { useEmbarqueByClienteToken } from '../hooks/useFirestore'

function Estrelas({ valor, onChange }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n===valor?0:n)} type="button"
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:26, padding:0, lineHeight:1, color:n<=valor?T.amarelo:T.border }}>
          ★
        </button>
      ))}
    </div>
  )
}

export function ClienteEmbarqueView({ token }) {
  const { embarque, loading, error, enviarConfirmacao } = useEmbarqueByClienteToken(token)
  const [nome, setNome] = useState('')
  const [pesquisa, setPesquisa] = useState({})
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  if (loading) return (
    <div style={{ background:T.bgCold, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ textAlign:'center' }}><div style={{ fontSize:40, marginBottom:12 }}>⏳</div><div style={{ color:T.textMuted }}>Carregando...</div></div>
    </div>
  )

  if (error) return (
    <div style={{ background:T.bgCold, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, padding:20 }}>
      <div style={{ textAlign:'center', maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:16, marginBottom:8 }}>Link inválido</div>
        <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:13 }}>{error}</div>
      </div>
    </div>
  )

  const jaConfirmado = !!embarque.clienteConfirmacao

  const handleEnviar = async () => {
    if (!nome.trim()) { setMsg('❌ Informe seu nome completo pra confirmar.'); return }
    setEnviando(true); setMsg('')
    try {
      await enviarConfirmacao({ nomeCompleto:nome.trim(), pesquisa:{ ...pesquisa, observacao:observacao.trim()||undefined } })
    } catch (err) {
      console.error('Erro ao enviar confirmação:', err)
      setMsg('❌ Erro ao enviar. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ background:T.bgCold, minHeight:'100vh', fontFamily:FONT, maxWidth:480, margin:'0 auto' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      <div style={{ background:T.verde, padding:20, textAlign:'center' }}>
        <div style={{ color:'white', fontFamily:FONT, fontWeight:800, fontSize:16 }}>mills</div>
        <div style={{ color:'rgba(255,255,255,.7)', fontFamily:FONT, fontSize:11, marginTop:2 }}>Confirmação de recebimento</div>
      </div>

      <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ background:T.surface, borderRadius:T.r, padding:14, textAlign:'center' }}>
          <div style={{ fontFamily:FONT, fontSize:12, color:T.textMuted }}>Equipamento</div>
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:T.text }}>{embarque.frota}</div>
          <div style={{ fontFamily:FONT, fontSize:11, color:T.textMuted, marginTop:2 }}>Saiu de {embarque.filial}</div>
        </div>

        {jaConfirmado ? (
          <div style={{ background:T.sucessoLight, borderRadius:T.r, padding:20, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ color:T.sucesso, fontFamily:FONT, fontWeight:700, fontSize:14, marginBottom:4 }}>Recebimento já confirmado</div>
            <div style={{ color:T.textSec, fontFamily:FONT, fontSize:12 }}>
              Por {embarque.clienteConfirmacao.nomeCompleto}<br/>
              {new Date(embarque.clienteConfirmacao.dataHora).toLocaleString('pt-BR')}
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:T.surface, borderRadius:T.r, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>Confirmar recebimento</div>
              <p style={{ fontFamily:FONT, fontSize:12, color:T.textSec, margin:0, lineHeight:1.5 }}>
                Confirme que recebeu o equipamento nas condições esperadas, digitando seu nome completo abaixo.
              </p>
              <div><label style={LS}>Nome completo *</label>
                <input value={nome} onChange={e=>setNome(e.target.value)} style={IS} placeholder="Seu nome completo"/>
              </div>
            </div>

            <div style={{ background:T.surface, borderRadius:T.r, padding:16, display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>Pesquisa de satisfação</div>
                <div style={{ fontFamily:FONT, fontSize:11, color:T.textMuted }}>Opcional, mas ajuda muito — leva 30 segundos.</div>
              </div>
              {PESQUISA_SATISFACAO_PERGUNTAS.map(p => (
                <div key={p.id} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <span style={{ fontFamily:FONT, fontSize:12, color:T.textSec }}>{p.texto}</span>
                  <Estrelas valor={pesquisa[p.id]||0} onChange={v=>setPesquisa(prev=>({...prev,[p.id]:v}))}/>
                </div>
              ))}
              <div>
                <label style={LS}>Comentário (opcional)</label>
                <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={3}
                  style={{ ...IS, fontFamily:FONT, resize:'vertical' }} placeholder="Algo que queira nos contar..."/>
              </div>
            </div>

            <button onClick={handleEnviar} disabled={enviando}
              style={{ ...BS, background:enviando?T.textMuted:T.laranja, color:'white', fontWeight:700, fontSize:13, padding:'13px 0' }}>
              {enviando ? '⏳ Enviando...' : '✅ Confirmar recebimento'}
            </button>
            {msg && <div style={{ textAlign:'center', fontFamily:FONT, fontSize:12, color:T.perigo }}>{msg}</div>}
          </>
        )}

        <div style={{ textAlign:'center', fontFamily:FONT, fontSize:10, color:T.textMuted, paddingBottom:10 }}>
          Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto
        </div>
      </div>
    </div>
  )
}
