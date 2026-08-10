import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { T, FONT, CARD_TYPES, URGENCY, BR_STATES } from '../lib/constants'

// ─── PushInviteBanner — convite automático pra ativar push (item 5) ───────
// Aparece sozinho quando o navegador ainda não decidiu nada sobre permissão
// de notificação (nunca perguntou, ou a pessoa nunca respondeu) — poupa o
// usuário de precisar achar o botão escondido dentro do dropdown do sino.
// "Agora não" esconde só nesta sessão (aba); reabre a página, aparece de novo
// se a permissão continuar indefinida — não é implorar, é lembrar.
export function PushInviteBanner({ mostrar, onAtivar, onDispensar }) {
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  if (!mostrar) return null

  const handleAtivar = async () => {
    setBusy(true); setErro('')
    const res = await onAtivar()
    if (!res?.ok) setErro(res?.error || 'Não foi possível ativar.')
    setBusy(false)
  }

  return (
    <div style={{ background:T.verde, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:14, flexWrap:'wrap' }}>
      <span style={{ color:'white', fontFamily:FONT, fontSize:12, fontWeight:700 }}>
        🔔 Quer receber avisos mesmo com o navegador fechado?
      </span>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={handleAtivar} disabled={busy}
          style={{ background:T.laranja, color:'white', border:'none', borderRadius:8, padding:'6px 14px', fontFamily:FONT, fontWeight:800, fontSize:11, cursor:busy?'default':'pointer' }}>
          {busy ? '⏳ Ativando...' : 'Ativar notificações'}
        </button>
        <button onClick={onDispensar}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,.75)', fontFamily:FONT, fontSize:11, fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
          Agora não
        </button>
      </div>
      {erro && <span style={{ color:'#FFCDD2', fontFamily:FONT, fontSize:10 }}>{erro}</span>}
    </div>
  )
}
import { fmt } from '../lib/utils'

export function MillsLogo({ height=32 }) {
  return <img src="/mills-logistica/mills-logo.png" alt="mills" height={height} style={{ flexShrink:0 }}/>
}

export function MillsPattern({ opacity=0.07, color=T.laranja }) {
  const heights = [18,10,22,8,16,12,20,6,14,24,10,18,8,22,12,16,20,8,14,18]
  return (
    <svg style={{ position:'absolute', bottom:0, left:0, right:0, width:'100%', height:40, overflow:'hidden', pointerEvents:'none' }}
      viewBox="0 0 640 40" preserveAspectRatio="xMidYMax slice">
      {Array.from({length:36},(_,i) => (
        <rect key={i} x={i*18+2} y={40-heights[i%heights.length]} width="7" height={heights[i%heights.length]} rx="2"
          fill={color} opacity={opacity}/>
      ))}
    </svg>
  )
}

const TOAST_COLORS = { conflict:T.amarelo, late:T.perigo, accepted:T.verde, rejected:T.perigo, info:T.info, success:T.verde }
const TOAST_LABELS = { conflict:'⚠ Otimização', late:'🔴 Atrasado', accepted:'✅ Aceito', rejected:'❌ Recusado', info:'ℹ Info', success:'✅ Sucesso' }

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position:'fixed', top:70, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8, maxWidth:360, pointerEvents:'none' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ x:400, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:400, opacity:0 }}
            transition={{ type:'spring', damping:22, stiffness:220 }}
            style={{ background:T.surface, border:`2px solid ${TOAST_COLORS[t.type]||T.info}`, borderRadius:T.rLg,
              padding:'12px 14px', boxShadow:T.shadowLg, position:'relative', overflow:'hidden', pointerEvents:'all' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:TOAST_COLORS[t.type]||T.info, borderRadius:'4px 0 0 4px' }}/>
            <div style={{ paddingLeft:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text, textTransform:'uppercase' }}>{TOAST_LABELS[t.type]||'Info'}</span>
                <button onClick={()=>onDismiss(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:18 }}>×</button>
              </div>
              <p style={{ fontFamily:FONT, fontSize:12, color:T.textSec, margin:'3px 0 0', lineHeight:1.4 }}>{t.msg}</p>
            </div>
            <motion.div initial={{ scaleX:1 }} animate={{ scaleX:0 }} transition={{ duration:7, ease:'linear' }}
              style={{ position:'absolute', bottom:0, left:0, height:2.5, background:TOAST_COLORS[t.type]||T.info, transformOrigin:'left' }}
              onAnimationComplete={()=>onDismiss(t.id)}/>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const add     = (msg, type='info') => setToasts(p => [...p, { id:Date.now()+Math.random(), msg, type }])
  const dismiss = id => setToasts(p => p.filter(t => t.id !== id))
  return { toasts, add, dismiss }
}

