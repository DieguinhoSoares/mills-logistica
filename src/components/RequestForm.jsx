// ============================================================
// RequestForm.jsx — Formulário compartilhado de solicitação
// Usado em: SolicitanteView e FrotasView (CardModal)
// Props:
//   simClients  — array do CSV
//   onSubmit    — função chamada com os dados do formulário
//   onClose     — fecha o modal
//   profile     — perfil do usuário logado
//   initialData — dados para reabertura/edição (opcional)
//   title       — título do modal (opcional)
//   submitLabel — texto do botão de envio (opcional)
// ============================================================
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, URGENCY_SLA, IS, LS, BS, SUBTYPES_NF } from '../lib/constants'
import { todayStr } from '../lib/utils'
import { ClientInput, MunicipioInput } from '../components/UI'

const SUBTYPES_EMBARQUE       = ['troca_tecnica','sinistro','garantia']
const SUBTYPES_OFICINA        = ['garantia']
const SUBTYPES_MAQUINA_RESERVA = ['troca_tecnica','sinistro','garantia']
// Rollout às vezes tem máquina de retorno (troca de fato), às vezes não (a
// máquina antiga já foi baixada/vendida antes, só entra a nova) — por isso
// não é nem obrigatório (como troca/garantia/sinistro) nem ausente, é uma
// pergunta explícita Sim/Não pro solicitante decidir.
const SUBTYPES_MAQUINA_RESERVA_OPCIONAL = ['rollout']
// Subtipos que não envolvem necessariamente uma máquina/frota específica
// (apoio operacional, transporte de peças sobressalentes, ou casos não previstos)
const SUBTYPES_SEM_FROTA      = ['apoio_operacional','frete_pecas','outros']

// Padrão esperado: 3 letras + 5 dígitos (ex: PCP01141, TES01693, EHS02621)
const PADRAO_FROTA = /^[A-Za-z]{3}\d{5}$/

function ChipInput({ label, placeholder, values, onChange, hint, validateFrota = false, onPendingChange }) {
  const [input, setInput]       = useState('')
  const [alertVal, setAlertVal] = useState(null) // valor fora do padrão aguardando confirmação

  // Avisa o formulário quando existe um valor "fora do padrão" esperando
  // confirmação — sem isso, o analista podia digitar uma 2ª/3ª máquina, ver
  // o aviso amarelo, seguir em frente sem clicar em "Sim, está correto", e
  // aquele número simplesmente NUNCA entrava na lista — sem erro nenhum.
  useEffect(() => { onPendingChange?.(alertVal !== null) }, [alertVal]) // eslint-disable-line react-hooks/exhaustive-deps

  const tryAdd = (raw) => {
    const v = raw.trim().toUpperCase()
    if (!v || values.includes(v)) { setInput(''); return }
    if (validateFrota && !PADRAO_FROTA.test(v)) {
      setAlertVal(v) // mostra o alerta — não adiciona ainda
    } else {
      onChange([...values, v]); setInput('')
    }
  }

  const confirmAdd = () => {
    if (alertVal) { onChange([...values, alertVal]); setAlertVal(null); setInput('') }
  }

  const remove = v => onChange(values.filter(x => x !== v))

  return (
    <div>
      <label style={LS}>{label}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'7px 10px', background:T.surfaceAlt,
        border:`1px solid ${T.border}`, borderRadius:T.r, minHeight:42 }}>
        {values.map(v => {
          const fora = validateFrota && !PADRAO_FROTA.test(v)
          return (
            <span key={v} style={{ display:'flex', alignItems:'center', gap:4,
              background: fora ? T.amarelo : T.verde,
              color: fora ? '#000' : 'white',
              borderRadius:20, padding:'2px 10px', fontSize:11, fontFamily:FONT, fontWeight:700,
              title: fora ? 'Padrão fora do esperado (XXX00000)' : '' }}>
              {fora && <span title="Padrão fora do esperado">⚠️</span>}
              {v}<span onClick={()=>remove(v)} style={{ cursor:'pointer', fontSize:14, lineHeight:1, opacity:0.8 }}>×</span>
            </span>
          )
        })}
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();tryAdd(input)}}}
          onBlur={()=>{ if(input.trim()) tryAdd(input) }}
          placeholder={values.length===0 ? placeholder : '+ adicionar'}
          style={{ border:'none', background:'transparent', outline:'none', fontSize:12, fontFamily:FONT, color:T.text, minWidth:120, flex:1 }}/>
      </div>
      {hint && <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginTop:3 }}>{hint}</div>}

      {/* Alerta de confirmação quando o padrão não bate */}
      {alertVal && (
        <div style={{ marginTop:8, padding:'10px 12px', background:T.amareloLight,
          borderRadius:T.rSm, border:`1px solid ${T.amarelo}80`,
          display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ color:T.textSec, fontFamily:FONT, fontSize:12, fontWeight:700 }}>
            ⚠️ Padrão fora do esperado
          </div>
          <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11 }}>
            O padrão de frota Mills é <strong>XXX00000</strong> (3 letras + 5 números).
            O valor informado <strong style={{ color:T.perigo }}>"{alertVal}"</strong> não segue esse formato.
          </div>
          <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11 }}>
            Tem certeza de que o número de frota <strong>"{alertVal}"</strong> está correto?
          </div>
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={confirmAdd}
              style={{ ...BS, background:T.amarelo, color:'#000', fontWeight:800, fontSize:11, padding:'6px 14px' }}>
              ✅ Sim, está correto
            </button>
            <button onClick={()=>{ setAlertVal(null); }}
              style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontWeight:700, fontSize:11, padding:'6px 14px' }}>
              ✏️ Corrigir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SubtypeSelect({ type, value, onChange, error }) {
  const options = CARD_SUBTYPES[type] || []
  if (!options.length) return null
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ ...LS, color: error ? T.perigo : T.textMuted }}>
        Motivo / Subtipo <span style={{ color:T.perigo }}>*</span>
      </label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:6 }}>
        {options.map(opt => (
          <div key={opt.value} onClick={()=>onChange(opt.value)}
            style={{ border:`2px solid ${value===opt.value?T.laranja:error?T.perigo+'60':T.border}`,
              borderRadius:T.rSm, padding:'7px 9px', cursor:'pointer',
              background:value===opt.value?T.laranjaLight:T.surface,
              transition:'all .12s', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:13 }}>{opt.label.split(' ')[0]}</span>
            <span style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:value===opt.value?800:500 }}>
              {opt.label.replace(/^[^\s]+\s/,'')}
            </span>
          </div>
        ))}
      </div>
      {error && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:4 }}>⚠ Selecione o motivo do serviço</div>}
    </div>
  )
}

