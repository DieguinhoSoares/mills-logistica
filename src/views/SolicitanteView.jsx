import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useRequests, useNotifications, useMessages } from '../hooks/useFirestore'
import { MillsLogo, NotificationBell, ClientInput, FrotaInput, MunicipioInput, ToastContainer, useToasts } from '../components/UI'
import { T, FONT, CARD_TYPES, CARD_SUBTYPES, URGENCY, IS, LS, BS } from '../lib/constants'
import { fmt, todayStr, getSubtypeLabel } from '../lib/utils'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const STATUS_CONFIG = {
  pendente_supervisor: { label:'⏳ Aguard. Supervisor',  color:'#B8860B',  bg:'#FFF8E1'      },
  pendente_gerente:    { label:'📋 Aguard. Gerência',    color:T.info,     bg:T.infoLight    },
  pendente:            { label:'⏳ Aguardando análise',  color:T.amarelo,  bg:T.amareloLight },
  aceito:              { label:'✅ Aceito',               color:T.verde,    bg:T.verdeLight   },
  recusado:            { label:'❌ Recusado',             color:T.perigo,   bg:T.perigoLight  },
  cancelado:           { label:'🚫 Cancelado',            color:T.textMuted,bg:T.surfaceLow  },
}

const URGENCY_SLA = { critico:'até 4h', alto:'até 24h', medio:'até 3 dias', baixo:'até 7 dias' }
const SUBTYPES_NF       = ['desmobilizacao','rollout','quebra_contrato','troca_tecnica','sinistro','garantia']
const SUBTYPES_EMBARQUE = ['troca_tecnica','sinistro','garantia']
const SUBTYPES_OFICINA  = ['garantia']
const SUBTYPES_MAQUINA_RESERVA = ['troca_tecnica','sinistro','garantia','rollout']

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
          onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add()}}} onBlur={add}
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

