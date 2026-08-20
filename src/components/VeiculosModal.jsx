// ============================================================
// VeiculosModal — Cadastro de Veículos (tipo, modelo, placa, motorista
// vinculado, documentos/licenças com upload e lembrete de vencimento).
// Mesmo padrão visual do DriversModal (lista + formulário).
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS, TIPO_VEICULO_OPTIONS, TIPO_DOCUMENTO_VEICULO_OPTIONS, DOC_URGENCIA } from '../lib/constants'
import { fmt, todayStr, documentoUrgencia, documentoPrecisaConfirmacao, documentosPendentes, arquivoParaBase64Documento } from '../lib/utils'
import { ConfirmModal } from './UI'

const blankVeiculo = { tipo:'cavalo', modelo:'', placa:'', motoristaId:'', ativo:true, documentos:[] }
const blankDocumento = { tipoDoc:'', tipoDocOutro:'', numero:'', validade:'' }

function tipoVeiculoLabel(tipo) {
  return TIPO_VEICULO_OPTIONS.find(t => t.value === tipo)?.label || tipo || '—'
}

function UrgenciaBadge({ nivel }) {
  if (!nivel) return null
  const meta = DOC_URGENCIA[nivel]
  return (
    <span style={{ background:meta.bg, color:meta.color, borderRadius:6, padding:'2px 7px', fontSize:9, fontWeight:700, fontFamily:FONT, whiteSpace:'nowrap' }}>
      {meta.label}
    </span>
  )
}