export function RequestForm({ simClients, drivers, onSubmit, onClose, onDelete, profile, initialData, title, submitLabel, relatedRequest, onUseOriginalRequest }) {
  const blank = {
    type:'freteCliente', subtype:'', machine:'',
    nInternos:[], nInternosReserva:[], originCity:null, destCity:null,
    selectedClient:null, clientName:'', semCliente:false, localLivre:'',
    desiredDate:todayStr(), desiredDateEnd:todayStr(), urgency:'medio', om:'',
    description:'', channel:'teams',
    podeEmbarcar:null, destinoOficina:'',
    temMaquinaRetorno:null, // null=não perguntado, 'sim'/'nao' — só usado quando o subtipo tem retorno opcional (ex: Rollout)
    movimento:'saida', refOrigem:'',
    driverId:'', driverName:'', transportadoraNome:'', transportadoraCnpj:'',
    // Frete combinado (múltiplos clientes/paradas na mesma solicitação) — a
    // "Parada 1" continua sendo os campos de sempre (clientName/nInternos);
    // isto guarda só as paradas ADICIONAIS, mantendo o formulário idêntico
    // ao de hoje pra quem só tem 1 destino (a maioria dos casos).
    paradasExtras: [],
  }

  const initial = initialData ? {
    type:                 initialData.type||'freteCliente',
    subtype:              initialData.subtype||'',
    machine:              initialData.machine||'',
    nInternos:            initialData.nInternos||(initialData.nInterno?[initialData.nInterno]:[]),
    // originCity pode vir como string (card) ou objeto {m,s} (request) — normaliza para objeto
    originCity: (
      initialData.originCity && typeof initialData.originCity === 'object'
        ? initialData.originCity
        : initialData.originCity
          ? { m: initialData.originCity, s: initialData.origin||'' }
          : initialData.originCityName
            ? { m: initialData.originCityName, s: initialData.origin||'' }
            : null
    ),
    destCity: (
      initialData.destCity && typeof initialData.destCity === 'object'
        ? initialData.destCity
        : initialData.destCity
          ? { m: initialData.destCity, s: initialData.destination||'' }
          : initialData.destCityName
            ? { m: initialData.destCityName, s: initialData.destination||'' }
            : null
    ),
    selectedClient:       null,
    // clientName pode vir como 'client' ou 'plantaObra' (card) ou 'clientName' (request)
    clientName:           initialData.clientName||initialData.client||initialData.plantaObra||'',
    semCliente:           initialData.semCliente||false,
    localLivre:           initialData.semCliente ? (initialData.clientName||initialData.client||initialData.plantaObra||'') : '',
    // desiredDate pode vir como 'startDate' (card) ou 'desiredDate' (request)
    desiredDate:          initialData.desiredDate||initialData.startDate||todayStr(),
    desiredDateEnd:       initialData.desiredDateEnd||initialData.endDate||initialData.desiredDate||initialData.startDate||todayStr(),
    urgency:              initialData.urgency||'medio',
    description:          initialData.description||'',
    channel:              initialData.channel||'teams',
    podeEmbarcar:         initialData.podeEmbarcar||null,
    temMaquinaRetorno:    initialData.temMaquinaRetorno||null,
    destinoOficina:       initialData.destinoOficina||'',
    movimento:            initialData.movimento||'saida',
    refOrigem:            initialData.refOrigem||'',
    paradasExtras:        initialData.paradas?.slice(1)?.map(p=>({tipo:p.tipo,cidade:p.cidade,uf:p.uf,clientName:p.clientName||'',nInternos:p.nInternos||[]})) || [],
    cardOrigemId:         initialData.cardOrigemId||'',
    numeroNF:             initialData.numeroNF||'',
    nfConfirmada:         initialData.nfConfirmada||false,
    nfConfirmadaPor:      initialData.nfConfirmadaPor||'',
    nfConfirmadaEm:       initialData.nfConfirmadaEm||null,
    nInternosReserva:     initialData.nInternosReserva||[],
    om:                   initialData.om||'',
    driverId:             initialData.driverId||'',
    driverName:           initialData.driver||initialData.driverName||'',
    transportadoraNome:   initialData.transportadoraNome||'',
    transportadoraCnpj:   initialData.transportadoraCnpj||'',
  } : blank

  const [form,   setForm]   = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [step,   setStep]   = useState(1)
  // Rastreia, por campo, se há um N° interno "fora do padrão" esperando o
  // clique em "Sim, está correto" — enquanto pendente, esse valor NÃO está
  // na lista ainda. Bloqueamos avançar/enviar até resolver.
  const [chipsPendentes, setChipsPendentes] = useState({})
  const temChipPendente = Object.values(chipsPendentes).some(Boolean)
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:undefined})) }

  const needsNF             = SUBTYPES_NF.includes(form.subtype)
  const needsEmbarque       = SUBTYPES_EMBARQUE.includes(form.subtype)
  const needsOficina        = SUBTYPES_OFICINA.includes(form.subtype) && form.movimento==='saida'
  const needsMovimento      = SUBTYPES_EMBARQUE.includes(form.subtype)
  const needsMaquinaReserva = SUBTYPES_MAQUINA_RESERVA.includes(form.subtype)
  const retornoOpcional     = SUBTYPES_MAQUINA_RESERVA_OPCIONAL.includes(form.subtype)
  const mostraMaquinaReserva = needsMaquinaReserva || (retornoOpcional && form.temMaquinaRetorno === 'sim')
  const frotaOpcional       = SUBTYPES_SEM_FROTA.includes(form.subtype)
  const isCardEdit          = !!drivers && initialData?.driverId !== undefined

  const validate = () => {
    const e = {}
    if (!form.subtype)             e.subtype    = true
    if (form.semCliente) {
      if (!form.localLivre)        e.localLivre = true
    } else {
      if (!form.clientName)        e.clientName = true
    }
    if (!frotaOpcional && form.nInternos.length===0) e.nInternos  = true
    if (!form.originCity)          e.originCity = true
    if (!form.destCity)            e.destCity   = true
    if (needsMaquinaReserva && form.nInternosReserva.length===0) e.machine = true
    if (retornoOpcional) {
      if (form.temMaquinaRetorno===null) e.temMaquinaRetorno = true
      else if (form.temMaquinaRetorno==='sim' && form.nInternosReserva.length===0) e.machine = true
    }
    if (needsEmbarque && form.podeEmbarcar===null) e.podeEmbarcar   = true
    if (needsOficina  && !form.destinoOficina)     e.destinoOficina = true
    if (form.desiredDateEnd && form.desiredDateEnd < form.desiredDate) e.desiredDateEnd = true
    setErrors(e); return Object.keys(e).length===0
  }

  // Validação por passo do wizard — só bloqueia o avanço com os campos daquele passo
  const STEP_LABELS = ['Tipo', 'Cliente / Equipamento', 'Datas / Motorista', 'Observações']
  const validateStep = (n) => {
    const e = {}
    if (n === 1) {
      if (!form.subtype) e.subtype = true
    }
    if (n === 2) {
      if (form.semCliente) { if (!form.localLivre) e.localLivre = true }
      else                 { if (!form.clientName) e.clientName = true }
      if (!frotaOpcional && form.nInternos.length===0) e.nInternos = true
      if (needsMaquinaReserva && form.nInternosReserva.length===0) e.machine = true
      if (retornoOpcional) {
        if (form.temMaquinaRetorno===null) e.temMaquinaRetorno = true
        else if (form.temMaquinaRetorno==='sim' && form.nInternosReserva.length===0) e.machine = true
      }
      // Cada parada extra precisa de cidade + ao menos 1 máquina
      if (form.paradasExtras.some(p => !p.cidade || p.nInternos.length===0)) e.paradasExtras = true
      // Trava a saída do passo enquanto sobrar um N° interno "fora do padrão"
      // esperando confirmação — sem isso, esse número nunca entra na lista.
      if (temChipPendente) e._chipsPendentes = true
    }
    if (n === 3) {
      if (!form.originCity) e.originCity = true
      if (!form.destCity)   e.destCity   = true
      if (form.desiredDateEnd && form.desiredDateEnd < form.desiredDate) e.desiredDateEnd = true
      if (needsEmbarque && form.podeEmbarcar===null) e.podeEmbarcar   = true
      if (needsOficina  && !form.destinoOficina)     e.destinoOficina = true
    }
    setErrors(prev=>({ ...prev, ...e }))
    return Object.keys(e).length===0
  }
  const goNext = () => { if (validateStep(step)) setStep(s=>Math.min(4,s+1)) }
  const goBack = () => setStep(s=>Math.max(1,s-1))

  const handleSubmit = async () => {
    if (temChipPendente) { setErrors(p=>({...p,_chipsPendentes:true})); setStep(2); return }
    if (!validate()) return
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        clientName:           form.semCliente ? form.localLivre : form.clientName,
        nInterno:             form.nInternos.join(', '),
        nInternosReserva:     form.nInternosReserva,
        nInternosDanificados: ['troca_tecnica','sinistro','garantia'].includes(form.subtype) ? form.nInternos : [],
        nInternos:            form.nInternos,
        requesterName:        profile?.name||'',
        unit:                 profile?.unit||'',
        origin:               form.originCity?.s||'',
        destination:          form.destCity?.s||'',
        originCityName:       form.originCity?.m||'',
        destCityName:         form.destCity?.m||'',
        // Frete combinado: só grava o array `paradas` quando há paradas extras
        // de verdade — sem isso, a solicitação é salva EXATAMENTE como antes
        // (originCity/destCity/nInternos), sem quebrar nada que já lê esses
        // campos direto (AssignDriverModal, criação de card, etc.).
        ...(form.paradasExtras.length > 0 ? {
          paradas: [
            { tipo:'entrega', cidade:form.destCity?.m||'', uf:form.destCity?.s||'',
              clientName: form.semCliente ? form.localLivre : form.clientName, nInternos: form.nInternos },
            ...form.paradasExtras.map(p => ({ tipo:p.tipo, cidade:p.cidade, uf:p.uf, clientName:'', nInternos:p.nInternos })),
          ],
        } : {}),
        // Passa o id da request original pra submitRequest saber que é um reenvio (updateDoc)
        ...(initialData?.id ? { id: initialData.id, reaberturaDe: initialData.id } : {}),
      })
      onClose()
    } catch (err) {
      console.error('Erro ao enviar formulário:', err)
      setErrors(p=>({ ...p, _submit: 'Não foi possível enviar. Verifique sua conexão e tente novamente.' }))
    } finally {
      setSaving(false)
    }
  }

  const fieldErr = k => errors[k] ? <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Campo obrigatório</div> : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0, y:10 }} animate={{ scale:1, opacity:1, y:0 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:600, maxHeight:'94vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:900, fontSize:20, margin:0 }}>
              {title || (initialData ? '🔄 Ajustar Solicitação' : '➕ Solicitar Serviço')}
            </h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              {profile?.name && <><strong style={{ color:T.verde }}>{profile.name}</strong> · {profile.unit}</>}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {/* Indicador de progresso — 4 passos */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>
          {STEP_LABELS.map((label,i)=>{
            const n = i+1
            const done = n < step, active = n === step
            return (
              <div key={n} style={{ display:'flex', alignItems:'center', flex:n<4?1:'0 0 auto', gap:6 }}>
                <div onClick={()=>{ if (n < step) setStep(n) }}
                  style={{ display:'flex', alignItems:'center', gap:6, cursor: n<step?'pointer':'default' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background: done?T.verde:active?T.laranja:T.surfaceAlt,
                    border: `1px solid ${done?T.verde:active?T.laranja:T.border}`,
                    color: (done||active)?'white':T.textMuted, fontFamily:FONT, fontWeight:800, fontSize:11, flexShrink:0 }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ color: active?T.text:T.textMuted, fontFamily:FONT, fontWeight:active?700:500, fontSize:11, whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {n<4 && <div style={{ flex:1, height:2, background: n<step?T.verde:T.border, borderRadius:2 }}/>}
              </div>
            )
          })}
        </div>

        {/* Avisos críticos — sempre visíveis, independente do passo do wizard */}
        {relatedRequest && isCardEdit && !form._dismissRelated && (
          <div style={{ marginBottom:18, padding:'12px 14px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}60` }}>
            <div style={{ color:T.textSec, fontFamily:FONT, fontWeight:800, fontSize:13, marginBottom:6 }}>
              ⚠️ Existe uma solicitação pendente que parece ser este mesmo serviço
            </div>
            <div style={{ color:T.text, fontFamily:FONT, fontSize:12, marginBottom:3 }}>
              <strong>Solicitante:</strong> {relatedRequest.requesterName || '—'}
            </div>
            <div style={{ color:T.text, fontFamily:FONT, fontSize:12, marginBottom:3 }}>
              <strong>Pedido em:</strong> {relatedRequest.createdAt?.toDate ? relatedRequest.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}
              {' · '}<strong>Nº interno:</strong> {relatedRequest.nInterno || '—'}
            </div>
            {relatedRequest.description && (
              <div style={{ marginTop:6, padding:'8px 10px', background:T.surface, borderRadius:T.rSm, color:T.textSec, fontFamily:FONT, fontSize:11, fontStyle:'italic' }}>
                "{relatedRequest.description}"
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button onClick={()=>onUseOriginalRequest?.(relatedRequest, initialData.id)}
                style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11 }}>
                🔗 Usar a solicitação original
              </button>
              <button onClick={()=>set('_dismissRelated', true)}
                style={{ ...BS, background:'none', color:T.textMuted, border:`1px solid ${T.border}`, fontWeight:700, fontSize:11 }}>
                Não é a mesma coisa
              </button>
            </div>
          </div>
        )}

        {initialData?.status === 'cancelado' && isCardEdit && (
          <div style={{ marginBottom:18, padding:'12px 14px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:800, fontSize:13, marginBottom:4 }}>🚫 Este serviço está cancelado</div>
            {initialData.cancelReason && (
              <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11, marginBottom:8 }}>
                Motivo: <em>{initialData.cancelReason}</em>{initialData.cancelledBy ? ` — por ${initialData.cancelledBy}` : ''}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onDelete?.(initialData.id)}
                style={{ ...BS, background:T.perigo, color:'white', fontWeight:700, fontSize:11 }}>
                🗑 Remover da agenda
              </button>
              <button onClick={()=>onSubmit({ ...initialData, status:'em_dia', cancelReason:null, cancelledAt:null, cancelledBy:null })}
                style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontWeight:700, fontSize:11 }}>
                ♻️ Reabrir serviço
              </button>
            </div>
          </div>
        )}

        {initialData?.responseNote && step===1 && (
          <div style={{ marginBottom:14, padding:'10px 13px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}40` }}>
            <div style={{ color:'#B8860B', fontFamily:FONT, fontSize:11, fontWeight:700 }}>🔄 Reabertura — ajuste os campos necessários e envie novamente.</div>
            <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11, marginTop:4 }}>Motivo da recusa: <em>{initialData.responseNote}</em></div>
          </div>
        )}

        {step===1 && <>
        {/* Tipo de Serviço */}
        <div style={{ marginBottom:14 }}>
          <label style={LS}>Tipo de Serviço <span style={{ color:T.perigo }}>*</span></label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {Object.entries(CARD_TYPES).map(([k,v]) => (
              <div key={k} onClick={()=>{set('type',k);set('subtype','');set('podeEmbarcar',null);set('destinoOficina','');set('movimento','saida');set('refOrigem','')}}
                style={{ border:`2px solid ${form.type===k?v.color:T.border}`, borderRadius:T.r, padding:'10px 8px', cursor:'pointer', textAlign:'center', background:form.type===k?v.bg:T.surfaceAlt, transition:'all .12s' }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{v.icon}</div>
                <div style={{ color:v.color, fontWeight:800, fontSize:10, fontFamily:FONT }}>{v.short}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subtipo */}
        <SubtypeSelect type={form.type} value={form.subtype}
          onChange={v=>{set('subtype',v);set('podeEmbarcar',null);set('destinoOficina','');set('movimento','saida');set('refOrigem','');set('temMaquinaRetorno',null);if(v==='movimentacao')set('semCliente',true)}}
          error={errors.subtype}/>
        </>}

        {step===2 && <>
        {/* Planta/Obra — ou identificação livre quando não há cliente envolvido */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, cursor:'pointer' }}>
            <input type="checkbox" checked={form.semCliente}
              onChange={e=>{set('semCliente',e.target.checked); if(e.target.checked) set('clientName',''); else set('localLivre','')}}
              style={{ width:14, height:14, accentColor:T.laranja }}/>
            <span style={{ color:T.textSec, fontSize:11, fontFamily:FONT, fontWeight:600 }}>
              🏭 Operação sem cliente (transferência entre unidades Mills / fornecedor)
            </span>
          </label>

          {form.semCliente ? (
            <div style={{ padding:'11px 13px', background:T.laranjaXLight, borderRadius:T.r, border:`1px solid ${errors.localLivre?T.perigo:T.laranja}20` }}>
              <label style={{ ...LS, color:errors.localLivre?T.perigo:T.textMuted }}>
                📍 Identificação da operação <span style={{ color:T.perigo }}>*</span>
              </label>
              <input value={form.localLivre} onChange={e=>set('localLivre',e.target.value)}
                placeholder="Ex: Fornecedor Girotti, LLA Hidráulica, Mills Sumaré..." style={IS}/>
              <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginTop:4 }}>
                Use os campos "Cidade de Origem"/"Cidade de Destino" abaixo pra indicar de onde sai e pra onde vai.
              </div>
              {errors.localLivre && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Identifique a operação</div>}
            </div>
          ) : (
            <div style={{ padding:'11px 13px', background:T.laranjaXLight, borderRadius:T.r, border:`1px solid ${errors.clientName?T.perigo:T.laranja}20` }}>
              <label style={{ ...LS, color:errors.clientName?T.perigo:T.textMuted }}>
                🔍 Planta / Obra (base SIM) <span style={{ color:T.perigo }}>*</span>
              </label>
              <ClientInput value={form.clientName?{name:form.clientName}:null}
                onChange={c=>{set('clientName',c?.name||'');set('selectedClient',c||null);set('nInternos',[]);if(c?.state)set('destCity',{m:c.city||'',s:c.state})}}
                simClients={simClients||[]}/>
              {form.clientName && <div style={{ marginTop:4, color:T.verde, fontSize:11, fontFamily:FONT, fontWeight:700 }}>✓ {form.clientName}</div>}
              {fieldErr('clientName')}
            </div>
          )}
        </div>

        {/* N° Interno */}
        <div style={{ marginBottom:14 }}>
          <ChipInput
            label={<>{needsMaquinaReserva ? '🔧 N° Interno da Frota Danificada (que retorna)' : '📋 N° Interno (Frota)'} {frotaOpcional ? <span style={{ color:T.textMuted, fontWeight:600 }}>(opcional)</span> : <span style={{ color:T.perigo }}>*</span>}</>}
            placeholder={needsMaquinaReserva ? 'Ex: TES01234 — N° da frota danificada + Enter...' : 'Ex: PCP01234 — Digite e pressione Enter...'}
            values={form.nInternos} onChange={v=>set('nInternos',v)}
            validateFrota={true}
            onPendingChange={p=>setChipsPendentes(prev=>({...prev,nInternos:p}))}
            hint={form.selectedClient?.nInternos?.length>0?`${form.selectedClient.nInternos.length} frota(s) vinculada(s)`:'Pressione Enter ou vírgula para adicionar cada N° interno · Padrão: XXX00000'}/>
          {form.clientName && form.selectedClient?.nInternos?.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
              {form.selectedClient.nInternos.filter(n=>!form.nInternos.includes(n)).slice(0,8).map(n=>(
                <span key={n} onClick={()=>set('nInternos',[...form.nInternos,n])}
                  style={{ background:T.verdeLight, border:`1px solid ${T.verde}40`, borderRadius:20, padding:'2px 10px', fontSize:10, fontFamily:FONT, fontWeight:700, color:T.verde, cursor:'pointer' }}>+ {n}</span>
              ))}
            </div>
          )}
          {errors.nInternos && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Informe ao menos um N° interno</div>}
        </div>

        {/* Rollout: pergunta explícita — às vezes tem máquina de retorno, às vezes não */}
        {retornoOpcional && (
          <div style={{ marginBottom:14, padding:'12px 14px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${errors.temMaquinaRetorno?T.perigo:T.amarelo}40` }}>
            <label style={{ ...LS, color:errors.temMaquinaRetorno?T.perigo:'#B8860B' }}>
              🔁 Este rollout tem máquina de retorno (troca de verdade)? <span style={{ color:T.perigo }}>*</span>
            </label>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              {[['sim','🔄 Sim, tem máquina voltando'],['nao','➡️ Não, só entra a nova']].map(([v,l])=>(
                <div key={v} onClick={()=>set('temMaquinaRetorno',v)}
                  style={{ flex:1, border:`2px solid ${form.temMaquinaRetorno===v?T.laranja:T.border}`, borderRadius:T.r, padding:'8px 12px', cursor:'pointer', textAlign:'center', background:form.temMaquinaRetorno===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:form.temMaquinaRetorno===v?800:500 }}>{l}</div>
                </div>
              ))}
            </div>
            {errors.temMaquinaRetorno && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:4 }}>⚠ Informe se há máquina de retorno</div>}
          </div>
        )}

        {/* Equipamento Reserva */}
        {mostraMaquinaReserva && (
          <div style={{ marginBottom:14 }}>
            <ChipInput
              label={<>🚜 N° Interno(s) do Equipamento Reserva <span style={{ color:T.perigo }}>*</span></>}
              placeholder="Ex: TES01234 — N° interno da reserva + Enter..."
              values={form.nInternosReserva}
              onChange={v=>set('nInternosReserva',v)}
              validateFrota={true}
              onPendingChange={p=>setChipsPendentes(prev=>({...prev,nInternosReserva:p}))}
              hint="Informe o(s) N° interno(s) da(s) máquina(s) que será(ão) enviada(s) ao cliente · Padrão: XXX00000"/>
            {errors.machine && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Informe ao menos um equipamento reserva</div>}
          </div>
        )}

        {/* Aviso múltiplas máquinas */}
        {mostraMaquinaReserva && form.nInternosReserva.length > 1 && (
          <div style={{ marginBottom:14, padding:'10px 13px', background:'#FFF3E0', borderRadius:T.r, border:`1px solid #E65100` }}>
            <div style={{ color:'#E65100', fontFamily:FONT, fontSize:11, fontWeight:700 }}>
              ⚠️ Solicitação contém mais de 1 máquina — será utilizada a Prancha 3 eixos.
            </div>
          </div>
        )}

        {/* Frete combinado — paradas extras (múltiplos clientes na mesma solicitação).
            Não aparece pra troca/garantia/sinistro, que já tem sua própria semântica
            de ida/volta (Equipamento Reserva acima) — misturar os dois conceitos
            geraria ambiguidade sobre o que é "reserva" e o que é "próxima parada". */}
        {!needsMaquinaReserva && (
          <div style={{ marginBottom:14 }}>
            {form.paradasExtras.map((p, i) => (
              <div key={i} style={{ marginBottom:10, padding:'11px 13px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ color:T.textSec, fontFamily:FONT, fontWeight:800, fontSize:11 }}>📍 Parada {i+2}</span>
                  <button onClick={()=>set('paradasExtras', form.paradasExtras.filter((_,j)=>j!==i))}
                    style={{ background:'none', border:'none', color:T.perigo, fontSize:11, fontFamily:FONT, fontWeight:700, cursor:'pointer' }}>
                    🗑 Remover
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:8, marginBottom:8 }}>
                  <select value={p.tipo} onChange={e=>{const arr=[...form.paradasExtras];arr[i]={...arr[i],tipo:e.target.value};set('paradasExtras',arr)}} style={IS}>
                    <option value="entrega">📤 Entregar</option>
                    <option value="coleta">📥 Coletar</option>
                    <option value="preparacao">🔧 Preparação</option>
                  </select>
                  <MunicipioInput value={p.cidade?{m:p.cidade,s:p.uf}:null}
                    onChange={v=>{const arr=[...form.paradasExtras];arr[i]={...arr[i],cidade:v?.m||'',uf:v?.s||''};set('paradasExtras',arr)}}
                    placeholder="Cidade da parada..."/>
                </div>
                <ChipInput label="N° Interno da(s) máquina(s) desta parada" placeholder="Digite e pressione Enter..."
                  values={p.nInternos} onChange={v=>{const arr=[...form.paradasExtras];arr[i]={...arr[i],nInternos:v};set('paradasExtras',arr)}}
                  validateFrota={true} onPendingChange={pend=>setChipsPendentes(prev=>({...prev,[`parada${i}`]:pend}))}/>
              </div>
            ))}
            {form.paradasExtras.length < 4 ? (
              <button onClick={()=>set('paradasExtras',[...form.paradasExtras,{tipo:'entrega',cidade:'',uf:'',nInternos:[]}])}
                style={{ background:'none', border:'none', color:T.laranja, fontFamily:FONT, fontWeight:700, fontSize:12, cursor:'pointer', padding:0 }}>
                ➕ Adicionar parada
              </button>
            ) : (
              <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>Limite de 5 paradas por solicitação.</div>
            )}
          </div>
        )}
        </>}

        {step===3 && <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          {/* Urgência */}
          <div>
            <label style={LS}>Urgência <span style={{ color:T.perigo }}>*</span></label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=>(
                <option key={k} value={k}>{v.icon} {v.label} ({URGENCY_SLA[k]})</option>
              ))}
            </select>
          </div>

          {/* Nº OM Manusis */}
          <div>
            <label style={LS}>🔧 Nº OM Manusis</label>
            <input value={form.om||''} onChange={e=>set('om',e.target.value)}
              placeholder="Nº da Ordem de Manutenção..." style={IS}/>
          </div>

          {/* Cidades */}
          <div>
            <label style={{ ...LS, color:errors.originCity?T.perigo:T.textMuted }}>
              Cidade de Origem <span style={{ color:T.perigo }}>*</span>
            </label>
            <MunicipioInput value={form.originCity} onChange={v=>set('originCity',v)} placeholder="Cidade de origem..."/>
            {fieldErr('originCity')}
          </div>
          <div>
            <label style={{ ...LS, color:errors.destCity?T.perigo:T.textMuted }}>
              Cidade de Destino <span style={{ color:T.perigo }}>*</span>
            </label>
            <MunicipioInput value={form.destCity} onChange={v=>set('destCity',v)} placeholder="Cidade de destino..."/>
            {fieldErr('destCity')}
          </div>

          {/* Datas e canal */}
          <div>
            <label style={LS}>Data início <span style={{ color:T.perigo }}>*</span></label>
            <input type="date" value={form.desiredDate} onChange={e=>{
              const v=e.target.value; set('desiredDate',v)
              // Se a data fim estava igual à antiga data início (ou vazia), acompanha — atividade ainda é de 1 dia
              if(!form.desiredDateEnd || form.desiredDateEnd===form.desiredDate) set('desiredDateEnd',v)
            }} style={IS}/>
          </div>
          <div>
            <label style={{ ...LS, color:errors.desiredDateEnd?T.perigo:T.textMuted }}>Data fim <span style={{ color:T.textMuted, fontWeight:600 }}>(se mais de 1 dia)</span></label>
            <input type="date" value={form.desiredDateEnd||form.desiredDate} min={form.desiredDate} onChange={e=>set('desiredDateEnd',e.target.value)} style={IS}/>
            {fieldErr('desiredDateEnd')}
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Canal de resposta</label>
            <select value={form.channel} onChange={e=>set('channel',e.target.value)} style={IS}>
              <option value="teams">🟦 Microsoft Teams</option>
              <option value="email">📧 E-mail</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>
          </div>
        </div>

        {/* Campos condicionais */}
        <AnimatePresence>
          {needsMovimento && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              style={{ marginBottom:14, padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
              <label style={LS}>🔁 Esse serviço é a ida ou o retorno da máquina?</label>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                {[['saida','📤 Saída — máquina titular sai do contrato?'],['retorno','📥 Retorno — máquina titular volta para o contrato?']].map(([v,l])=>(
                  <div key={v} onClick={()=>set('movimento',v)}
                    style={{ flex:1, border:`2px solid ${form.movimento===v?T.laranja:T.border}`, borderRadius:T.r, padding:'8px 12px', cursor:'pointer', textAlign:'center', background:form.movimento===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                    <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:form.movimento===v?800:500 }}>{l}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {needsMovimento && form.movimento==='retorno' && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              style={{ marginBottom:14 }}>
              <label style={LS}>Nº de referência do atendimento original (se souber)</label>
              <input value={form.refOrigem||''} onChange={e=>set('refOrigem', e.target.value)}
                placeholder="Ex: #482 — ou deixe em branco se não souber" style={IS}/>
              <p style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, margin:'6px 0 0', lineHeight:1.5 }}>
                Esse número aparece no card que a Frotas te passou quando a reserva saiu. Se não tiver à mão, sem problema —
                a equipe de Frotas faz o vínculo na hora de processar.
              </p>
            </motion.div>
          )}
          {needsEmbarque && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              style={{ marginBottom:14, padding:'12px 14px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${errors.podeEmbarcar?T.perigo:T.amarelo}40` }}>
              <label style={{ ...LS, color:errors.podeEmbarcar?T.perigo:'#B8860B' }}>
                🚚 A máquina danificada pode ser embarcada normalmente na prancha? <span style={{ color:T.perigo }}>*</span>
              </label>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                {[['sim','✅ Sim, pode embarcar normalmente'],['nao','⚠️ Não — requer equipamento especial']].map(([v,l])=>(
                  <div key={v} onClick={()=>set('podeEmbarcar',v)}
                    style={{ flex:1, border:`2px solid ${form.podeEmbarcar===v?T.laranja:T.border}`, borderRadius:T.r, padding:'8px 12px', cursor:'pointer', textAlign:'center', background:form.podeEmbarcar===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                    <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:form.podeEmbarcar===v?800:500 }}>{l}</div>
                  </div>
                ))}
              </div>
              {errors.podeEmbarcar && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:4 }}>⚠ Informe se a máquina pode ser embarcada normalmente</div>}
            </motion.div>
          )}
          {needsOficina && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
              style={{ marginBottom:14, padding:'12px 14px', background:T.infoLight, borderRadius:T.r, border:`1px solid ${errors.destinoOficina?T.perigo:T.info}40` }}>
              <label style={{ ...LS, color:errors.destinoOficina?T.perigo:T.info }}>
                🔧 Destino da máquina em garantia <span style={{ color:T.perigo }}>*</span>
              </label>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                {[['mills','🏭 Oficina Mills'],['concessionaria','🏢 Concessionária']].map(([v,l])=>(
                  <div key={v} onClick={()=>set('destinoOficina',v)}
                    style={{ flex:1, border:`2px solid ${form.destinoOficina===v?T.info:T.border}`, borderRadius:T.r, padding:'8px 12px', cursor:'pointer', textAlign:'center', background:form.destinoOficina===v?T.infoLight:T.surface, transition:'all .12s' }}>
                    <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:form.destinoOficina===v?800:500 }}>{l}</div>
                  </div>
                ))}
              </div>
              {errors.destinoOficina && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:4 }}>⚠ Informe o destino da máquina</div>}
            </motion.div>
          )}
          {isCardEdit && needsNF && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} style={{ marginBottom:14 }}>
              {form.nfConfirmada ? (
                <div style={{ marginTop:8, padding:'10px 13px', background:T.sucessoLight, borderRadius:T.r, border:`1px solid ${T.sucesso}40`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:T.sucesso, fontFamily:FONT, fontWeight:700, fontSize:12 }}>✅ NF {form.numeroNF||'—'} confirmada</div>
                    <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10, marginTop:2 }}>
                      Por {form.nfConfirmadaPor || '—'}{form.nfConfirmadaEm ? ` · ${new Date(form.nfConfirmadaEm).toLocaleString('pt-BR')}` : ''}
                    </div>
                  </div>
                  <button onClick={()=>{ set('nfConfirmada',false); set('nfConfirmadaPor',''); set('nfConfirmadaEm',null) }}
                    style={{ background:'none', border:'none', color:T.textMuted, fontSize:10, fontFamily:FONT, cursor:'pointer', textDecoration:'underline' }}>
                    desfazer
                  </button>
                </div>
              ) : (
                <div style={{ marginTop:8, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
                  <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:8 }}>
                    ⚠ NF ainda não confirmada — o serviço não pode ser encerrado sem essa confirmação
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={form.numeroNF||''} onChange={e=>set('numeroNF',e.target.value)}
                      placeholder="Nº da NF..." style={{ ...IS, fontSize:12 }}/>
                    <button onClick={()=>{
                        if (!(form.numeroNF||'').trim()) return
                        set('nfConfirmada', true)
                        set('nfConfirmadaPor', profile?.name || 'Frotas')
                        set('nfConfirmadaEm', new Date().toISOString())
                      }}
                      disabled={!(form.numeroNF||'').trim()}
                      style={{ ...BS, background:(form.numeroNF||'').trim()?T.perigo:T.borderMid, color:'white', fontWeight:700, fontSize:11, whiteSpace:'nowrap', cursor:(form.numeroNF||'').trim()?'pointer':'not-allowed' }}>
                      ✅ Confirmar NF emitida
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reatribuição de motorista/transportadora — visível apenas quando Frotas edita um card já criado */}
        {isCardEdit && (
          <div style={{ marginBottom:18, padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
            <label style={LS}>👤 Motorista / Transportadora responsável</label>
            <div style={{ display:'flex', gap:8, marginBottom:8, marginTop:4 }}>
              {[['motorista','👤 Motorista Mills'],['transportadora','🚚 Transportadora Externa']].map(([v,l])=>{
                const ativo = v==='transportadora' ? !!form.transportadoraNome && !form.driverId : !!form.driverId || (!form.transportadoraNome)
                return (
                  <div key={v} onClick={()=>{
                      if(v==='transportadora') set('driverId','')
                      else set('transportadoraNome','')
                    }}
                    style={{ flex:1, border:`2px solid ${ativo?T.laranja:T.border}`, borderRadius:T.rSm, padding:'7px 10px', cursor:'pointer', textAlign:'center', background:ativo?T.laranjaLight:T.surface }}>
                    <div style={{ color:T.text, fontFamily:FONT, fontSize:11, fontWeight:ativo?800:500 }}>{l}</div>
                  </div>
                )
              })}
            </div>
            {!form.transportadoraNome ? (
              <select value={form.driverId} onChange={e=>{
                  const d=(drivers||[]).find(x=>x.id===e.target.value)
                  set('driverId',e.target.value); set('driverName',d?.name||''); set('transportadoraNome','')
                }} style={IS}>
                <option value="">— selecione o motorista —</option>
                {(drivers||[]).filter(d=>d.active!==false).map(d=>(<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input value={form.transportadoraNome} onChange={e=>set('transportadoraNome',e.target.value)} placeholder="Nome da transportadora" style={IS}/>
                <input value={form.transportadoraCnpj} onChange={e=>set('transportadoraCnpj',e.target.value)} placeholder="CNPJ" style={IS}/>
              </div>
            )}
          </div>
        )}
        </>}

        {step===4 && <>
        

        {/* Descrição */}
        <div style={{ marginBottom:18 }}>
          <label style={LS}>Descrição / Detalhes</label>
          <textarea value={form.description} onChange={e=>set('description',e.target.value)}
            style={{ ...IS, height:70, resize:'vertical' }} placeholder="Descreva a operação, prazos, contato no local..."/>
        </div>

        </>}

        {errors._chipsPendentes && (
          <div style={{ marginBottom:12, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>⚠ Tem um N° interno "fora do padrão" esperando confirmação — clique em "Sim, está correto" ou "Corrigir" antes de continuar.</div>
          </div>
        )}
        {Object.keys(errors).filter(k=>k!=='_submit'&&k!=='_chipsPendentes'&&errors[k]).length>0 && (
          <div style={{ marginBottom:12, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>⚠ Preencha todos os campos obrigatórios antes de {step<4?'avançar':'enviar'}.</div>
          </div>
        )}
        {errors._submit && (
          <div style={{ marginBottom:12, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>⚠ {errors._submit}</div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
          <div>
            {step > 1 && (
              <button onClick={goBack} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>← Voltar</button>
            )}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
            {step < 4 ? (
              <button onClick={goNext} style={{ ...BS, background:T.laranja, color:'white', fontWeight:900, fontSize:13 }}>
                Avançar →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:900, fontSize:13 }}>
                {saving ? '⏳ Salvando...' : (submitLabel || (initialData ? '🔄 Reenviar Solicitação' : '📤 Enviar Solicitação'))}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