function MessageThread({ requestId, profile, onClose }) {
  const { messages, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await sendMessage({ requestId, text:text.trim(), authorId:profile?.uid||'', authorName:profile?.name||'Solicitante', authorRole:profile?.role||'solicitante', type:'message' })
    await addDoc(collection(db,'notifications'), { userId:'frotas', requestId, type:'new_message', title:'💬 Nova mensagem', message:`${profile?.name} enviou uma mensagem.`, read:false, createdAt:serverTimestamp() })
    setText(''); setSending(false)
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:T.shadowLg, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ background:T.verde, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:14 }}>💬 Histórico da Solicitação</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {messages.length===0 && <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:12, padding:'20px 0' }}>Nenhuma mensagem ainda.</div>}
          {messages.map(m => {
            const isMe = m.authorRole==='solicitante'
            if (m.type==='status_change') return (
              <div key={m.id} style={{ textAlign:'center' }}>
                <span style={{ background:T.surfaceLow, color:T.textMuted, borderRadius:20, padding:'3px 12px', fontSize:10, fontFamily:FONT }}>{m.text}</span>
              </div>
            )
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start' }}>
                <div style={{ maxWidth:'75%', background:isMe?T.laranja:T.surfaceAlt, borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px', padding:'9px 13px', boxShadow:T.shadow }}>
                  <div style={{ color:isMe?'rgba(255,255,255,0.8)':T.textMuted, fontSize:9, fontFamily:FONT, fontWeight:700, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.authorName}</div>
                  <div style={{ color:isMe?'white':T.text, fontSize:12, fontFamily:FONT, lineHeight:1.5 }}>{m.text}</div>
                </div>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginTop:2 }}>{m.createdAt?.toDate?.()?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})||''}</div>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8 }}>
          <input value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}}
            placeholder="Digite uma mensagem..." style={{ ...IS, flex:1, margin:0 }}/>
          <button onClick={handleSend} disabled={sending||!text.trim()}
            style={{ ...BS, background:text.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, flexShrink:0 }}>
            {sending?'⏳':'Enviar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function RequestForm({ simClients, onSubmit, onClose, profile, initialData }) {
  const blank = {
    type:'freteCliente', subtype:'', machine:'',
    nInternos:[], originCity:null, destCity:null,
    selectedClient:null, clientName:'',
    desiredDate:todayStr(), urgency:'medio',
    description:'', channel:'teams',
    podeEmbarcar:null, destinoOficina:'', nfsRetorno:[],
  }
  const initial = initialData ? {
    type:          initialData.type||'freteCliente',
    subtype:       initialData.subtype||'',
    machine:       initialData.machine||'',
    nInternos:     initialData.nInternos||(initialData.nInterno?[initialData.nInterno]:[]),
    originCity:    initialData.originCity||(initialData.originCityName?{m:initialData.originCityName,s:initialData.origin}:null),
    destCity:      initialData.destCity||(initialData.destCityName?{m:initialData.destCityName,s:initialData.destination}:null),
    selectedClient:null, clientName:initialData.clientName||'',
    desiredDate:   initialData.desiredDate||todayStr(),
    urgency:       initialData.urgency||'medio',
    description:   initialData.description||'',
    channel:       initialData.channel||'teams',
    podeEmbarcar:  initialData.podeEmbarcar||null,
    destinoOficina:initialData.destinoOficina||'',
    nfsRetorno:    initialData.nfsRetorno||[],
  } : blank

  const [form,   setForm]   = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:undefined})) }

  const needsNF            = SUBTYPES_NF.includes(form.subtype)
  const needsEmbarque      = SUBTYPES_EMBARQUE.includes(form.subtype)
  const needsOficina       = SUBTYPES_OFICINA.includes(form.subtype)
  const needsMaquinaReserva = SUBTYPES_MAQUINA_RESERVA.includes(form.subtype)

  const validate = () => {
    const e = {}
    if (!form.subtype)             e.subtype    = true
    if (!form.clientName)          e.clientName = true
    if (form.nInternos.length===0) e.nInternos  = true
    if (!form.originCity)          e.originCity = true
    if (!form.destCity)            e.destCity   = true
    if (needsMaquinaReserva && !form.machine) e.machine = true
    if (needsEmbarque && form.podeEmbarcar===null) e.podeEmbarcar   = true
    if (needsOficina  && !form.destinoOficina)     e.destinoOficina = true
    setErrors(e); return Object.keys(e).length===0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    await onSubmit({
      ...form,
      nInterno:      form.nInternos.join(', '),
      nInternos:     form.nInternos,
      requesterName: profile?.name||'',
      unit:          profile?.unit||'',
      origin:        form.originCity?.s||'',
      destination:   form.destCity?.s||'',
      originCityName:form.originCity?.m||'',
      destCityName:  form.destCity?.m||'',
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
              {initialData?'🔄 Ajustar Solicitação':'➕ Solicitar Serviço'}
            </h2>
            <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'3px 0 0' }}>
              Solicitando como: <strong style={{ color:T.verde }}>{profile?.name}</strong> · {profile?.unit}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {initialData && (
          <div style={{ marginBottom:14, padding:'10px 13px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}40` }}>
            <div style={{ color:'#B8860B', fontFamily:FONT, fontSize:11, fontWeight:700 }}>🔄 Reabertura — ajuste os campos necessários e envie novamente.</div>
            {initialData.responseNote && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:11, marginTop:4 }}>Motivo da recusa: <em>{initialData.responseNote}</em></div>}
          </div>
        )}

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

        <SubtypeSelect type={form.type} value={form.subtype}
          onChange={v=>{set('subtype',v);set('podeEmbarcar',null);set('destinoOficina','')}}
          error={errors.subtype}/>

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

        <div style={{ marginBottom:14 }}>
          <ChipInput
            label={<>N° Interno (Frota) <span style={{ color:T.perigo }}>*</span></>}
            placeholder="Digite o N° e pressione Enter..."
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
          <div>
            <label style={LS}>Urgência <span style={{ color:T.perigo }}>*</span></label>
            <select value={form.urgency} onChange={e=>set('urgency',e.target.value)} style={IS}>
              {Object.entries(URGENCY).map(([k,v])=>(
                <option key={k} value={k}>{v.icon} {v.label} ({URGENCY_SLA[k]})</option>
              ))}
            </select>
          </div>

          {needsMaquinaReserva && (
            <div>
              <label style={{ ...LS, color:errors.machine?T.perigo:T.textMuted }}>
                {form.subtype==='rollout' ? 'Equipamento que retorna' : 'Equipamento Reserva'} <span style={{ color:T.perigo }}>*</span>
              </label>
              <input value={form.machine} onChange={e=>set('machine',e.target.value)}
                style={{ ...IS, border:`1px solid ${errors.machine?T.perigo:T.border}` }}
                placeholder="Ex: Carregadeira 924K, PA150..."/>
              {fieldErr('machine')}
            </div>
          )}

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
            {saving?'⏳ Enviando...':initialData?'🔄 Reenviar Solicitação':'📤 Enviar Solicitação'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function SolicitanteView({ simClients }) {
  const { profile, logout }         = useAuth()
  const { requests, submitRequest } = useRequests('solicitante')
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { toasts, add:addToast, dismiss } = useToasts()
  const [showForm,   setShowForm]   = useState(false)
  const [reopenData, setReopenData] = useState(null)
  const [messaging,  setMessaging]  = useState(null)
  const [search,     setSearch]     = useState('')

  const handleSubmit = async form => {
    await submitRequest(form)
    addToast('Solicitação enviada! O time de Frotas foi notificado.', 'success')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return requests
    const q = search.toLowerCase()
    return requests.filter(r =>
      (r.clientName||'').toLowerCase().includes(q) ||
      (r.machine||'').toLowerCase().includes(q) ||
      (r.originCityName||r.origin||'').toLowerCase().includes(q) ||
      (r.destCityName||r.destination||'').toLowerCase().includes(q) ||
      (r.nInterno||'').toLowerCase().includes(q) ||
      (r.requesterName||'').toLowerCase().includes(q) ||
      (r.status||'').toLowerCase().includes(q)
    )
  }, [requests, search])

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>

      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'0 12px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MillsLogo height={28}/>
          <div style={{ width:1, height:22, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase' }}>Portal do Solicitante</div>
            <div style={{ color:T.textMuted, fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase' }}>{profile?.unit||'mills'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead}/>
          <button onClick={logout} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 12px' }}>
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          style={{ background:`linear-gradient(135deg, ${T.verde}, #006466)`, borderRadius:T.rLg, padding:'24px 28px', marginBottom:22,
            display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:T.shadowMd, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ color:'rgba(255,255,255,.65)', fontSize:10, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>Mills Pesados · Gestão de Frotas</div>
            <h2 style={{ color:'white', fontFamily:FONT, fontWeight:900, fontSize:22, margin:'0 0 5px' }}>Precisa de frete ou guindauto?</h2>
            <p style={{ color:'rgba(255,255,255,.7)', fontFamily:FONT, fontSize:12, margin:0 }}>Solicite agora. O time de Frotas recebe em tempo real.</p>
          </div>
          <button onClick={()=>setShowForm(true)}
            style={{ ...BS, background:T.laranja, color:'white', fontWeight:900, fontSize:14, padding:'13px 22px', borderRadius:T.rLg, boxShadow:'0 4px 16px rgba(243,112,33,.4)', whiteSpace:'nowrap', position:'relative', zIndex:1 }}>
            + Nova Solicitação
          </button>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Total',     value:requests.length,                                  color:T.laranja, bg:T.laranjaLight },
            { label:'Pendentes', value:requests.filter(r=>['pendente','pendente_supervisor','pendente_gerente'].includes(r.status)).length, color:T.amarelo, bg:T.amareloLight },
            { label:'Aceitas',   value:requests.filter(r=>r.status==='aceito').length,   color:T.verde,   bg:T.verdeLight   },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}30`, borderRadius:T.rLg, padding:'14px 16px' }}>
              <div style={{ color:s.color, fontFamily:FONT, fontWeight:900, fontSize:26, lineHeight:1 }}>{s.value}</div>
              <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Campo de pesquisa */}
        <div style={{ marginBottom:14, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:T.textMuted }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Buscar por cliente, equipamento, rota, N° interno..."
            style={{ ...IS, paddingLeft:36, width:'100%', boxSizing:'border-box' }}/>
          {search && (
            <button onClick={()=>setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:16 }}>×</button>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:16, margin:0 }}>Minhas Solicitações</h3>
          {search && <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12 }}>{filtered.length} resultado(s)</span>}
        </div>

        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT }}>
            <div style={{ fontSize:44, marginBottom:10 }}>{search?'🔍':'📭'}</div>
            <p>{search?'Nenhuma solicitação encontrada.':'Nenhuma solicitação ainda.'}</p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(r => {
            const sc        = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente
            const ct        = CARD_TYPES[r.type]
            const ug        = URGENCY[r.urgency]
            const nfs       = r.nfsRetorno||[]
            const nInternos = r.nInternos||(r.nInterno?[r.nInterno]:[])
            return (
              <motion.div key={r.id} layout initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                style={{ background:T.surface, border:`1.5px solid ${sc.color}25`, borderRadius:T.rLg, padding:'16px 18px', boxShadow:T.shadow }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:9 }}>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    <span style={{ background:ct?.bg, border:`1px solid ${ct?.color}40`, borderRadius:20, padding:'2px 9px', color:ct?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ct?.icon} {ct?.short}</span>
                    {r.subtype && <span style={{ background:T.infoLight, borderRadius:20, padding:'2px 9px', color:T.info, fontSize:9, fontWeight:800, fontFamily:FONT }}>{getSubtypeLabel(r.type,r.subtype)}</span>}
                    <span style={{ background:ug?.bg, borderRadius:20, padding:'2px 9px', color:ug?.color, fontSize:9, fontWeight:800, fontFamily:FONT }}>{ug?.icon} {ug?.label}</span>
                  </div>
                  <span style={{ background:sc.bg, border:`1px solid ${sc.color}40`, borderRadius:20, padding:'3px 11px', color:sc.color, fontSize:11, fontWeight:800, fontFamily:FONT, whiteSpace:'nowrap' }}>{sc.label}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:8 }}>
                  {[
                    ['Planta/Obra',   r.clientName||'—'],
                    ['Equipamento',   r.machine||'—'],
                    ['Rota',          `${r.originCityName||r.origin||'—'} → ${r.destCityName||r.destination||'—'}`],
                    ['Data desejada', fmt(r.desiredDate)],
                    ['Urgência',      `${ug?.icon} ${ug?.label} (${URGENCY_SLA[r.urgency]||'—'})`],
                    ['N° Internos',   nInternos.length>0?nInternos.join(', '):'—'],
                  ].map(([l,v]) => (
                    <div key={l}>
                      <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:FONT, marginBottom:2 }}>{l}</div>
                      <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div>
                    </div>
                  ))}
                </div>
                {nfs.length>0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                    <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>📄 NFs:</span>
                    {nfs.map(n=><span key={n} style={{ background:T.verdeLight, color:T.verde, borderRadius:20, padding:'1px 8px', fontSize:10, fontWeight:700, fontFamily:FONT }}>{n}</span>)}
                  </div>
                )}
                {r.podeEmbarcar && (
                  <div style={{ marginBottom:8, color:T.textSec, fontSize:10, fontFamily:FONT }}>
                    🚚 Embarque: {r.podeEmbarcar==='sim'?'Pode embarcar normalmente':'Requer equipamento especial'}
                    {r.destinoOficina&&` · Destino: ${r.destinoOficina==='mills'?'Oficina Mills':'Concessionária'}`}
                  </div>
                )}
                {r.transportadoraNome && (
                  <div style={{ marginBottom:8, padding:'6px 10px', background:T.infoLight, borderRadius:T.rSm, color:T.info, fontSize:10, fontFamily:FONT, fontWeight:700 }}>
                    🚚 Transportadora: {r.transportadoraNome}{r.transportadoraCnpj&&` · CNPJ: ${r.transportadoraCnpj}`}
                  </div>
                )}
                {r.responseNote && (
                  <div style={{ marginTop:8, padding:'8px 12px', background:r.status==='aceito'?T.verdeLight:T.perigoLight, borderRadius:T.rSm, color:r.status==='aceito'?T.verde:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>
                    {r.status==='aceito'?'✅':r.status==='cancelado'?'🚫':'❌'} {r.responseNote}
                  </div>
                )}
                <div style={{ marginTop:10, display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={()=>setMessaging(r)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:11, fontWeight:700 }}>💬 Histórico</button>
                  {r.status==='recusado' && (
                    <button onClick={()=>setReopenData(r)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}40`, fontSize:11, fontWeight:700 }}>🔄 Reabrir e ajustar</button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {messaging && <MessageThread requestId={messaging.id} profile={profile} onClose={()=>setMessaging(null)}/>}
      {(showForm||reopenData) && (
        <RequestForm simClients={simClients||[]} profile={profile} initialData={reopenData||null}
          onSubmit={handleSubmit} onClose={()=>{setShowForm(false);setReopenData(null)}}/>
      )}
    </div>
  )
}