export function VeiculosModal({ veiculos, drivers, onSave, onDelete, onClose, addToast, profile }) {
  const [form, setForm]         = useState(null) // null = fechado; objeto = form aberto
  const [novoDoc, setNovoDoc]   = useState(blankDocumento)
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(null) // veículo sendo confirmado pra exclusão

  const pendentes = documentosPendentes(veiculos)

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const abrirNova   = () => { setForm(blankVeiculo); setNovoDoc(blankDocumento) }
  const abrirEdicao = v  => { setForm({ ...blankVeiculo, ...v }); setNovoDoc(blankDocumento) }

  const handleSalvar = async () => {
    if (!form.placa.trim()) { addToast('Informe a placa do veículo.', 'error'); return }
    setSaving(true)
    try {
      await onSave(form)
      addToast(form.id ? '✅ Veículo atualizado!' : '✅ Veículo cadastrado!', 'success')
      setForm(null)
    } catch (err) {
      console.error('Erro ao salvar veículo:', err)
      addToast('Erro ao salvar. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Documentos são salvos na hora (não esperam o botão "Salvar veículo") —
  // se o analista fechar o modal sem clicar em "Salvar veículo", o documento
  // já anexado não pode se perder. Sempre parte do dado mais recente vindo
  // de `veiculos` (prop), não do rascunho local `form`, pra não sobrescrever
  // uma mudança concorrente feita por outra pessoa nos campos básicos.
  const salvarDocumentos = async novaLista => {
    const atual = veiculos.find(v => v.id === form.id) || form
    const atualizado = { ...atual, documentos:novaLista }
    await onSave(atualizado)
    setForm(p => ({ ...p, documentos:novaLista }))
  }

  const handleAdicionarDocumento = async () => {
    const tipoFinal = novoDoc.tipoDoc === 'outro' ? novoDoc.tipoDocOutro.trim() : novoDoc.tipoDoc
    if (!tipoFinal) { addToast('Escolha ou digite o tipo do documento.', 'error'); return }
    if (!novoDoc.validade) { addToast('Informe a data de validade.', 'error'); return }

    let arquivoUrl = ''
    let arquivoNome = ''
    const arquivo = novoDoc._arquivo
    if (arquivo) {
      setUploading(true)
      try {
        arquivoUrl = await arquivoParaBase64Documento(arquivo)
        arquivoNome = arquivo.name
      } catch (err) {
        console.error('Erro ao anexar arquivo:', err)
        addToast(err.message || 'Erro ao anexar arquivo. Tente novamente.', 'error')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    const documento = {
      tipo: tipoFinal, numero: novoDoc.numero.trim(), validade: novoDoc.validade,
      arquivoUrl, arquivoNome,
      renovacaoSolicitada: false,
      criadoEm: new Date().toISOString(),
    }
    try {
      await salvarDocumentos([...(form.documentos||[]), documento])
      setNovoDoc(blankDocumento)
      addToast('✅ Documento adicionado!', 'success')
    } catch (err) {
      console.error('Erro ao adicionar documento:', err)
      addToast('Erro ao salvar documento. Tente novamente.', 'error')
    }
  }

  const handleExcluirDocumento = async idx => {
    try {
      await salvarDocumentos(form.documentos.filter((_,i) => i !== idx))
      addToast('Documento removido.', 'info')
    } catch (err) {
      console.error('Erro ao remover documento:', err)
      addToast('Erro ao remover. Tente novamente.', 'error')
    }
  }

  const handleConfirmarRenovacao = async idx => {
    const lista = form.documentos.map((d,i) => i===idx
      ? { ...d, renovacaoSolicitada:true, renovacaoSolicitadaPor:profile?.name||'Frotas', renovacaoSolicitadaEm:new Date().toISOString() }
      : d)
    try {
      await salvarDocumentos(lista)
      addToast('✅ Solicitação de renovação confirmada.', 'success')
    } catch (err) {
      console.error('Erro ao confirmar renovação:', err)
      addToast('Erro ao confirmar. Tente novamente.', 'error')
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:820, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:0 }}>🚚 Veículos Cadastrados</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', display:'flex', gap:20 }}>
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:14 }}>
            {/* Pendências — documentos vencidos/vencendo em qualquer veículo */}
            {pendentes.length > 0 && (
              <div style={{ background:DOC_URGENCIA.critico.bg, border:`1px solid ${DOC_URGENCIA.critico.color}30`, borderRadius:T.r, padding:12 }}>
                <div style={{ color:DOC_URGENCIA.critico.color, fontFamily:FONT, fontWeight:800, fontSize:11, marginBottom:8 }}>
                  ⚠️ {pendentes.length} documento(s) vencendo ou vencido(s)
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {pendentes.map((p,i) => (
                    <div key={i} onClick={()=>abrirEdicao(veiculos.find(v=>v.id===p.veiculoId))}
                      style={{ background:T.surface, borderRadius:T.rSm, padding:'6px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, cursor:'pointer' }}>
                      <span style={{ fontFamily:FONT, fontSize:11, color:T.text }}>
                        <strong>{p.veiculoPlaca}</strong> · {p.documento.tipo} · vence {fmt(p.documento.validade)}
                      </span>
                      <UrgenciaBadge nivel={p.nivel}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>Todos os veículos ({veiculos.length})</span>
              <button onClick={abrirNova} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11, padding:'6px 12px' }}>+ Novo veículo</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {veiculos.length===0 && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center', padding:'20px 0' }}>Nenhum veículo cadastrado.</div>}
              {veiculos.map(v => {
                const motorista = drivers.find(d => d.id === v.motoristaId)
                const nivelMaisAlto = (v.documentos||[]).map(d=>documentoUrgencia(d.validade)).find(Boolean)
                return (
                  <div key={v.id} onClick={()=>abrirEdicao(v)}
                    style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'10px 13px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', opacity:v.ativo===false?0.55:1 }}>
                    <div>
                      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{v.placa} <span style={{ color:T.textMuted, fontWeight:500 }}>· {tipoVeiculoLabel(v.tipo)}</span></div>
                      <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{v.modelo||'—'} {motorista && `· 👤 ${motorista.name}`} {v.ativo===false && '· 🔴 Inativo'}</div>
                    </div>
                    <UrgenciaBadge nivel={nivelMaisAlto}/>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Formulário */}
          {form && (
            <div style={{ width:340, flexShrink:0, borderLeft:`1px solid ${T.border}`, paddingLeft:20, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>
              <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:14, margin:0 }}>{form.id ? '✏️ Editar' : '➕ Novo'} Veículo</h3>

              <div><label style={LS}>Tipo</label>
                <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={IS}>
                  {TIPO_VEICULO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label style={LS}>Placa *</label><input value={form.placa} onChange={e=>set('placa',e.target.value.toUpperCase())} style={IS} placeholder="ABC1D23"/></div>
              <div><label style={LS}>Modelo</label><input value={form.modelo} onChange={e=>set('modelo',e.target.value)} style={IS} placeholder="Ex: Volvo FH 540"/></div>
              <div><label style={LS}>Motorista vinculado</label>
                <select value={form.motoristaId||''} onChange={e=>set('motoristaId',e.target.value)} style={IS}>
                  <option value="">— nenhum —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:FONT, fontSize:11, color:T.textSec, cursor:'pointer' }}>
                <input type="checkbox" checked={form.ativo!==false} onChange={e=>set('ativo',e.target.checked)}/> Ativo
              </label>

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={()=>setForm(null)} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Cancelar</button>
                <button onClick={handleSalvar} disabled={saving} style={{ ...BS, flex:1, background:saving?T.textMuted:T.laranja, color:'white', fontWeight:700, fontSize:11 }}>
                  {saving ? '⏳...' : '💾 Salvar'}
                </button>
                {form.id && (
                  <button onClick={()=>setDeleting(form)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}30`, fontSize:11, padding:'8px 10px' }}>🗑</button>
                )}
              </div>

              <div style={{ height:1, background:T.border, margin:'6px 0' }}/>

              <h4 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:12, margin:0 }}>📄 Documentos</h4>

              {!form.id ? (
                <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, fontStyle:'italic' }}>
                  Salve o veículo primeiro pra poder anexar documentos.
                </div>
              ) : (
                <>
                  {(form.documentos||[]).length===0 && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11 }}>Nenhum documento cadastrado ainda.</div>}
                  {(form.documentos||[]).map((d,idx) => {
                    const nivel = documentoUrgencia(d.validade)
                    const precisaConfirmar = documentoPrecisaConfirmacao(d)
                    return (
                      <div key={idx} style={{ background:T.surfaceAlt, borderRadius:T.rSm, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
                          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text }}>{d.tipo}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <UrgenciaBadge nivel={nivel}/>
                            <button onClick={()=>handleExcluirDocumento(idx)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', fontSize:12 }}>🗑</button>
                          </div>
                        </div>
                        <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>
                          {d.numero && `Nº ${d.numero} · `}Validade: {fmt(d.validade)}
                        </div>
                        {d.arquivoUrl && (
                          <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily:FONT, fontSize:10, color:T.info, textDecoration:'underline' }}>
                            📥 Baixar {d.arquivoNome||'arquivo'}
                          </a>
                        )}
                        {precisaConfirmar && (
                          <button onClick={()=>handleConfirmarRenovacao(idx)}
                            style={{ ...BS, background:T.perigo, color:'white', fontWeight:700, fontSize:10, padding:'5px 8px', marginTop:2 }}>
                            Confirmar solicitação de renovação
                          </button>
                        )}
                        {d.renovacaoSolicitada && (
                          <div style={{ fontFamily:FONT, fontSize:9, color:T.sucesso }}>✓ Renovação já solicitada{d.renovacaoSolicitadaPor?` por ${d.renovacaoSolicitadaPor}`:''}</div>
                        )}
                      </div>
                    )
                  })}

                  <div style={{ background:T.surface, border:`1px dashed ${T.borderMid}`, borderRadius:T.rSm, padding:10, display:'flex', flexDirection:'column', gap:6 }}>
                    <label style={LS}>Novo documento</label>
                    <select value={novoDoc.tipoDoc} onChange={e=>setNovoDoc(p=>({...p,tipoDoc:e.target.value}))} style={{ ...IS, fontSize:11 }}>
                      <option value="">— selecione —</option>
                      {TIPO_DOCUMENTO_VEICULO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="outro">✏️ Outro (digitar)</option>
                    </select>
                    {novoDoc.tipoDoc==='outro' && (
                      <input value={novoDoc.tipoDocOutro} onChange={e=>setNovoDoc(p=>({...p,tipoDocOutro:e.target.value}))} placeholder="Descreva o tipo..." style={{ ...IS, fontSize:11 }}/>
                    )}
                    <input value={novoDoc.numero} onChange={e=>setNovoDoc(p=>({...p,numero:e.target.value}))} placeholder="Número (opcional)" style={{ ...IS, fontSize:11 }}/>
                    <input type="date" value={novoDoc.validade} onChange={e=>setNovoDoc(p=>({...p,validade:e.target.value}))} min={todayStr()} style={{ ...IS, fontSize:11 }}/>
                    <input type="file" onChange={e=>setNovoDoc(p=>({...p,_arquivo:e.target.files?.[0]||null}))} style={{ fontFamily:FONT, fontSize:10 }}/>
                    <div style={{ fontFamily:FONT, fontSize:9, color:T.textMuted }}>Foto: comprimida automaticamente. PDF: até ~700KB.</div>
                    <button onClick={handleAdicionarDocumento} disabled={uploading}
                      style={{ ...BS, background:uploading?T.textMuted:T.laranjaLight, color:uploading?'white':T.laranja, border:`1px solid ${T.laranja}30`, fontWeight:700, fontSize:11 }}>
                      {uploading ? '⏳ Processando arquivo...' : '+ Adicionar documento'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <ConfirmModal open={!!deleting} danger title="Excluir veículo"
        message={`Remove "${deleting?.placa}" permanentemente, junto com os documentos anexados. Não afeta serviços já registrados no calendário.`}
        confirmLabel="🗑 Excluir"
        onConfirm={async()=>{
          try {
            await onDelete(deleting.id)
            addToast('Veículo removido.', 'info')
            setForm(null)
          } catch (err) {
            console.error('Erro ao remover veículo:', err)
            addToast('Erro ao remover. Tente novamente.', 'error')
          } finally {
            setDeleting(null)
          }
        }}
        onCancel={()=>setDeleting(null)}/>
    </div>
  )
}
