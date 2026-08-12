// ============================================================
// NfRequestsPanel — aba "Solicitação de NF" (FrotasView, exclusivo Frotas).
// Histórico de solicitações de Nota Fiscal vinculado aos cards que exigem NF
// (SUBTYPES_NF), com lembrete pros que ainda não têm nenhuma solicitação
// registrada. Ver nfStatusForCard (utils.js) pra regra dos 3 estados.
// ============================================================
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS, NF_STATUS, SUBTYPES_NF } from '../lib/constants'
import { fmt, todayStr, getSubtypeLabel, nfStatusForCard } from '../lib/utils'
import { SapClientsUploadModal } from './SapClientsUploadModal'

const STATUS_OPTIONS = [
  ['solicitada', '📤 Solicitada'],
  ['emitida',    '✅ Emitida'],
  ['cancelada',  '🚫 Cancelada'],
]

function blankForm(card) {
  return {
    id: null,
    cardId: card?.id || '',
    dataSolicitacao: todayStr(),
    nInterno: card?.nInterno || (card?.nInternos||[])[0] || '',
    origem: card?.originCity || card?.origin || '',
    clienteDestino: '', cnpjDestino: '', codSapDestino: '',
    transportadora: card?.transportadoraNome || '',
    codSapTransporte: '',
    status: 'solicitada',
    numeroNF: '',
    motivo: card ? getSubtypeLabel(card.type, card.subtype) : '',
    motorista: card?.driver || '',
    horimetro: '', valor: '',
    obs: '',
  }
}

function StatusPill({ status }) {
  const meta = NF_STATUS[status] || NF_STATUS.pendente
  return (
    <span style={{ background:meta.bg, color:meta.color, borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700, fontFamily:FONT, whiteSpace:'nowrap' }}>
      {meta.label}
    </span>
  )
}

