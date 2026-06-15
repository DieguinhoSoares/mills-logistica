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
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, IS, LS, BS } from '../lib/constants'
import { todayStr } from '../lib/utils'
import { ClientInput, MunicipioInput } from '../components/UI'

const URGENCY_SLA = { critico:'até 4h', alto:'até 24h', medio:'até 3 dias', baixo:'até 7 dias' }
const SUBTYPES_NF             = ['desmobilizacao','rollout','quebra_contrato','troca_tecnica','sinistro','garantia']
const SUBTYPES_EMBARQUE       = ['troca_tecnica','sinistro','garantia']
const SUBTYPES_OFICINA        = ['garantia']
const SUBTYPES_MAQUINA_RESERVA = ['troca_tecnica','sinistro','garantia']

function ChipInput({ label, placeholder, values, onChange, hint }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v]); setInput('')
  }
  const remove = v => onChange(values.filter(x => x !== v))
  return (
    <div>
      <label style={LS}>{label}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'7px 10px', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, minHeight:42 }}>
        {values.map(v => (
          <span key={v} style={{ display:'flex', alignItems:'center', gap:4, background:T.verde, color:'white', borderRadius:20, padding:'2px 10px', fontSize:11, fontFamily:FONT, fontWeight:700 }}>
            {v}<span onClick={()=>remove(v)} style={{ cursor:'pointer', fontSize:14, lineHeight:1, opacity:0.8 }}>×</span>
          </span>
        ))}
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add()}}}
          placeholder={values.length===0?placeholder:'+ adicionar'}
          style={{ border:'none', background:'transparent', outline:'none', fontSize:12, fontFamily:FONT, color:T.text, minWidth:120, flex:1 }}/>
      </div>
      {hint && <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginTop:3 }}>{hint}</div>}
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

