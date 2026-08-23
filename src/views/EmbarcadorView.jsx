// ============================================================
// EmbarcadorView — Checklist de Embarque (INS-EMB-01), preenchido no
// pátio pelo embarcador, SEM LOGIN (acesso só por token na URL, mesmo
// padrão de MotoristaView/link do motorista). Layout mobile-first.
//
// Carregamento pode ter mais de uma máquina na mesma prancha — por isso
// os itens que são "por equipamento" (modelo/série, horímetro,
// combustível, altura/largura, bateria + as 4 fotos de ângulo) viram uma
// lista repetível de máquinas, cada uma com seu próprio conjunto. O
// checklist geral (documentação, prancha, amarração, rastreabilidade)
// continua único — é sobre o transporte como um todo, não por máquina.
// ============================================================
import { useState, useEffect } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { T, FONT, BS, IS, LS, EMBARQUE_CHECKLIST_ITENS, EMBARQUE_GRUPOS, EMBARQUE_ITENS_POR_MAQUINA, EMBARQUE_FOTOS_EQUIPAMENTO } from '../lib/constants'
import { arquivoParaBase64Documento } from '../lib/utils'
import { useEmbarqueByToken } from '../hooks/useFirestore'

const STATUS_OPCOES = [
  { value:'ok',  label:'OK',  cor:T.sucesso, bg:T.sucessoLight },
  { value:'nok', label:'NOK', cor:T.perigo,  bg:T.perigoLight  },
  { value:'na',  label:'N/A', cor:T.textMuted, bg:T.surfaceLow },
]