export function NfRequestsPanel({ cards, nfRequests, sapClients, sapClientsError, saveNfRequest, saveCard, uploadSapClients, profile, addToast }) {
  const [form, setForm] = useState(null) // null = fechado; objeto = form aberto (novo ou edição)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [clienteQuery, setClienteQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const cardsQueExigemNF = useMemo(() =>
    cards.filter(c => SUBTYPES_NF.includes(c.subtype) && c.status !== 'cancelado')
      .sort((a,b) => (b.startDate||'').localeCompare(a.startDate||'')),
  [cards])

  const pendentes = useMemo(() =>
    cardsQueExigemNF.filter(c => nfStatusForCard(c, nfRequests) === 'pendente'),
  [cardsQueExigemNF, nfRequests])

  const registros = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return nfRequests
    return nfRequests.filter(r => [r.clienteDestino, r.nInterno, r.numeroNF, r.motorista, r.transportadora]
      .some(v => String(v||'').toLowerCase().includes(q)))
  }, [nfRequests, busca])

  const clientesFiltrados = useMemo(() => {
    const q = clienteQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return sapClients.filter(c => c.nome.toLowerCase().includes(q) || c.cnpj.includes(q)).slice(0,6)
  }, [sapClients, clienteQuery])

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const abrirParaCard = card => { setForm(blankForm(card)); setClienteQuery('') }
  const abrirNova     = () => { setForm(blankForm(null)); setClienteQuery('') }
  const abrirEdicao   = reg => { setForm({ ...blankForm(null), ...reg }); setClienteQuery(reg.clienteDestino||'') }

  const escolherCard = cardId => {
    const card = cards.find(c=>c.id===cardId)
    if (!card) { set('cardId',''); return }
    setForm(p => ({
      ...p, cardId,
      nInterno:        p.nInterno        || card.nInterno || (card.nInternos||[])[0] || '',
      origem:           p.origem          || card.originCity || card.origin || '',
      motivo:           p.motivo          || getSubtypeLabel(card.type, card.subtype),
      motorista:        p.motorista       || card.driver || '',
      transportadora:   p.transportadora  || card.transportadoraNome || '',
    }))
  }

  const escolherCliente = c => {
    set('clienteDestino', c.nome)
    set('cnpjDestino', c.cnpj)
    set('codSapDestino', c.codigoSap)
    setClienteQuery(c.nome)
  }

  const handleSalvar = async () => {
    if (!form.dataSolicitacao) { addToast('Informe a data da solicitação.', 'error'); return }
    if (form.status === 'emitida' && !form.numeroNF.trim()) { addToast('Informe o número da NF para marcar como emitida.', 'error'); return }
    setSaving(true)
    try {
      await saveNfRequest({ ...form, createdBy: form.createdBy || profile?.name || 'Frotas' })
      // Sincroniza com o card legado — mantém o gate de fechamento do serviço
      // (ValidacaoModal/RequestForm) funcionando sem duplicar a fonte da verdade.
      if (form.cardId && form.status === 'emitida') {
        const card = cards.find(c=>c.id===form.cardId)
        if (card) await saveCard({ ...card, numeroNF:form.numeroNF, nfConfirmada:true, nfConfirmadaPor:profile?.name||'Frotas', nfConfirmadaEm:new Date().toISOString() })
      }
      addToast(form.id ? '✅ Solicitação atualizada!' : '✅ Solicitação registrada!', 'success')
      setForm(null)
    } catch (err) {
      console.error('Erro ao salvar solicitação de NF:', err)
      addToast('Erro ao salvar. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'18px 22px', display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:16, margin:0 }}>📄 Solicitação de NF</h2>
          <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, marginTop:2 }}>
            {sapClients.length>0 ? `${sapClients.length} cliente(s) no cadastro SAP` : 'Cadastro de Clientes SAP ainda não carregado'}
            {sapClientsError && <span style={{ color:T.perigo }}> · ⚠️ erro ao carregar cadastro</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setUploadOpen(true)} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>🏢 Atualizar Clientes SAP</button>
          <button onClick={abrirNova} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11 }}>+ Nova solicitação</button>
        </div>
      </div>

      {/* Pendentes — cards que exigem NF sem NENHUMA solicitação registrada */}
      {pendentes.length > 0 && (
        <div style={{ background:NF_STATUS.pendente.bg, border:`1px solid ${NF_STATUS.pendente.color}30`, borderRadius:T.r, padding:14 }}>
          <div style={{ color:NF_STATUS.pendente.color, fontFamily:FONT, fontWeight:800, fontSize:12, marginBottom:10 }}>
            ⚠️ {pendentes.length} serviço(s) exigem NF e ainda não têm solicitação registrada
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {pendentes.map(c => (
              <div key={c.id} style={{ background:T.surface, borderRadius:T.rSm, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:12 }}>{c.client||'—'} <span style={{ color:T.textMuted, fontWeight:500 }}>· {getSubtypeLabel(c.type,c.subtype)}</span></div>
                  <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>🔧 {c.nInterno||'—'} · 📅 {fmt(c.startDate)} · {c.originCity||c.origin||'—'} → {c.destCity||c.destination||'—'}</div>
                </div>
                <button onClick={()=>abrirParaCard(c)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontSize:10, padding:'5px 10px', whiteSpace:'nowrap' }}>➕ Registrar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solicitações registradas */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:13, margin:0 }}>Solicitações registradas ({registros.length})</h3>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar por cliente, frota, motorista, nº NF..." style={{ ...IS, width:280, fontSize:11 }}/>
        </div>
        {registros.length === 0 ? (
          <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center', padding:'24px 0' }}>Nenhuma solicitação registrada ainda.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {registros.map(r => (
              <div key={r.id} onClick={()=>abrirEdicao(r)}
                style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rSm, padding:'9px 13px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, cursor:'pointer' }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:12 }}>
                    {r.clienteDestino||'Cliente não informado'} <span style={{ color:T.textMuted, fontWeight:500 }}>· {r.motivo||'—'}</span>
                  </div>
                  <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>
                    🔧 {r.nInterno||'—'} · 📅 {fmt(r.dataSolicitacao)} · 🚚 {r.transportadora||'—'}{r.numeroNF?` · NF ${r.numeroNF}`:''}
                  </div>
                </div>
                <StatusPill status={r.status}/>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form (nova solicitação / edição) */}
      {form && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={e=>e.target===e.currentTarget && !saving && setForm(null)}>
          <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:560, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:16, margin:0 }}>{form.id ? '✏️ Editar solicitação' : '➕ Nova solicitação de NF'}</h3>
              <button onClick={()=>setForm(null)} disabled={saving} style={{ background:'none', border:'none', color:T.textMuted, fontSize:22, cursor:saving?'default':'pointer', lineHeight:1 }}>×</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={LS}>Card vinculado</label>
              <select value={form.cardId} onChange={e=>escolherCard(e.target.value)} style={IS}>
                <option value="">— nenhum (solicitação avulsa) —</option>
                {cardsQueExigemNF.map(c => (
                  <option key={c.id} value={c.id}>#{c.seqId||'—'} · {c.client||'—'} · {getSubtypeLabel(c.type,c.subtype)} · {fmt(c.startDate)}</option>
                ))}
              </select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={LS}>Data da solicitação *</label><input type="date" value={form.dataSolicitacao} onChange={e=>set('dataSolicitacao',e.target.value)} style={IS}/></div>
              <div><label style={LS}>Frota (nº interno)</label><input value={form.nInterno} onChange={e=>set('nInterno',e.target.value)} style={IS}/></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={LS}>Origem</label><input value={form.origem} onChange={e=>set('origem',e.target.value)} style={IS}/></div>
              <div><label style={LS}>Motivo</label><input value={form.motivo} onChange={e=>set('motivo',e.target.value)} style={IS}/></div>
            </div>

            <div style={{ marginBottom:12, position:'relative' }}>
              <label style={LS}>Cliente / CNPJ destino</label>
              <input value={clienteQuery} onChange={e=>{ setClienteQuery(e.target.value); set('clienteDestino', e.target.value) }}
                placeholder="Buscar no cadastro SAP por nome ou CNPJ..." style={IS}/>
              {clientesFiltrados.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rSm, boxShadow:T.shadowMd, zIndex:10, marginTop:2, maxHeight:180, overflowY:'auto' }}>
                  {clientesFiltrados.map((c,i) => (
                    <div key={i} onClick={()=>escolherCliente(c)}
                      style={{ padding:'7px 11px', cursor:'pointer', fontFamily:FONT, fontSize:11, borderBottom:i<clientesFiltrados.length-1?`1px solid ${T.border}`:'none' }}>
                      <div style={{ color:T.text, fontWeight:700 }}>{c.nome}</div>
                      <div style={{ color:T.textMuted, fontSize:10 }}>CNPJ {c.cnpj||'—'} {c.codigoSap && `· SAP ${c.codigoSap}`}</div>
                    </div>
                  ))}
                </div>
              )}
              {(form.cnpjDestino || form.codSapDestino) && (
                <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10, marginTop:4 }}>CNPJ {form.cnpjDestino||'—'} · Cód. SAP {form.codSapDestino||'—'}</div>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={LS}>Transportadora</label><input value={form.transportadora} onChange={e=>set('transportadora',e.target.value)} style={IS}/></div>
              <div><label style={LS}>Motorista</label><input value={form.motorista} onChange={e=>set('motorista',e.target.value)} style={IS}/></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={LS}>Horímetro (opcional)</label><input value={form.horimetro} onChange={e=>set('horimetro',e.target.value)} style={IS}/></div>
              <div><label style={LS}>Valor (opcional)</label><input value={form.valor} onChange={e=>set('valor',e.target.value)} placeholder="R$" style={IS}/></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={LS}>Status</label>
                <select value={form.status} onChange={e=>set('status',e.target.value)} style={IS}>
                  {STATUS_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Nº da NF {form.status==='emitida' && <span style={{ color:T.perigo }}>*</span>}</label>
                <input value={form.numeroNF} onChange={e=>set('numeroNF',e.target.value)} placeholder="Nº da NF..." style={IS}/>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={LS}>Observação</label>
              <input value={form.obs} onChange={e=>set('obs',e.target.value)} style={IS}/>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setForm(null)} disabled={saving} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving} style={{ ...BS, flex:2, background:saving?T.textMuted:T.laranja, color:'white', fontWeight:700 }}>
                {saving ? '⏳ Salvando...' : '💾 Salvar solicitação'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {uploadOpen && (
        <SapClientsUploadModal
          onLoaded={async clients => { await uploadSapClients(clients); addToast(`✅ ${clients.length} clientes SAP atualizados!`, 'success') }}
          onClose={()=>setUploadOpen(false)}
        />
      )}
    </div>
  )
}