export function RequestForm({ simClients, onSubmit, onClose, profile, initialData, title, submitLabel }) {
  const blank = {
    type:'freteCliente', subtype:'', machine:'',
    nInternos:[], nInternosReserva:[], originCity:null, destCity:null,
    selectedClient:null, clientName:'',
    desiredDate:todayStr(), urgency:'medio', om:'',
    description:'', channel:'teams',
    podeEmbarcar:null, destinoOficina:'', nfsRetorno:[],
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
    // desiredDate pode vir como 'startDate' (card) ou 'desiredDate' (request)
    desiredDate:          initialData.desiredDate||initialData.startDate||todayStr(),
    urgency:              initialData.urgency||'medio',
    description:          initialData.description||'',
    channel:              initialData.channel||'teams',
    podeEmbarcar:         initialData.podeEmbarcar||null,
    destinoOficina:       initialData.destinoOficina||'',
    nfsRetorno:           initialData.nfsRetorno||[],
    nInternosReserva:     initialData.nInternosReserva||[],
    om:                   initialData.om||'',
  } : blank

  const [form,   setForm]   = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:undefined})) }

  const needsNF             = SUBTYPES_NF.includes(form.subtype)
  const needsEmbarque       = SUBTYPES_EMBARQUE.includes(form.subtype)
  const needsOficina        = SUBTYPES_OFICINA.includes(form.subtype)
  const needsMaquinaReserva = SUBTYPES_MAQUINA_RESERVA.includes(form.subtype)

  const validate = () => {
    const e = {}
    if (!form.subtype)             e.subtype    = true
    if (!form.clientName)          e.clientName = true
    if (form.nInternos.length===0) e.nInternos  = true
    if (!form.originCity)          e.originCity = true
    if (!form.destCity)            e.destCity   = true
    if (needsMaquinaReserva && form.nInternosReserva.length===0) e.machine = true
    if (needsEmbarque && form.podeEmbarcar===null) e.podeEmbarcar   = true
    if (needsOficina  && !form.destinoOficina)     e.destinoOficina = true
    setErrors(e); return Object.keys(e).length===0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    await onSubmit({
      ...form,
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
      ...(initialData?{reaberturaDe:initialData.id}:{}),
    })
    setSaving(false); onClose()
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

        {initialData?.responseNote && (
          <div style={{ marginBottom:14, padding:'10px 13px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}40` }}>
            <div style={{ color:'#B8860B', fontFamily:FONT, fontSize:11, fontWeight:700 }}>🔄 Reabertura — ajuste os campos necessários e envie novamente.</div>
            <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11, marginTop:4 }}>Motivo da recusa: <em>{initialData.responseNote}</em></div>
          </div>
        )}

        {/* Tipo de Serviço */}
        <div style={{ marginBottom:14 }}>
          <label style={LS}>Tipo de Serviço <span style={{ color:T.perigo }}>*</span></label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {Object.entries(CARD_TYPES).map(([k,v]) => (
              <div key={k} onClick={()=>{set('type',k);set('subtype','');set('podeEmbarcar',null);set('destinoOficina','')}}
                style={{ border:`2px solid ${form.type===k?v.color:T.border}`, borderRadius:T.r, padding:'10px 8px', cursor:'pointer', textAlign:'center', background:form.type===k?v.bg:T.surfaceAlt, transition:'all .12s' }}>
                <div style={{ fontSize:18, marginBottom:2 }}>{v.icon}</div>
                <div style={{ color:v.color, fontWeight:800, fontSize:10, fontFamily:FONT }}>{v.short}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subtipo */}
        <SubtypeSelect type={form.type} value={form.subtype}
          onChange={v=>{set('subtype',v);set('podeEmbarcar',null);set('destinoOficina','')}}
          error={errors.subtype}/>

        {/* Planta/Obra */}
        <div style={{ marginBottom:14, padding:'11px 13px', background:T.laranjaXLight, borderRadius:T.r, border:`1px solid ${errors.clientName?T.perigo:T.laranja}20` }}>
          <label style={{ ...LS, color:errors.clientName?T.perigo:T.textMuted }}>
            🔍 Planta / Obra (base SIM) <span style={{ color:T.perigo }}>*</span>
          </label>
          <ClientInput value={form.clientName?{name:form.clientName}:null}
            onChange={c=>{set('clientName',c?.name||'');set('selectedClient',c||null);set('nInternos',[]);if(c?.state)set('destCity',{m:c.city||'',s:c.state})}}
            simClients={simClients||[]}/>
          {form.clientName && <div style={{ marginTop:4, color:T.verde, fontSize:11, fontFamily:FONT, fontWeight:700 }}>✓ {form.clientName}</div>}
          {fieldErr('clientName')}
        </div>

        {/* N° Interno */}
        <div style={{ marginBottom:14 }}>
          <ChipInput
            label={<>{needsMaquinaReserva ? '🔧 N° Interno da Frota Danificada (que retorna)' : '📋 N° Interno (Frota)'} <span style={{ color:T.perigo }}>*</span></>}
            placeholder={needsMaquinaReserva ? 'N° da frota danificada + Enter...' : 'Digite o N° e pressione Enter...'}
            values={form.nInternos} onChange={v=>set('nInternos',v)}
            hint={form.selectedClient?.nInternos?.length>0?`${form.selectedClient.nInternos.length} frota(s) vinculada(s)`:'Pressione Enter ou vírgula para adicionar cada N° interno'}/>
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

          {/* Equipamento Reserva */}
          {needsMaquinaReserva && (
            <div style={{ gridColumn:'1/-1' }}>
              <ChipInput
                label={<>🚜 N° Interno(s) do Equipamento Reserva <span style={{ color:T.perigo }}>*</span></>}
                placeholder="N° interno da reserva + Enter..."
                values={form.nInternosReserva}
                onChange={v=>set('nInternosReserva',v)}
                hint="Informe o(s) N° interno(s) da(s) máquina(s) que será(ão) enviada(s) ao cliente."/>
              {errors.machine && <div style={{ color:T.perigo, fontSize:10, fontFamily:FONT, marginTop:3 }}>⚠ Informe ao menos um equipamento reserva</div>}
            </div>
          )}

          {/* Aviso múltiplas máquinas */}
          {needsMaquinaReserva && form.nInternosReserva.length > 1 && (
            <div style={{ gridColumn:'1/-1', padding:'10px 13px', background:'#FFF3E0', borderRadius:T.r, border:`1px solid #E65100` }}>
              <div style={{ color:'#E65100', fontFamily:FONT, fontSize:11, fontWeight:700 }}>
                ⚠️ Solicitação contém mais de 1 máquina — será utilizada a Prancha 3 eixos.
              </div>
            </div>
          )}

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

          {/* Data e canal */}
          <div>
            <label style={LS}>Data desejada <span style={{ color:T.perigo }}>*</span></label>
            <input type="date" value={form.desiredDate} onChange={e=>set('desiredDate',e.target.value)} style={IS}/>
          </div>
          <div>
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
          {needsNF && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} style={{ marginBottom:14 }}>
              <ChipInput label="📄 Nota(s) Fiscal(is) de Retorno" placeholder="Digite o número da NF e pressione Enter..."
                values={form.nfsRetorno} onChange={v=>set('nfsRetorno',v)}
                hint="Opcional — pode ser informado depois. Pressione Enter após cada número."/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Descrição */}
        <div style={{ marginBottom:18 }}>
          <label style={LS}>Descrição / Detalhes</label>
          <textarea value={form.description} onChange={e=>set('description',e.target.value)}
            style={{ ...IS, height:70, resize:'vertical' }} placeholder="Descreva a operação, prazos, contato no local..."/>
        </div>

        {Object.keys(errors).length>0 && (
          <div style={{ marginBottom:12, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>⚠ Preencha todos os campos obrigatórios antes de enviar.</div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...BS, background:saving?T.borderMid:T.laranja, color:'white', fontWeight:900, fontSize:13 }}>
            {saving ? '⏳ Salvando...' : (submitLabel || (initialData ? '🔄 Reenviar Solicitação' : '📤 Enviar Solicitação'))}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
