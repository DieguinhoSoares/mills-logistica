// ============================================================
// EmbarquesModal — Checklist de Embarque (INS-EMB-01): lista + detalhe +
// criação (gera o link do embarcador) + finalização (liberação final).
// Preenchimento em si acontece em EmbarcadorView (embarcador, sem login);
// aqui é a visão do analista — revê o que foi preenchido e libera.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { T, FONT, BS, IS, LS, FILIAIS_EMBARQUE, EMBARQUE_CHECKLIST_ITENS, EMBARQUE_GRUPOS, EMBARQUE_ITENS_POR_MAQUINA, EMBARQUE_FOTOS_EQUIPAMENTO, PESQUISA_SATISFACAO_PERGUNTAS } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'

const STATUS_COR = { ok:T.sucesso, nok:T.perigo, na:T.textMuted }
const STATUS_LABEL = { ok:'OK', nok:'NOK', na:'N/A' }

function StatusBadgeEmbarque({ embarque }) {
  if (embarque.status==='finalizado') {
    return embarque.decisao==='autorizado'
      ? <span style={{ background:T.sucessoLight, color:T.sucesso, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>✅ Autorizado</span>
      : <span style={{ background:T.perigoLight, color:T.perigo, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>🚫 Bloqueado</span>
  }
  if (embarque.status==='cancelado') return <span style={{ background:T.surfaceLow, color:T.textMuted, borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>Cancelado</span>
  return <span style={{ background:T.amareloLight, color:'#B8860B', borderRadius:20, padding:'2px 9px', fontSize:9, fontWeight:700, fontFamily:FONT }}>⏳ Em preenchimento</span>
}

async function abrirFoto(embarqueId, fotoId) {
  const snap = await getDoc(doc(db,'embarques',embarqueId,'fotos',fotoId))
  if (!snap.exists()) return
  const { base64 } = snap.data()
  const w = window.open()
  if (w) w.document.write(`<img src="${base64}" style="max-width:100%">`)
}

export function EmbarquesModal({ embarques, onSave, onClose, addToast }) {
  const { profile } = useAuth()
  const [selecionado, setSelecionado] = useState(null) // id do embarque aberto, ou 'novo'
  const [filial, setFilial] = useState('')
  const [frota,  setFrota]  = useState('')
  const [saving, setSaving] = useState(false)
  const [link,   setLink]   = useState(null)
  const [finalizando, setFinalizando] = useState(false)

  const embarqueAtual = embarques.find(e => e.id === selecionado)

  const handleCriar = async () => {
    if (!filial || !frota.trim()) { addToast('Preencha a filial e a frota/equipamento.', 'error'); return }
    setSaving(true)
    try {
      const { embarcadorToken } = await onSave({ filial, frota:frota.trim() })
      setLink(`${window.location.origin}${window.location.pathname}?embarque=${embarcadorToken}`)
    } catch (err) {
      console.error('Erro ao criar checklist de embarque:', err)
      addToast('Erro ao criar checklist. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const copiarLink = txt => navigator.clipboard.writeText(txt).then(
    () => addToast('Link copiado!', 'success'),
    () => addToast('Não consegui copiar — selecione o link manualmente.', 'error')
  )

  const itensNok = embarqueAtual
    ? [
        ...Object.entries(embarqueAtual.itens||{}).filter(([,v])=>v?.status==='nok'),
        ...(embarqueAtual.maquinas||[]).flatMap(m => Object.entries(m.itens||{}).filter(([,v])=>v?.status==='nok')),
      ]
    : []

  const handleFinalizar = async decisao => {
    setFinalizando(true)
    try {
      const patch = { id:embarqueAtual.id, embarcadorToken:embarqueAtual.embarcadorToken, status:'finalizado', decisao, liberadoPor:profile?.name||'Frotas', liberadoEm:new Date().toISOString() }
      // Link do cliente só existe se a saída foi autorizada — não faz
      // sentido mandar confirmação de recebimento de um embarque bloqueado.
      if (decisao==='autorizado') patch.clienteToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      await onSave(patch)
      addToast(decisao==='autorizado' ? '✅ Embarque autorizado!' : '🚫 Embarque bloqueado.', decisao==='autorizado'?'success':'info')
    } catch (err) {
      console.error('Erro ao finalizar checklist:', err)
      addToast('Erro ao finalizar. Tente novamente.', 'error')
    } finally {
      setFinalizando(false)
    }
  }

  const handleGerarLinkCliente = async () => {
    setFinalizando(true)
    try {
      const clienteToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      await onSave({ id:embarqueAtual.id, embarcadorToken:embarqueAtual.embarcadorToken, clienteToken })
    } catch (err) {
      console.error('Erro ao gerar link do cliente:', err)
      addToast('Erro ao gerar link. Tente novamente.', 'error')
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:860, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:0 }}>🛡️ Checklist de Embarque</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'hidden', display:'flex', gap:20 }}>
          <div style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>
            <button onClick={()=>{setSelecionado('novo');setLink(null);setFilial('');setFrota('')}}
              style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11, padding:'8px 0' }}>+ Novo checklist</button>
            {embarques.length===0 && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, textAlign:'center', padding:'16px 0' }}>Nenhum checklist ainda.</div>}
            {embarques.map(e => (
              <div key={e.id} onClick={()=>{setSelecionado(e.id);setLink(null)}}
                style={{ background:selecionado===e.id?T.laranjaLight:T.surfaceAlt, border:`1px solid ${selecionado===e.id?T.laranja+'50':T.border}`, borderRadius:T.rSm, padding:'8px 10px', cursor:'pointer' }}>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text }}>{e.filial}</div>
                <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, marginBottom:4 }}>{e.frota}</div>
                <StatusBadgeEmbarque embarque={e}/>
              </div>
            ))}
          </div>

          <div style={{ flex:1, minWidth:0, overflowY:'auto', paddingLeft:4 }}>
            {selecionado==='novo' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:380 }}>
                <h4 style={{ margin:0, fontFamily:FONT, fontSize:13, color:T.text }}>Novo checklist</h4>
                {!link ? (
                  <>
                    <div><label style={LS}>Filial Mills</label>
                      <select value={filial} onChange={e=>setFilial(e.target.value)} style={IS}>
                        <option value="">— selecione —</option>
                        {FILIAIS_EMBARQUE.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div><label style={LS}>Frota / Equipamento</label>
                      <input value={frota} onChange={e=>setFrota(e.target.value)} style={IS} placeholder="Ex: EHS01259 — Escavadeira CAT 320"/>
                    </div>
                    <button onClick={handleCriar} disabled={saving} style={{ ...BS, background:saving?T.textMuted:T.laranja, color:'white', fontWeight:700, fontSize:11, padding:'9px 0' }}>
                      {saving ? '⏳...' : '➕ Criar e gerar link'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ background:T.sucessoLight, color:T.sucesso, borderRadius:T.rSm, padding:10, fontFamily:FONT, fontWeight:700, fontSize:12 }}>✅ Checklist criado!</div>
                    <div><label style={LS}>Link pro embarcador (sem login)</label>
                      <input readOnly value={link} onFocus={e=>e.target.select()} style={{ ...IS, fontSize:10 }}/>
                    </div>
                    <button onClick={()=>copiarLink(link)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontWeight:700, fontSize:11 }}>📋 Copiar link</button>
                  </>
                )}
              </div>
            )}

            {embarqueAtual && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <h4 style={{ margin:'0 0 2px', fontFamily:FONT, fontSize:14, color:T.text }}>{embarqueAtual.filial} · {embarqueAtual.frota}</h4>
                    <StatusBadgeEmbarque embarque={embarqueAtual}/>
                  </div>
                  {embarqueAtual.status==='em_preenchimento' && (
                    <button onClick={()=>copiarLink(`${window.location.origin}${window.location.pathname}?embarque=${embarqueAtual.embarcadorToken}`)}
                      style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'5px 10px' }}>📋 Copiar link do embarcador</button>
                  )}
                </div>

                <div style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:10, fontFamily:FONT, fontSize:11, color:T.textSec, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div>Transportadora: <strong>{embarqueAtual.transportadora||'—'}</strong></div>
                  <div>Motorista: <strong>{embarqueAtual.motoristaNome||'—'}</strong></div>
                  <div>Cavalo: <strong>{embarqueAtual.cavaloModelo||'—'} {embarqueAtual.cavaloPlaca||''}</strong></div>
                  <div>Prancha: <strong>{embarqueAtual.prancharModelo||'—'} {embarqueAtual.prancharPlaca||''}</strong></div>
                  <div>Responsável: <strong>{embarqueAtual.responsavelNome||'—'} {embarqueAtual.responsavelMatricula?`(mat. ${embarqueAtual.responsavelMatricula})`:''}</strong></div>
                </div>

                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.verde, marginBottom:5 }}>🚜 Máquinas Transportadas ({(embarqueAtual.maquinas||[]).length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {(embarqueAtual.maquinas||[]).map((maq, idx) => (
                      <div key={maq.id} style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:10, display:'flex', flexDirection:'column', gap:5 }}>
                        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text }}>Máquina {idx+1}: {maq.nome||'(sem nome)'}</div>
                        {EMBARQUE_ITENS_POR_MAQUINA.map(item => {
                          const v = maq.itens?.[item.chave]
                          return (
                            <div key={item.chave} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'3px 6px', background:v?.status==='nok'?T.perigoLight:'transparent', borderRadius:6 }}>
                              <span style={{ fontFamily:FONT, fontSize:10, color:T.text }}>{item.descricao}{v?.observacao?` — ${v.observacao}`:''}</span>
                              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                                {v?.fotoId && <button onClick={()=>abrirFoto(embarqueAtual.id,v.fotoId)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11 }}>👁</button>}
                                <span style={{ fontFamily:FONT, fontWeight:700, fontSize:9, color:v?.status?STATUS_COR[v.status]:T.textMuted }}>{v?.status?STATUS_LABEL[v.status]:'—'}</span>
                              </div>
                            </div>
                          )
                        })}
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
                          {EMBARQUE_FOTOS_EQUIPAMENTO.map(({ angulo, label }) => {
                            const fotoId = maq.fotos?.[angulo]
                            return (
                              <button key={angulo} disabled={!fotoId} onClick={()=>fotoId && abrirFoto(embarqueAtual.id, fotoId)}
                                style={{ ...BS, background:fotoId?T.sucessoLight:T.surfaceLow, color:fotoId?T.sucesso:T.textMuted, border:`1px solid ${fotoId?T.sucesso+'30':T.border}`, fontSize:9, padding:'4px 8px', cursor:fotoId?'pointer':'default' }}>
                                {fotoId?'✅':'○'} {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {EMBARQUE_GRUPOS.map(grupo => (
                  <div key={grupo}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.verde, marginBottom:5 }}>{grupo}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {EMBARQUE_CHECKLIST_ITENS.filter(i=>i.grupo===grupo).map(item => {
                        const v = embarqueAtual.itens?.[item.numero]
                        return (
                          <div key={item.numero} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'4px 8px', background:v?.status==='nok'?T.perigoLight:'transparent', borderRadius:6 }}>
                            <span style={{ fontFamily:FONT, fontSize:10.5, color:T.text }}>{item.numero}. {item.descricao}{v?.observacao?` — ${v.observacao}`:''}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                              {v?.fotoId && <button onClick={()=>abrirFoto(embarqueAtual.id,v.fotoId)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11 }}>👁</button>}
                              <span style={{ fontFamily:FONT, fontWeight:700, fontSize:9, color:v?.status?STATUS_COR[v.status]:T.textMuted }}>{v?.status?STATUS_LABEL[v.status]:'—'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {embarqueAtual.status==='em_preenchimento' && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                    {itensNok.length>0 && (
                      <div style={{ background:T.perigoLight, color:T.perigo, borderRadius:T.rSm, padding:10, fontFamily:FONT, fontSize:11, marginBottom:10 }}>
                        ⚠️ {itensNok.length} item(ns) NOK — a aprovação de exceção ainda não está pronta nesta versão; por enquanto, só dá pra bloquear ou resolver o item e pedir pro embarcador corrigir.
                      </div>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>handleFinalizar('bloqueado')} disabled={finalizando}
                        style={{ ...BS, flex:1, background:T.perigo, color:'white', fontWeight:700, fontSize:11, padding:'10px 0' }}>🚫 Bloquear saída</button>
                      <button onClick={()=>handleFinalizar('autorizado')} disabled={finalizando||itensNok.length>0}
                        style={{ ...BS, flex:1, background:itensNok.length>0?T.textMuted:T.sucesso, color:'white', fontWeight:700, fontSize:11, padding:'10px 0' }}>✅ Autorizar saída</button>
                    </div>
                  </div>
                )}

                {embarqueAtual.status==='finalizado' && embarqueAtual.decisao==='autorizado' && !embarqueAtual.clienteConfirmacao && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>📤 Enviar confirmação pro cliente</div>
                    {!embarqueAtual.clienteToken ? (
                      // Checklists autorizados antes desta funcionalidade existir não têm
                      // clienteToken — gera agora em vez de exigir refazer tudo de novo.
                      <button onClick={()=>handleGerarLinkCliente()} disabled={finalizando}
                        style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontWeight:700, fontSize:11, padding:'9px 0' }}>
                        {finalizando ? '⏳...' : '🔗 Gerar link do cliente'}
                      </button>
                    ) : (() => {
                      const linkCliente = `${window.location.origin}${window.location.pathname}?cliente=${embarqueAtual.clienteToken}`
                      const textoWhats = `Olá! Seu equipamento (${embarqueAtual.frota}) saiu da Mills ${embarqueAtual.filial}. Por favor, confirme o recebimento e responda uma pesquisa rápida (30 segundos): ${linkCliente}`
                      return (
                        <div style={{ display:'flex', gap:8 }}>
                          <a href={`https://wa.me/?text=${encodeURIComponent(textoWhats)}`} target="_blank" rel="noopener noreferrer"
                            style={{ ...BS, flex:1, textDecoration:'none', textAlign:'center', background:'#25D366', color:'white', fontWeight:700, fontSize:11, padding:'9px 0' }}>
                            📱 Enviar por WhatsApp
                          </a>
                          <button onClick={()=>copiarLink(linkCliente)} style={{ ...BS, flex:1, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontWeight:700, fontSize:11 }}>📋 Copiar link</button>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {embarqueAtual.clienteConfirmacao && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.sucesso }}>✅ Cliente confirmou o recebimento</div>
                    <div style={{ fontFamily:FONT, fontSize:11, color:T.textSec }}>
                      {embarqueAtual.clienteConfirmacao.nomeCompleto} · {new Date(embarqueAtual.clienteConfirmacao.dataHora).toLocaleString('pt-BR')}
                    </div>
                    {embarqueAtual.clientePesquisa && Object.keys(embarqueAtual.clientePesquisa).length>0 && (
                      <div style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:10, display:'flex', flexDirection:'column', gap:4 }}>
                        {PESQUISA_SATISFACAO_PERGUNTAS.map(p => embarqueAtual.clientePesquisa[p.id] ? (
                          <div key={p.id} style={{ fontFamily:FONT, fontSize:10, color:T.textSec, display:'flex', justifyContent:'space-between' }}>
                            <span>{p.texto}</span><span>{'★'.repeat(embarqueAtual.clientePesquisa[p.id])}{'☆'.repeat(5-embarqueAtual.clientePesquisa[p.id])}</span>
                          </div>
                        ) : null)}
                        {embarqueAtual.clientePesquisa.observacao && (
                          <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, fontStyle:'italic', marginTop:4 }}>"{embarqueAtual.clientePesquisa.observacao}"</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selecionado && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center', padding:'40px 0' }}>Selecione um checklist na lista, ou crie um novo.</div>}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