const novaMaquina = () => ({ id:`maq_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, nome:'', itens:{}, fotos:{} })

function ItemLinha({ rotulo, item, valor, onChange, onFoto, enviandoFoto }) {
  const v = valor || {}
  const exigeFoto = item.foto || (item.fotoSeAplicavel && v.status && v.status!=='na')

  if (item.confirmacao) {
    return (
      <div style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
        <input type="checkbox" checked={v.status==='ok'} onChange={e=>onChange({ status:e.target.checked?'ok':null })}
          style={{ width:18, height:18, flexShrink:0 }}/>
        <span style={{ fontFamily:FONT, fontSize:12, color:T.text }}>{rotulo}{item.descricao}</span>
      </div>
    )
  }

  return (
    <div style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:'10px 12px', display:'flex', flexDirection:'column', gap:7 }}>
      <span style={{ fontFamily:FONT, fontSize:12, color:T.text, fontWeight:500 }}>{rotulo}{item.descricao}</span>
      <div style={{ display:'flex', gap:6 }}>
        {STATUS_OPCOES.map(o => (
          <button key={o.value} onClick={()=>onChange({ status:o.value })}
            style={{ flex:1, border:`1.5px solid ${v.status===o.value?o.cor:T.border}`, background:v.status===o.value?o.bg:T.surface, color:v.status===o.value?o.cor:T.textMuted, fontFamily:FONT, fontWeight:700, fontSize:11, padding:'7px 0', borderRadius:T.rSm, cursor:'pointer' }}>
            {o.label}
          </button>
        ))}
      </div>
      {v.status==='nok' && (
        <input value={v.observacao||''} onChange={e=>onChange({ observacao:e.target.value })}
          placeholder="Descreva a não conformidade..." style={{ ...IS, fontSize:11 }}/>
      )}
      {exigeFoto && (
        <div>
          {v.fotoId
            ? <div style={{ fontFamily:FONT, fontSize:10, color:T.sucesso, fontWeight:700 }}>📷 Foto anexada</div>
            : <label style={{ display:'inline-block' }}>
                <input type="file" accept="image/*" capture="environment" style={{ display:'none' }}
                  onChange={e=>e.target.files?.[0] && onFoto(e.target.files[0])}/>
                <span style={{ ...BS, display:'inline-block', background:enviandoFoto?T.textMuted:T.laranjaLight, color:enviandoFoto?'white':T.laranja, border:`1px solid ${T.laranja}30`, fontSize:10, padding:'6px 10px', cursor:'pointer' }}>
                  {enviandoFoto ? '⏳ Enviando...' : '📷 Anexar foto (obrigatória)'}
                </span>
              </label>}
        </div>
      )}
    </div>
  )
}

export function EmbarcadorView({ token }) {
  const { embarque, loading, error, salvarProgresso } = useEmbarqueByToken(token)
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [fotoEnviando, setFotoEnviando] = useState(null) // chave sendo enviada agora
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (embarque && !form) {
      setForm({
        transportadora: embarque.transportadora||'', motoristaNome: embarque.motoristaNome||'', motoristaDocumento: embarque.motoristaDocumento||'',
        cavaloModelo: embarque.cavaloModelo||'', cavaloPlaca: embarque.cavaloPlaca||'',
        prancharModelo: embarque.prancharModelo||'', prancharPlaca: embarque.prancharPlaca||'',
        itens: embarque.itens || {},
        maquinas: embarque.maquinas?.length ? embarque.maquinas : [novaMaquina()],
        responsavelNome: embarque.responsavelNome||'', responsavelMatricula: embarque.responsavelMatricula||'',
      })
    }
  }, [embarque, form])

  if (loading || (!form && !error)) return (
    <div style={{ background:T.bgCold, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ textAlign:'center' }}><div style={{ fontSize:40, marginBottom:12 }}>⏳</div><div style={{ color:T.textMuted }}>Carregando...</div></div>
    </div>
  )

  if (error) return (
    <div style={{ background:T.bgCold, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, padding:20 }}>
      <div style={{ textAlign:'center', maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:16, marginBottom:8 }}>Acesso não autorizado</div>
        <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:13 }}>{error}</div>
      </div>
    </div>
  )

  const travado = embarque.status !== 'em_preenchimento'

  const setItem = (numero, patch) => setForm(p => ({ ...p, itens:{ ...p.itens, [numero]:{ ...p.itens[numero], ...patch } } }))

  const setMaquina = (maquinaId, patch) => setForm(p => ({ ...p, maquinas:p.maquinas.map(m => m.id===maquinaId ? { ...m, ...patch } : m) }))
  const setMaquinaItem = (maquinaId, chave, patch) => setForm(p => ({ ...p, maquinas:p.maquinas.map(m =>
    m.id===maquinaId ? { ...m, itens:{ ...m.itens, [chave]:{ ...m.itens[chave], ...patch } } } : m
  ) }))
  const addMaquina = () => setForm(p => ({ ...p, maquinas:[...p.maquinas, novaMaquina()] }))
  const removeMaquina = maquinaId => setForm(p => p.maquinas.length<=1 ? p : ({ ...p, maquinas:p.maquinas.filter(m=>m.id!==maquinaId) }))

  const salvarFoto = async file => {
    const base64 = await arquivoParaBase64Documento(file)
    const fotoId = `foto_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    await setDoc(doc(db,'embarques',embarque.id,'fotos',fotoId), { base64, criadoEm:new Date().toISOString() })
    return fotoId
  }

  const handleFotoItem = async (numero, file) => {
    setFotoEnviando(`item-${numero}`)
    try {
      const fotoId = await salvarFoto(file)
      setItem(numero, { fotoId })
    } catch (err) {
      console.error('Erro ao anexar foto:', err)
      setMsg('❌ Erro ao anexar foto. Tente novamente.')
    } finally {
      setFotoEnviando(null)
    }
  }

  const handleFotoMaquinaItem = async (maquinaId, chave, file) => {
    setFotoEnviando(`maq-${maquinaId}-item-${chave}`)
    try {
      const fotoId = await salvarFoto(file)
      setMaquinaItem(maquinaId, chave, { fotoId })
    } catch (err) {
      console.error('Erro ao anexar foto:', err)
      setMsg('❌ Erro ao anexar foto. Tente novamente.')
    } finally {
      setFotoEnviando(null)
    }
  }

  const handleFotoMaquinaAngulo = async (maquinaId, angulo, file) => {
    setFotoEnviando(`maq-${maquinaId}-foto-${angulo}`)
    try {
      const fotoId = await salvarFoto(file)
      setMaquina(maquinaId, { fotos:{ ...form.maquinas.find(m=>m.id===maquinaId).fotos, [angulo]:fotoId } })
    } catch (err) {
      console.error('Erro ao anexar foto:', err)
      setMsg('❌ Erro ao anexar foto. Tente novamente.')
    } finally {
      setFotoEnviando(null)
    }
  }

  const handleSalvar = async () => {
    setSalvando(true); setMsg('')
    try {
      await salvarProgresso(form)
      setMsg('✅ Progresso salvo!')
    } catch (err) {
      console.error('Erro ao salvar checklist:', err)
      setMsg('❌ Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ background:T.bgCold, minHeight:'100vh', fontFamily:FONT, maxWidth:480, margin:'0 auto' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      <div style={{ background:T.verde, padding:16, position:'sticky', top:0, zIndex:100, boxShadow:T.shadowMd }}>
        <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:15 }}>🛡️ Checklist de Embarque</div>
        <div style={{ color:'rgba(255,255,255,0.65)', fontFamily:FONT, fontSize:11 }}>{embarque.filial} · {embarque.frota}</div>
      </div>

      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>
        {travado && (
          <div style={{ background:T.infoLight, color:T.info, borderRadius:T.r, padding:'10px 12px', fontFamily:FONT, fontSize:12, fontWeight:700, textAlign:'center' }}>
            🔒 Checklist {embarque.status==='finalizado'?'finalizado':'cancelado'} — só leitura. Se precisar corrigir algo, peça ao analista pra cancelar e abrir um novo.
          </div>
        )}

        <fieldset disabled={travado} style={{ border:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:T.surface, borderRadius:T.r, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>Dados do transporte</div>
            <div><label style={LS}>Transportadora</label><input value={form.transportadora} onChange={e=>setForm(p=>({...p,transportadora:e.target.value}))} style={IS}/></div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1 }}><label style={LS}>Motorista</label><input value={form.motoristaNome} onChange={e=>setForm(p=>({...p,motoristaNome:e.target.value}))} style={IS}/></div>
              <div style={{ flex:1 }}><label style={LS}>CPF</label><input value={form.motoristaDocumento} onChange={e=>setForm(p=>({...p,motoristaDocumento:e.target.value}))} style={IS}/></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1 }}><label style={LS}>Cavalo (modelo/placa)</label><input value={form.cavaloModelo} onChange={e=>setForm(p=>({...p,cavaloModelo:e.target.value}))} placeholder="Modelo" style={IS}/></div>
              <div style={{ flex:1 }}><label style={LS}>&nbsp;</label><input value={form.cavaloPlaca} onChange={e=>setForm(p=>({...p,cavaloPlaca:e.target.value.toUpperCase()}))} placeholder="Placa" style={IS}/></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1 }}><label style={LS}>Prancha (modelo/placa)</label><input value={form.prancharModelo} onChange={e=>setForm(p=>({...p,prancharModelo:e.target.value}))} placeholder="Modelo" style={IS}/></div>
              <div style={{ flex:1 }}><label style={LS}>&nbsp;</label><input value={form.prancharPlaca} onChange={e=>setForm(p=>({...p,prancharPlaca:e.target.value.toUpperCase()}))} placeholder="Placa" style={IS}/></div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.verde }}>🚜 Máquinas Transportadas ({form.maquinas.length})</div>
              <button onClick={addMaquina} type="button" style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontSize:10, padding:'5px 10px' }}>+ Adicionar máquina</button>
            </div>
            {form.maquinas.map((maq, idx) => (
              <div key={maq.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div style={{ flex:1 }}>
                    <label style={LS}>Máquina {idx+1} — nome/nº interno</label>
                    <input value={maq.nome} onChange={e=>setMaquina(maq.id,{ nome:e.target.value })} style={IS} placeholder="Ex: EHS01259 — Escavadeira CAT 320"/>
                  </div>
                  {form.maquinas.length>1 && (
                    <button onClick={()=>removeMaquina(maq.id)} type="button" style={{ background:'none', border:'none', color:T.perigo, cursor:'pointer', fontSize:16, padding:'0 4px 8px' }}>🗑</button>
                  )}
                </div>
                {EMBARQUE_ITENS_POR_MAQUINA.map(item => (
                  <ItemLinha key={item.chave} rotulo="" item={item} valor={maq.itens[item.chave]}
                    onChange={patch=>setMaquinaItem(maq.id,item.chave,patch)}
                    onFoto={file=>handleFotoMaquinaItem(maq.id,item.chave,file)}
                    enviandoFoto={fotoEnviando===`maq-${maq.id}-item-${item.chave}`}/>
                ))}
                <div style={{ fontFamily:FONT, fontSize:10, color:T.textSec, fontWeight:700, marginTop:4 }}>📷 Fotos (4 ângulos)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {EMBARQUE_FOTOS_EQUIPAMENTO.map(({ angulo, label }) => (
                    <div key={angulo} style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:8, textAlign:'center' }}>
                      <div style={{ fontFamily:FONT, fontSize:9.5, color:T.textSec, fontWeight:700, marginBottom:5 }}>{label}</div>
                      {maq.fotos[angulo]
                        ? <div style={{ fontFamily:FONT, fontSize:9.5, color:T.sucesso, fontWeight:700 }}>📷 Anexada</div>
                        : <label>
                            <input type="file" accept="image/*" capture="environment" style={{ display:'none' }}
                              onChange={e=>e.target.files?.[0] && handleFotoMaquinaAngulo(maq.id,angulo,e.target.files[0])}/>
                            <span style={{ ...BS, display:'inline-block', background:fotoEnviando===`maq-${maq.id}-foto-${angulo}`?T.textMuted:T.laranjaLight, color:fotoEnviando===`maq-${maq.id}-foto-${angulo}`?'white':T.laranja, border:`1px solid ${T.laranja}30`, fontSize:9, padding:'5px 8px', cursor:'pointer' }}>
                              {fotoEnviando===`maq-${maq.id}-foto-${angulo}` ? '⏳...' : '📷 Anexar'}
                            </span>
                          </label>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {EMBARQUE_GRUPOS.map(grupo => (
            <div key={grupo} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.verde }}>{grupo}</div>
              {EMBARQUE_CHECKLIST_ITENS.filter(i=>i.grupo===grupo).map(item => (
                <ItemLinha key={item.numero} rotulo={`${item.numero}. `} item={item} valor={form.itens[item.numero]}
                  onChange={patch=>setItem(item.numero,patch)}
                  onFoto={file=>handleFotoItem(item.numero,file)}
                  enviandoFoto={fotoEnviando===`item-${item.numero}`}/>
              ))}
            </div>
          ))}

          <div style={{ background:T.surface, borderRadius:T.r, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>Responsável pela verificação</div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1 }}><label style={LS}>Nome completo</label><input value={form.responsavelNome} onChange={e=>setForm(p=>({...p,responsavelNome:e.target.value}))} style={IS}/></div>
              <div style={{ flex:1 }}><label style={LS}>Matrícula</label><input value={form.responsavelMatricula} onChange={e=>setForm(p=>({...p,responsavelMatricula:e.target.value}))} style={IS}/></div>
            </div>
          </div>
        </fieldset>

        {!travado && (
          <>
            <button onClick={handleSalvar} disabled={salvando}
              style={{ ...BS, background:salvando?T.textMuted:T.laranja, color:'white', fontWeight:700, fontSize:13, padding:'12px 0' }}>
              {salvando ? '⏳ Salvando...' : '💾 Salvar progresso'}
            </button>
            {msg && <div style={{ textAlign:'center', fontFamily:FONT, fontSize:12, color:msg.startsWith('✅')?T.sucesso:T.perigo }}>{msg}</div>}
            <div style={{ textAlign:'center', fontFamily:FONT, fontSize:10, color:T.textMuted }}>
              Pode salvar e continuar depois — a liberação final é feita pelo analista.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