export function NotificationBell({ notifications, unreadCount, onMarkAllRead, onMarkRead, onDelete, onEnablePush, onDisablePush }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => setOpen(o => !o)

  const handleMarkAll = () => {
    onMarkAllRead()
    setOpen(false)
  }

  const handleClickNotif = (n) => {
    if (!n.read && onMarkRead) onMarkRead(n.id)
  }

  // unreadCount real — baseado nas notificações não lidas
  const realUnread = notifications.filter(n => !n.read).length

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={handleOpen}
        style={{ background:realUnread>0?T.laranjaLight:T.surfaceAlt, border:`1px solid ${realUnread>0?T.laranja+'60':T.border}`,
          borderRadius:T.r, color:realUnread>0?T.laranja:T.textSec, padding:'6px 12px', cursor:'pointer', position:'relative', fontFamily:FONT, transition:'all .2s' }}>
        🔔
        {realUnread>0 && (
          <span style={{ position:'absolute', top:-4, right:-4, background:T.perigo, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'1px 5px', fontFamily:FONT }}>
            {realUnread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
            style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:320, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.rLg, boxShadow:T.shadowLg, zIndex:999 }}>
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>
                Notificações {realUnread>0 && <span style={{ color:T.perigo }}>({realUnread})</span>}
              </span>
              {realUnread>0 && (
                <button onClick={handleMarkAll} style={{ background:'none', border:'none', cursor:'pointer', color:T.laranja, fontSize:11, fontFamily:FONT, fontWeight:700 }}>
                  ✓ Marcar todas lidas
                </button>
              )}
            </div>
            <div style={{ maxHeight:300, overflowY:'auto' }}>
              {notifications.length===0 && (
                <p style={{ padding:14, color:T.textMuted, fontFamily:FONT, fontSize:12, margin:0, textAlign:'center' }}>Nenhuma notificação.</p>
              )}
              {notifications.slice(0,15).map(n => (
                <div key={n.id} onClick={()=>handleClickNotif(n)}
                  style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`,
                    background: n.read ? T.surface : T.laranjaXLight,
                    cursor: n.read ? 'default' : 'pointer',
                    transition:'background .15s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{n.title}</div>
                    {!n.read && (
                      <div style={{ width:7, height:7, borderRadius:'50%', background:T.laranja, flexShrink:0, marginTop:3 }}/>
                    )}
                    {n.read && onDelete && (
                      <button onClick={e=>{e.stopPropagation();onDelete(n.id)}} title="Apagar notificação"
                        style={{ background:'none', border:'none', color:T.textMuted, fontSize:12, cursor:'pointer', padding:'0 2px', flexShrink:0, lineHeight:1 }}>
                        🗑
                      </button>
                    )}
                  </div>
                  <div style={{ fontFamily:FONT, fontSize:11, color:T.textSec, marginTop:2 }}>{n.message}</div>
                  {n.createdAt?.toDate && (
                    <div style={{ fontFamily:FONT, fontSize:9, color:T.textMuted, marginTop:3 }}>
                      {n.createdAt.toDate().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ClientInput({ value, onChange, simClients, simClientsError }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState(value?.name||'')

  // Sem isso, se o formulário resetar `value` pra null por qualquer motivo
  // (troca de subtipo, limpeza de campo, etc.), o texto digitado continuava
  // aparecendo na tela mesmo com o campo real vazio por trás — dando a
  // impressão de "cliente preenchido" quando na verdade não tinha nada
  // selecionado, e o formulário barrava com "Campo obrigatório".
  useEffect(() => { setSearch(value?.name||'') }, [value])

  // Normalização tolerante a acentos e maiúsculas/minúsculas —
  // converte "SÃO PAULO" e "SAO PAULO" pra a mesma string de busca.
  const norm = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // remove diacríticos (acentos)
    .replace(/[^a-z0-9\s]/g, '')                        // remove pontuação
    .trim()

  // Busca por Planta/Obra (nome exibido) OU por Cliente — o CSV do SIM tem
  // as duas colunas separadas, e quando ambas existem só a de Planta/Obra
  // vira o nome agrupado (prioridade em parseSIMCsv). Sem isso, digitar o
  // nome do cliente (ex: "INFRAINVEST") não encontrava a obra dele quando a
  // obra tinha um nome de site diferente (ex: "Obra Rodovia BR-153").
  const filtered = search.length>1
    ? simClients.filter(c => norm(c.name).includes(norm(search)) || (c.cliente && norm(c.cliente).includes(norm(search)))).slice(0,8)
    : []

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false)
      // Se o usuário digitou algo mas não selecionou nenhum item, NÃO aceita
      // automaticamente como texto livre — exige clique explícito na opção
      // "Usar como texto livre" no dropdown. Isso evita perda acidental do
      // vínculo com o SIM quando o cliente realmente existe na base.
    }, 180)
  }

  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e=>{ setSearch(e.target.value); setOpen(true); if(!e.target.value) onChange(null) }}
        onFocus={()=>setOpen(true)}
        onBlur={handleBlur}
        placeholder="Digite a planta ou obra..." style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }} autoComplete="off"/>
      {/* Achado de bug real: o fallback "texto livre" abaixo (linhas
          originalmente aninhadas aqui dentro) exigia filtered.length===0,
          mas só renderizava se o container pai já exigisse
          filtered.length>0 — as duas condições nunca podiam ser
          verdadeiras ao mesmo tempo, então esse fallback nunca aparecia
          NUNCA, pra ninguém. Resultado: digitar algo sem nenhum resultado
          (base vazia por falha de carregamento, OU cliente genuinamente
          novo/fora do SIM) não mostrava nada — nem a lista, nem a opção de
          seguir com texto livre — só um campo mudo, sem explicação (foi
          exatamente o que uma solicitante nova reportou). Corrigido
          soltando as duas condições, cada bloco decide por si só. */}
      {open && (filtered.length>0 || search.trim().length>=3) && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:220, overflowY:'auto' }}>
          {filtered.map(c => (
            <div key={c.name} onMouseDown={()=>{ onChange(c); setSearch(c.name); setOpen(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.background=T.laranjaXLight}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{c.name}</div>
              {c.cliente && <div style={{ fontFamily:FONT, fontSize:10, color:T.laranja, fontWeight:600 }}>Cliente: {c.cliente}</div>}
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>
                {c.city?`${c.city} — `:''}{c.state} · {c.machines} máq.
                {c.nInternos?.length>0 && <span style={{ color:T.info }}> · N°: {c.nInternos.slice(0,3).join(', ')}</span>}
              </div>
            </div>
          ))}
          {/* Opção de texto livre — só aparece quando não há nenhum match no SIM
              É um último recurso: fornecedores externos, clientes novos antes
              da base ser atualizada. Perde vínculo com SIM (sem estado/cidade/frotas). */}
          {filtered.length===0 && (
            <div onMouseDown={()=>{ const obj={name:search.trim(),state:'',city:'',machines:0,nInternos:[],_livreLookup:true}; onChange(obj); setOpen(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', background:T.amareloLight, borderTop:`2px solid ${T.amarelo}40` }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:'#8A6D00' }}>
                {simClientsError ? '⚠️ Base do SIM não carregou' : '⚠️ Não encontrado no SIM'}
              </div>
              <div style={{ fontFamily:FONT, fontSize:10, color:'#8A6D00', marginTop:2 }}>
                {simClientsError
                  ? <>A busca pode estar incompleta agora. Tente sair e entrar de novo antes de usar texto livre.<br/></>
                  : null}
                Clique aqui para usar <strong>"{search.trim()}"</strong> como texto livre — sem vínculo com SIM.<br/>
                <em>Só use se o cliente realmente não está na base.</em>
              </div>
            </div>
          )}
        </div>
      )}
      {value?._livreLookup && (
        <div style={{ marginTop:4, padding:'5px 9px', background:T.amareloLight, borderRadius:T.rSm,
          border:`1px solid ${T.amarelo}60`, color:'#8A6D00', fontSize:10, fontFamily:FONT, fontWeight:700 }}>
          ⚠️ Texto livre — sem vínculo com SIM (estado, cidade e frotas não serão preenchidos automaticamente).
          Se o cliente está na base, atualize o CSV e busque novamente.
        </div>
      )}
    </div>
  )
}

export function FrotaInput({ value, onChange, simClients }) {
  const [search, setSearch]     = useState(value||'')
  const [open, setOpen]         = useState(false)
  const [notFound, setNotFound] = useState(false)
  const allFrotas = simClients.flatMap(c=>(c.nInternos||[]).map(n=>({ nInterno:n, client:c.name, state:c.state })))
  const filtered  = search.length>=2 ? allFrotas.filter(f=>f.nInterno.toLowerCase().includes(search.toLowerCase())).slice(0,8) : []
  const handleBlur = () => {
    setTimeout(()=>{
      setOpen(false)
      if(search.length>=2 && allFrotas.length>0 && filtered.length===0) setNotFound(true)
      else setNotFound(false)
    }, 180)
  }
  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e=>{ setSearch(e.target.value); setOpen(true); onChange(e.target.value); setNotFound(false) }}
        onFocus={()=>setOpen(true)} onBlur={handleBlur}
        placeholder="Ex: XXX01234"
        style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${notFound?T.perigo:T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }} autoComplete="off"/>
      {notFound && <div style={{ marginTop:5, padding:'7px 10px', background:T.perigoLight, borderRadius:T.rSm, color:T.perigo, fontSize:11, fontFamily:FONT, fontWeight:700 }}>⚠️ Frota não encontrada. Entre em contato com a Gestão de Frotas.</div>}
      {open && filtered.length>0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:200, overflowY:'auto' }}>
          {filtered.map((f,i) => (
            <div key={i} onMouseDown={()=>{ onChange(f.nInterno); setSearch(f.nInterno); setOpen(false); setNotFound(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.background=T.laranjaXLight}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{f.nInterno}</div>
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{f.client} · {f.state}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MunicipioInput({ value, onChange, placeholder='Cidade...' }) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState(value ? `${value.m} (${value.s})` : '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  // Cada tecla dispara um fetch novo, sem cancelar o anterior \u2014 se a resposta
  // de uma busca mais ANTIGA (ex: "S\u00e3o Paulo") chegar DEPOIS da resposta de
  // uma busca mais NOVA (ex: "Rio de Janeiro", digitado r\u00e1pido em seguida),
  // o setResults da antiga rodava por \u00faltimo e sobrescrevia a lista, mesmo
  // com o campo j\u00e1 mostrando outro texto \u2014 clicar numa sugest\u00e3o "colava" a
  // cidade errada (bug real de condi\u00e7\u00e3o de corrida, achado em auditoria).
  // Um contador de sequ\u00eancia resolve sem precisar de AbortController: s\u00f3
  // aplica o resultado se ainda for o pedido mais recente disparado.
  const buscaSeq = useRef(0)
  const buscar = async (texto) => {
    if(texto.length<2){ setResults([]); return }
    const minhaSeq = ++buscaSeq.current
    setLoading(true)
    try {
      const res  = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      const data = await res.json()
      if (minhaSeq !== buscaSeq.current) return // uma busca mais nova j\u00e1 rodou \u2014 descarta essa resposta atrasada
      const normT=texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); setResults(data.filter(m=>m.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normT)).slice(0,10).map(m=>({ m:m.nome, s:m.microrregiao.mesorregiao.UF.sigla })))
    } catch { if (minhaSeq === buscaSeq.current) setResults([]) }
    if (minhaSeq === buscaSeq.current) setLoading(false)
  }
  return (
    <div style={{ position:'relative' }}>
      <input value={search}
        onChange={e=>{ setSearch(e.target.value); setOpen(true); buscar(e.target.value); if(!e.target.value) onChange(null) }}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)}
        placeholder={placeholder}
        style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none' }} autoComplete="off"/>
      {loading && <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12 }}>⏳</div>}
      {open && results.length>0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, boxShadow:T.shadowLg, zIndex:500, maxHeight:220, overflowY:'auto' }}>
          {results.map((m,i) => (
            <div key={i} onMouseDown={()=>{ onChange(m); setSearch(`${m.m} (${m.s})`); setOpen(false) }}
              style={{ padding:'9px 13px', cursor:'pointer', borderBottom:`1px solid ${T.border}` }}
              onMouseEnter={e=>e.currentTarget.style.background=T.laranjaXLight}
              onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>{m.m}</span>
              <span style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}> — {m.s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ServiceCard({ card, conflicts, onEdit, onDragStart, compact=false }) {
  const ct  = CARD_TYPES[card.type]
  const ug  = URGENCY[card.urgency]
  const hasConf    = conflicts?.some(c=>c.a===card.id||c.b===card.id)
  const isLate     = card.calendarStatus === 'atrasado'
  const isCancelado = card.status === 'cancelado'
  const semVinculo = !card.requestId && !card.cardOrigemId   // card criado direto pelo Frotas
  // Subtipo legível — remove underscores e capitaliza
  const subtypeLabel = card.subtype ? card.subtype.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase()) : null
  return (
    <motion.div layout whileHover={{ y:-1, boxShadow:T.shadowMd }}
      draggable onDragStart={e=>onDragStart?.(e,card)} onClick={()=>onEdit?.(card)}
      style={{ borderRadius:T.r, border:`2px solid ${ct?.color}`, background:ct?.bg,
        padding:compact?'5px 7px':'9px 11px', cursor:'grab', marginBottom:4,
        position:'relative', userSelect:'none', opacity:isCancelado?0.5:1,
        boxShadow:hasConf?`0 0 0 2px ${T.amarelo},${T.shadow}`:isLate?`0 0 0 2px ${T.perigo},${T.shadow}`:T.shadow }}>
      {hasConf    && <div style={{ position:'absolute', top:-8, right:6, background:T.amarelo, color:'#000', fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>OTIMIZAR</div>}
      {isLate     && <div style={{ position:'absolute', top:-8, left:6, background:T.perigo, color:'#fff', fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>ATRASADO</div>}
      {isCancelado && <div style={{ position:'absolute', top:-8, left:6, background:'#5A5A5A', color:'#fff', fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>🚫 CANCELADO</div>}
      {semVinculo && !compact && <div style={{ position:'absolute', top:-8, right:hasConf?'auto':6, background:'#607D8B', color:'#fff', fontSize:7, fontWeight:700, padding:'1px 5px', borderRadius:4, fontFamily:FONT }}>sem vínculo</div>}
      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:compact?1:4 }}>
        <span style={{ fontSize:compact?10:12 }}>{ct?.icon}</span>
        <span style={{ color:ct?.color, fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:FONT }}>{ct?.short}</span>
        {card.seqId && !compact && <span style={{ color:T.textMuted, fontSize:8, fontFamily:FONT }}>#{card.seqId}</span>}
        <span style={{ marginLeft:'auto', fontSize:compact?9:11 }}>{ug?.icon}</span>
      </div>
      <div style={{ color:T.text, fontWeight:700, fontSize:compact?10:12, fontFamily:FONT, marginBottom:compact?0:2, lineHeight:1.2, textDecoration:isCancelado?'line-through':'none' }}>{card.client}</div>
      {!compact && <>
        {subtypeLabel && <div style={{ color:ct?.color, fontSize:9, fontFamily:FONT, marginBottom:2, fontWeight:600 }}>{subtypeLabel}</div>}
        <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT }}>{card.originCity||card.origin||'—'} → {card.destCity||card.destination||'—'}</div>
        {card.nInterno && <div style={{ color:T.info, fontSize:9, fontFamily:FONT, fontWeight:600 }}>🔢 {card.nInterno}</div>}
        {card.driver   && <div style={{ color:T.verde, fontSize:9, fontFamily:FONT, fontWeight:600 }}>👤 {card.driver}</div>}
      </>}
    </motion.div>
  )
}

export function BrazilMap({ cards }) {
  const [hov, setHov] = useState(null)
  const closeTimer = useRef(null)

  const openPopup  = (stateId) => { if(closeTimer.current) clearTimeout(closeTimer.current); setHov(stateId) }
  const startClose = () => { closeTimer.current = setTimeout(()=>setHov(null), 150) }
  const cancelClose= () => { if(closeTimer.current) clearTimeout(closeTimer.current) }

  const STATE_MAP = {
    'São Paulo':'SP','Minas Gerais':'MG','Rio de Janeiro':'RJ','Paraná':'PR',
    'Santa Catarina':'SC','Rio Grande do Sul':'RS','Bahia':'BA','Goiás':'GO',
    'Pará':'PA','Amazonas':'AM','Ceará':'CE','Pernambuco':'PE','Mato Grosso':'MT',
    'Mato Grosso do Sul':'MS','Espírito Santo':'ES','Maranhão':'MA','Piauí':'PI',
    'Rio Grande do Norte':'RN','Paraíba':'PB','Alagoas':'AL','Sergipe':'SE',
    'Tocantins':'TO','Rondônia':'RO','Roraima':'RR','Amapá':'AP','Acre':'AC',
    'Distrito Federal':'DF',
  }
  const toSigla = v => STATE_MAP[v] || v

  const cnt={}; const types={}; const stateCards={}
  cards.forEach(c => {
    ;[toSigla(c.originState||c.origin), toSigla(c.destState||c.destination)].filter(s=>s&&s.length===2).forEach(s => {
      cnt[s]=(cnt[s]||0)+1
      if(!types[s]) types[s]=new Set()
      types[s].add(c.type)
      if(!stateCards[s]) stateCards[s]=[]
      if(!stateCards[s].find(x=>x.id===c.id)) stateCards[s].push(c)
    })
  })

  const routes={}
  cards.filter(c=>(c.originState||c.origin)&&(c.destState||c.destination)).forEach(c=>{
    const o=toSigla(c.originState||c.origin), d=toSigla(c.destState||c.destination)
    if(o===d||o.length>2||d.length>2) return
    const k=[o,d].sort().join('-')
    if(!routes[k]) routes[k]=[]
    routes[k].push(c)
  })

  const getS     = id => BR_STATES.find(s=>s.id===id)
  const getColor = id => {
    const n=cnt[id]||0
    if(!n)    return { fill:'#E8F0EE', stroke:'#004042' }
    if(n===1) return { fill:'rgba(243,112,33,0.3)',  stroke:'#F37021' }
    if(n<=3)  return { fill:'rgba(243,112,33,0.6)',  stroke:'#C24003' }
    return           { fill:'rgba(194,64,3,0.85)',   stroke:'#8B2500' }
  }

  const hovCards = hov ? (stateCards[hov]||[]) : []

  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:'12px 14px', height:'100%', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', boxShadow:T.shadow }}>
      <MillsPattern opacity={0.04} color={T.laranja}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, position:'relative', zIndex:1, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.text }}>🗺 Operações Ativas</span>
          {Object.keys(cnt).length>0 && <span style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:20, padding:'1px 7px', color:T.laranja, fontSize:9, fontWeight:700, fontFamily:FONT }}>{Object.keys(cnt).length} estados</span>}
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[{f:'#E8F0EE',s:'#004042',l:'0'},{f:'rgba(243,112,33,0.3)',s:'#F37021',l:'1'},{f:'rgba(243,112,33,0.6)',s:'#C24003',l:'2–3'},{f:'rgba(194,64,3,0.85)',s:'#8B2500',l:'4+'}].map(l=>(
            <div key={l.l} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <div style={{ width:8, height:8, background:l.f, border:`1px solid ${l.s}`, borderRadius:2 }}/>
              <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, position:'relative', minHeight:0, display:'flex' }}>
        <svg viewBox="60 80 560 510" style={{ flex:1, width:'100%', position:'relative', zIndex:1 }}>
          <defs>
            <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F37021" floodOpacity="0.6"/></filter>
            <filter id="shadow2"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000022"/></filter>
          </defs>
          {BR_STATES.map(s =>
            BR_STATES.filter(n=>n.id!==s.id&&Math.sqrt((n.x-s.x)**2+(n.y-s.y)**2)<120).map(n=>(
              <line key={`${s.id}-${n.id}`} x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke="#004042" strokeWidth="0.5" opacity="0.15" strokeDasharray="3,5"/>
            ))
          )}
          {BR_STATES.map(s => {
            const {fill,stroke}=getColor(s.id)
            const isActive=!!cnt[s.id], isHov=hov===s.id
            return (
              <g key={s.id} onMouseEnter={()=>openPopup(s.id)} onMouseLeave={startClose} style={{ cursor:isActive?'pointer':'default' }}>
                {isActive && <circle cx={s.x} cy={s.y} r={isHov?26:21} fill={fill} opacity={0.15}/>}
                <circle cx={s.x} cy={s.y} r={isActive?(isHov?14:12):8} fill={fill} stroke={stroke}
                  strokeWidth={isActive?(isHov?2.5:2):1.5}
                  filter={isActive&&isHov?'url(#glow)':isActive?'url(#shadow2)':undefined}
                  style={{ transition:'all .18s' }}/>
                <text x={s.x} y={s.y+(isActive?-15:-10)} textAnchor="middle" fill={isActive?T.text:'#004042'}
                  fontSize={isActive?(isHov?10:9):7} fontWeight={isActive?'700':'500'}
                  fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents:'none' }}>{s.id}</text>
                {isActive && <text x={s.x} y={s.y+4} textAnchor="middle" fill="white"
                  fontSize={isHov?10:9} fontWeight="700" fontFamily="IBM Plex Sans, sans-serif"
                  style={{ pointerEvents:'none' }}>{cnt[s.id]}</text>}
              </g>
            )
          })}
          {Object.entries(routes).map(([key,rts])=>{
            const oId=toSigla(rts[0].originState||rts[0].origin), dId=toSigla(rts[0].destState||rts[0].destination)
            const o=getS(oId), d=getS(dId); if(!o||!d) return null
            const ct=CARD_TYPES[rts[0].type], mx=(o.x+d.x)/2, my=(o.y+d.y)/2-28
            return (
              <g key={key}>
                <path d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`} stroke={ct?.color} strokeWidth={rts.length>1?2.5:1.5} fill="none" strokeDasharray={rts.length>1?'none':'5,4'} opacity={0.75}/>
                <circle cx={mx} cy={my} r={rts.length>1?9:5} fill={rts.length>1?T.amarelo:ct?.bg} stroke={ct?.color} strokeWidth={1.5}/>
                <text x={mx} y={my+4} textAnchor="middle" fill={rts.length>1?'#000':ct?.color} fontSize={rts.length>1?9:7} fontWeight="700" fontFamily="IBM Plex Sans, sans-serif">{rts.length>1?rts.length:ct?.icon?.slice(0,1)}</text>
              </g>
            )
          })}
        </svg>
        <AnimatePresence>
          {hov && hovCards.length>0 && (
            <motion.div initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
              onMouseEnter={cancelClose} onMouseLeave={startClose}
              style={{ position:'absolute', right:0, top:0, width:220, background:T.surface, border:`1.5px solid ${T.verde}`, borderRadius:T.rLg, boxShadow:T.shadowLg, zIndex:10, overflow:'hidden' }}>
              <div style={{ background:T.verde, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color:'white', fontFamily:FONT, fontWeight:700, fontSize:12 }}>{hov} — {hovCards.length} operaç{hovCards.length>1?'ões':'ão'}</div>
                <button onClick={()=>{ if(closeTimer.current) clearTimeout(closeTimer.current); setHov(null) }}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.8)', fontSize:16, cursor:'pointer', lineHeight:1, padding:'0 0 0 8px' }}>×</button>
              </div>
              <div style={{ maxHeight:260, overflowY:'auto', padding:'6px 0' }}>
                {hovCards.map(c => {
                  const ct=CARD_TYPES[c.type]
                  return (
                    <div key={c.id} style={{ padding:'8px 12px', borderBottom:`1px solid ${T.border}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                        <span style={{ fontSize:12 }}>{ct?.icon}</span>
                        <span style={{ color:ct?.color, fontSize:9, fontWeight:700, fontFamily:FONT, textTransform:'uppercase' }}>{ct?.short}</span>
                      </div>
                      <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:2 }}>{c.client||'—'}</div>
                      {c.nInterno && <div style={{ color:T.info, fontFamily:FONT, fontSize:9, fontWeight:600 }}>🔢 {c.nInterno}</div>}
                      {c.driver   && <div style={{ color:T.verde, fontFamily:FONT, fontSize:9, fontWeight:600 }}>👤 {c.driver}</div>}
                      <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:9 }}>📅 {c.startDate?c.startDate.split('-').reverse().join('/'):'—'}</div>
                      {c.origin&&c.destination && <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:9 }}>{c.origin} → {c.destination}</div>}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:5, flexShrink:0, flexWrap:'wrap', position:'relative', zIndex:1 }}>
        {Object.entries(CARD_TYPES).map(([k,v])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:3, background:v.color, borderRadius:2 }}/>
            <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{v.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MoveModal({ card, targetDate, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:420, boxShadow:T.shadowLg, border:`2px solid ${T.laranja}` }}>
        <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:17, marginTop:0 }}>⚠️ Justificar Remanejamento</h3>
        <p style={{ color:T.textSec, fontSize:13, fontFamily:FONT, margin:'0 0 13px' }}>
          Mover <strong style={{ color:T.laranja }}>{card?.client}</strong> para <strong>{fmt(targetDate)}</strong>.
        </p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo do reagendamento..."
          style={{ width:'100%', background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:FONT, boxSizing:'border-box', outline:'none', height:76, resize:'vertical' }}/>
        <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'8px 16px', cursor:'pointer', fontFamily:FONT, fontWeight:600, fontSize:12 }}>Cancelar</button>
          <button onClick={()=>reason.trim()&&onConfirm(reason)} disabled={!reason.trim()}
            style={{ background:reason.trim()?T.laranja:'#CCC', color:'white', border:'none', borderRadius:T.r, padding:'8px 16px', cursor:'pointer', fontFamily:FONT, fontWeight:700, fontSize:12 }}>Confirmar</button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── ConfirmModal — substitui window.confirm (item 18 da revisão) ────────────
// Uso: <ConfirmModal open={!!alvo} title="..." message="..." confirmLabel="Excluir"
//        danger onConfirm={...} onCancel={()=>setAlvo(null)}/>
export function ConfirmModal({ open, title='Confirmar ação', message, confirmLabel='Confirmar', cancelLabel='Cancelar', danger=false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    // zIndex 4000 — acima do maior zIndex de modal já usado no app (3500, ex:
    // DriversModal) de propósito: uma confirmação precisa SEMPRE renderizar
    // por cima de quem a chamou, senão fica escondida atrás do modal pai
    // (invisível/inclicável) quando aberta de dentro de um modal já no topo.
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.5)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div style={{ background:T.surface, borderRadius:T.rLg, padding:'22px 24px', width:380, maxWidth:'92vw', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:15, marginBottom:8 }}>{danger?'⚠️ ':''}{title}</div>
        {message && <div style={{ color:T.textSec, fontFamily:FONT, fontSize:12, lineHeight:1.5, marginBottom:18 }}>{message}</div>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onCancel}
            style={{ padding:'8px 16px', borderRadius:T.r, border:`1px solid ${T.border}`, background:T.surfaceAlt, color:T.textSec, fontFamily:FONT, fontWeight:700, fontSize:12, cursor:'pointer' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{ padding:'8px 16px', borderRadius:T.r, border:'none', background:danger?T.perigo:T.laranja, color:'white', fontFamily:FONT, fontWeight:800, fontSize:12, cursor:'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
