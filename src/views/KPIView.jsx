import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, CARD_TYPES, URGENCY, BS, SHADOW_CARD, BORDER_SUBTLE } from '../lib/constants'
import { resumirEmissoes } from '../lib/emissoes'
import { todayStr, getWeekDays } from '../lib/utils'

// Sombra "enterprise" em duas camadas — usada em todos os cards da tela
// (KPICard, BarChart, DonutChart, ranking, gráfico de dias) pra dar
// consistência visual, em vez do T.shadow simples de antes.
function Sparkline({ points, color }) {
  const max = Math.max(...points, 1), min = Math.min(...points, 0)
  const range = (max - min) || 1
  const coords = points.map((v,i) => `${(i/(points.length-1||1))*42},${16 - ((v-min)/range)*14}`).join(' ')
  return (
    <svg width="38" height="16" viewBox="0 0 42 18">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

function KPICard({ title, value, sub, color, bg, icon, trend, onClick, sparkline }) {
  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} onClick={onClick}
      style={{ background:bg||T.surface, border:T.borderSubtle, borderRadius:16, boxShadow:T.shadowCard, padding:'13px 15px', position:'relative', overflow:'hidden', cursor:onClick?'pointer':'default' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:9.5, fontWeight:600, letterSpacing:'-.01em' }}>{icon} {title}</span>
        {onClick && <span style={{ color:T.textMuted, fontSize:10 }}>↗</span>}
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, marginBottom:4 }}>
        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:22, letterSpacing:'-.02em', color, lineHeight:1 }}>{value}</span>
        {sparkline?.length > 1 && <Sparkline points={sparkline} color={color}/>}
      </div>
      {trend!==undefined&&trend!==null && (
        <span style={{ fontSize:9, fontFamily:FONT, fontWeight:700, color:trend>=0?T.sucesso:T.perigo, background:trend>=0?T.sucessoLight:T.perigoLight, borderRadius:20, padding:'2px 8px' }}>
          {trend>=0?'▲':'▼'} {Math.abs(trend)}%
        </span>
      )}
      {sub && !trend && <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{sub}</div>}
    </motion.div>
  )
}

function BarChart({ title, data, color }) {
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ background:T.surface, borderRadius:16, border:T.borderSubtle, padding:'16px 18px', boxShadow:T.shadowCard }}>
      <div style={{ fontFamily:FONT, fontWeight:600, fontSize:11.5, color:T.text, letterSpacing:'-.01em', marginBottom:12 }}>{title}</div>
      {data.length===0 && <div style={{ color:T.textMuted, fontSize:12, fontFamily:FONT, textAlign:'center', padding:'12px 0' }}>Sem dados</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {data.map((d,i) => (
          <div key={i}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontFamily:FONT, fontSize:11, color:T.textSec, maxWidth:'70%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
              <span style={{ fontFamily:FONT, fontSize:11, fontWeight:800, color }}>{d.value}</span>
            </div>
            <div style={{ height:7, background:T.surfaceLow, borderRadius:10, overflow:'hidden' }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${(d.value/max)*100}%` }}
                transition={{ delay:i*0.05, duration:.5, ease:'easeOut' }}
                style={{ height:'100%', background:color, borderRadius:10 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ title, data }) {
  const total = data.reduce((s,d)=>s+d.value,0)||1
  const R=34, C=2*Math.PI*R
  // Offsets pré-calculados — mutar acumulador dentro do .map no JSX é frágil
  // (quebra com StrictMode double-render e é flagrado pelo lint de hooks)
  const segs = []
  let acc = 0
  for (const d of data) { const dashLen = d.value/total*C; segs.push({ ...d, dashLen, offset: acc }); acc += dashLen }
  return (
    <div style={{ background:T.surface, borderRadius:16, border:T.borderSubtle, padding:'16px 18px', boxShadow:T.shadowCard }}>
      <div style={{ fontFamily:FONT, fontWeight:600, fontSize:11.5, color:T.text, letterSpacing:'-.01em', marginBottom:12 }}>{title}</div>
      <div style={{ display:'flex', gap:14, alignItems:'center' }}>
        <svg width="82" height="82" viewBox="0 0 82 82" style={{ flexShrink:0 }}>
          <circle cx="41" cy="41" r={R} fill="none" stroke={T.surfaceLow} strokeWidth="9"/>
          {segs.map((d,i) => (
            <circle key={i} cx="41" cy="41" r={R} fill="none" stroke={d.color} strokeWidth="9"
              strokeDasharray={`${d.dashLen} ${C}`} strokeDashoffset={-d.offset} transform="rotate(-90 41 41)" strokeLinecap="round"/>
          ))}
          <text x="41" y="39" textAnchor="middle" fontFamily="IBM Plex Sans,sans-serif" fontWeight="700" fontSize="14" fill={T.text}>{total}</text>
          <text x="41" y="49" textAnchor="middle" fontFamily="IBM Plex Sans,sans-serif" fontSize="6.5" fill={T.textMuted}>total</text>
        </svg>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          {data.map((d,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0 }}/>
              <span style={{ fontFamily:FONT, fontSize:10.5, color:T.text, fontWeight:600, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.label}</span>
              <span style={{ fontFamily:FONT, fontSize:10.5, fontWeight:700, color:T.textMuted }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Ranking top 5 com posição numerada + barra proporcional — usado pro
// "Top motoristas". Diferente do BarChart genérico: aqui a posição (1º,
// 2º...) importa visualmente, não só o valor.
function RankingList({ title, data }) {
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ background:T.surface, borderRadius:16, border:T.borderSubtle, padding:'16px 18px', boxShadow:T.shadowCard }}>
      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11.5, color:T.text, marginBottom:12 }}>{title}</div>
      {data.length===0 && <div style={{ color:T.textMuted, fontSize:12, fontFamily:FONT, textAlign:'center', padding:'12px 0' }}>Sem dados</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        {data.slice(0,5).map((d,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontFamily:FONT, fontSize:10.5, color:T.textMuted, fontWeight:700, width:14 }}>{i+1}</span>
            <span style={{ fontFamily:FONT, fontSize:11, color:T.text, fontWeight:600, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.label}</span>
            <div style={{ width:80, height:6, background:T.surfaceLow, borderRadius:3, overflow:'hidden', flexShrink:0 }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${(d.value/max)*100}%` }}
                transition={{ delay:i*0.05, duration:.5, ease:'easeOut' }}
                style={{ height:'100%', background:T.laranja }}/>
            </div>
            <span style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, fontWeight:700, width:14, textAlign:'right' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// "Serviços por dia" — últimos 7 dias com uma linha tracejada de meta
// (média do período, arredondada) cruzando o gráfico. Dia com o maior
// volume vira laranja, o resto verde-escuro — mesmo padrão do mockup.
function DayChart({ title, dias, meta }) {
  const max = Math.max(...dias.map(d=>d.value), meta, 1)
  const idxMax = dias.reduce((best,d,i)=> d.value>dias[best].value ? i : best, 0)
  const metaTopo = 100 - (meta/max)*100
  return (
    <div style={{ background:T.surface, borderRadius:16, border:T.borderSubtle, padding:'16px 18px', boxShadow:T.shadowCard }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text }}>{title}</span>
        <span style={{ fontFamily:FONT, fontSize:9.5, color:T.textMuted }}>Meta: {meta}/dia ┄</span>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:64, position:'relative' }}>
        <div style={{ position:'absolute', top:`${metaTopo}%`, left:0, right:0, borderTop:`1px dashed ${T.laranja}` }}/>
        {dias.map((d,i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
            <div style={{ width:'100%', background:d.value===0?T.border:(i===idxMax?T.laranja:T.verde), borderRadius:'4px 4px 0 0', height:Math.max(2,(d.value/max)*64) }}/>
            <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KPIView({ cards, requests, simClients, onNavigateToAprovacoes }) {
  // Filtro por unidade — chips no topo, recalcula tudo abaixo. 'todas' não
  // filtra nada (comportamento igual ao de antes de existir esse filtro).
  const [unidadeFiltro, setUnidadeFiltro] = useState('todas')
  // 3 opções — antes era só semana/mês, e mesmo assim só um card ("Total de
  // Serviços") realmente respeitava a escolha; todo o resto da tela sempre
  // mostrava o acumulado, sem ligação nenhuma com o toggle (pedido explícito
  // do usuário pra corrigir: "todos os indicadores" precisam seguir o
  // período, com Acumulado como padrão ao abrir a tela).
  const [periodo, setPeriodo] = useState('acumulado') // 'acumulado' | 'mes' | 'semana'
  const unidadesDisponiveis = useMemo(() =>
    ['todas', ...Array.from(new Set(cards.map(c=>c.unit).filter(Boolean))).sort()]
  , [cards])
  const cardsFiltrados = useMemo(() =>
    unidadeFiltro==='todas' ? cards : cards.filter(c=>c.unit===unidadeFiltro)
  , [cards, unidadeFiltro])

  // Dataset efetivo do período selecionado — base de TODOS os indicadores
  // agregados/históricos da tela (cards numéricos, gráficos de distribuição
  // e emissão de carbono). Duas seções ficam de fora de propósito, não por
  // esquecimento: "Cenário Operacional Agora" é sempre o estado ATUAL da
  // operação (em execução/aguardando validação agora mesmo — não existe
  // "em execução na semana passada", é um status, não um evento com data),
  // e "Serviços por dia" é sempre a tendência dos últimos 7 dias corridos
  // (um gráfico diário não cabe olhando o acumulado inteiro).
  const { cardsPeriodo, periodoInfo } = useMemo(() => {
    const hoje      = todayStr()
    const thisMonth = hoje.slice(0,7)
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().slice(0,7)
    const cardsValidos = cardsFiltrados.filter(c => c.status !== 'cancelado')

    const monthCards = cardsValidos.filter(c=>c.startDate?.startsWith(thisMonth))
    const lastCards  = cardsValidos.filter(c=>c.startDate?.startsWith(lastMonth))

    // Comparativo semana atual vs. anterior — mesma lógica do comparativo
    // mensal (membership no período, não "até hoje"), só que na janela
    // segunda–domingo já usada pelo resto do app (getWeekDays).
    const thisWeekDays = getWeekDays(hoje)
    const lastWeekStartDate = new Date(thisWeekDays[0]); lastWeekStartDate.setDate(lastWeekStartDate.getDate()-7)
    const lastWeekDays = getWeekDays(lastWeekStartDate.toISOString().split('T')[0])
    const weekCards     = cardsValidos.filter(c=>c.startDate>=thisWeekDays[0] && c.startDate<=thisWeekDays[6])
    const lastWeekCards = cardsValidos.filter(c=>c.startDate>=lastWeekDays[0] && c.startDate<=lastWeekDays[6])

    const porPeriodo = periodo==='semana' ? weekCards : periodo==='mes' ? monthCards : cardsValidos
    const growthPct       = lastCards.length     ? Math.round(((monthCards.length-lastCards.length)/lastCards.length)*100) : null
    const growthPctSemana = lastWeekCards.length ? Math.round(((weekCards.length-lastWeekCards.length)/lastWeekCards.length)*100) : null
    return {
      cardsPeriodo: porPeriodo,
      periodoInfo: {
        trend: periodo==='semana' ? growthPctSemana : periodo==='mes' ? growthPct : null,
        sub: periodo==='semana' ? `vs. ${lastWeekCards.length} na semana anterior`
           : periodo==='mes'    ? `vs. ${lastCards.length} no mês anterior`
           : 'Acumulado (últimos 180 dias)',
        // Mês corrente sempre (independente do toggle) — mantém o card "Mês
        // Atual" com o MESMO significado fixo de sempre, pra não remover/
        // mudar um card que já existia sem isso ter sido pedido.
        mesAtualCount: monthCards.length,
      },
    }
  }, [cardsFiltrados, periodo])

  // Emissão de CO2 (Escopo 1/3) — dado enviado ao time de Meio Ambiente da
  // Mills pra divulgação externa. Ver src/lib/emissoes.js: consumo médio por
  // veículo ainda marcado "a confirmar" com o time de Meio Ambiente.
  const emissoes = useMemo(() => resumirEmissoes(cardsPeriodo, simClients), [cardsPeriodo, simClients])

  const stats = useMemo(() => {
    const hoje = todayStr()
    // cardsAtivos: só o que está em execução (dentro do período escolhido) —
    // para métricas operacionais (atrasados, prazo, aderência).
    const cardsAtivos = cardsPeriodo.filter(c => c.status !== 'concluido')
    const total = cardsPeriodo.length

    // Últimos 7 dias — sempre a tendência diária corrida, independente do
    // período escolhido no toggle (ver comentário em cardsPeriodo acima:
    // um gráfico dia-a-dia não cabe olhando o acumulado inteiro). Por isso
    // usa cardsFiltrados (só unidade) direto, não cardsPeriodo.
    const cardsValidos = cardsFiltrados.filter(c => c.status !== 'cancelado')
    const diasSemana = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dataStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const label = ['D','S','T','Q','Q','S','S'][d.getDay()]
      diasSemana.push({ label, value: cardsValidos.filter(c=>c.startDate===dataStr).length })
    }
    const metaDia = Math.max(1, Math.round(diasSemana.reduce((a,d)=>a+d.value,0) / 7))
    const sparklineServicos = diasSemana.map(d=>d.value)

    // Atrasado = card ativo com endDate < hoje (concluídos e cancelados não contam)
    const late = cardsAtivos.filter(c =>
      c.endDate && c.endDate < hoje
    ).length

    const totalAtivos = cardsAtivos.length
    const onTime      = totalAtivos - late
    const pctOnTime   = totalAtivos ? Math.round((onTime/totalAtivos)*100) : 0
    const remanejados = cardsAtivos.filter(c=>c.moveLog?.length>0).length
    const pctAder     = totalAtivos ? Math.round(((totalAtivos-remanejados)/totalAtivos)*100) : 0

    const byType = Object.entries(CARD_TYPES).map(([k,v])=>({
      label:v.short, value:cardsPeriodo.filter(c=>c.type===k).length, color:v.color
    }))

    const driverMap={}
    cardsPeriodo.forEach(c=>{ const d=c.driver||'Sem motorista'; driverMap[d]=(driverMap[d]||0)+1 })
    const byDriver = Object.entries(driverMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    // Cidade destino — prioriza cidade, cai em estado só se não tiver cidade
    const cityMap={}
    cardsPeriodo.forEach(c=>{
      const cidade = c.destCity || c.destCityName || c.destState || c.destination
      if (cidade) cityMap[cidade]=(cityMap[cidade]||0)+1
    })
    const byState = Object.entries(cityMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    const filialMap={}
    cardsPeriodo.forEach(c=>{ const f=c.unit; if(f) filialMap[f]=(filialMap[f]||0)+1 })
    const byFilial = Object.entries(filialMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k.replace(/ \(.*\)/,''),value:v}))

    // Tempo médio — só conta cards com datas DIFERENTES e não cancelados
    const cardsComDuracao = cardsPeriodo.filter(c=>
      c.startDate && c.endDate &&
      c.startDate !== c.endDate
    )
    let tempoMedio = '—'
    if (cardsComDuracao.length) {
      const totalDias = cardsComDuracao.reduce((s,c)=>{
        const diff=(new Date(c.endDate)-new Date(c.startDate))/86400000
        return s+Math.max(0,diff)
      },0)
      tempoMedio = `${Math.round(totalDias/cardsComDuracao.length*10)/10}d`
    }

    // Rotas — cidade × cidade, exclui mesmo ponto
    const routeMap={}
    cardsPeriodo.filter(c=>c.origin&&c.destination).forEach(c=>{
      const origem  = c.originCity || c.originCityName || c.origin
      const destino = c.destCity   || c.destCityName   || c.destination
      if (origem && destino && origem !== destino) {
        const k=`${origem} → ${destino}`
        routeMap[k]=(routeMap[k]||0)+1
      }
    })
    const topRoutes = Object.entries(routeMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k,value:v}))

    const pendReq   = (requests||[]).filter(r=>r.status==='pendente').length
    const aceitoReq = (requests||[]).filter(r=>r.status==='aceito').length
    const reqValidas = (requests||[]).filter(r=>r.status!=='cancelado').length
    const taxaAceit = reqValidas ? Math.round((aceitoReq/reqValidas)*100) : 0

    // ── Cenário operacional AGORA — o que Rafael mais precisa ver de cara:
    // não é histórico, é "o que está rolando com a equipe neste exato
    // momento" — por isso sempre cardsFiltrados (só unidade), nunca
    // cardsPeriodo: não existe "em execução na semana passada", execução é
    // um status atual, não um evento com data pra filtrar por período.
    // Achado de auto-revisão: atrasadosAgora usava cardsAtivos (que agora
    // SEGUE o toggle de período, corretamente, pros cards de KPI como "No
    // Prazo"/SLA) — reaproveitar a mesma variável aqui fazia um serviço
    // atrasado de verdade sumir dessa lista sempre que o toggle não estava
    // em "Acumulado", contradizendo a intenção deste painel (sempre atual).
    // Usa seu próprio conjunto, independente do período.
    const cardsAtivosAgora  = cardsFiltrados.filter(c => c.status!=='cancelado' && c.status!=='concluido')
    const emExecucao        = cardsFiltrados.filter(c=>c.status==='em_execucao').length
    const aguardandoValid   = cardsFiltrados.filter(c=>c.status==='aguardando_validacao').length
    const interrompidos     = cardsFiltrados.filter(c=>c.status==='interrompido').length
    const atrasadosAgora    = cardsAtivosAgora.filter(c => c.endDate && c.endDate < hoje)
      .sort((a,b)=>a.endDate.localeCompare(b.endDate)).slice(0,6)
      .map(c=>({ cliente:c.client||'—', driver:c.driver||'—', dias:Math.max(0,Math.round((new Date(hoje)-new Date(c.endDate))/86400000)) }))

    // SLA por urgência — hoje só existe um "on-time %" geral, misturando
    // crítico com baixo. Separado por faixa, fica claro se os serviços que
    // mais importam (crítico/alto) estão sendo cumpridos, mesmo que a média
    // geral pareça boa.
    const slaPorUrgencia = ['critico','alto','medio','baixo'].map(u => {
      const doGrupo = cardsAtivos.filter(c=>c.urgency===u)
      const noPrazo = doGrupo.filter(c => !(c.endDate && c.endDate < hoje))
      return {
        urgencia: u,
        total: doGrupo.length,
        pctOnTime: doGrupo.length ? Math.round((noPrazo.length/doGrupo.length)*100) : null,
      }
    })

    return { total,totalAtivos,late,onTime,pctOnTime,pctAder,remanejados,byType,byDriver,byState,byFilial,tempoMedio,topRoutes,pendReq,taxaAceit,
      emExecucao,aguardandoValid,interrompidos,atrasadosAgora,slaPorUrgencia,diasSemana,metaDia,sparklineServicos }
  }, [cardsFiltrados, cardsPeriodo, requests])

  const painelRef = useRef(null)
  const [exportandoImg, setExportandoImg] = useState(false)
  const handleExportarImagem = async () => {
    setExportandoImg(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(painelRef.current, { backgroundColor:'#F9F6F1', scale:2 })
      const link = document.createElement('a')
      link.download = `mills-indicadores_${todayStr()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Erro ao exportar imagem do painel:', err)
    } finally {
      setExportandoImg(false)
    }
  }

  return (
    <div ref={painelRef} style={{ padding:'16px 20px', overflowY:'auto', height:'100%', background:T.bgCold }}>
      <div style={{ marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h2 style={{ fontFamily:FONT, fontWeight:900, fontSize:18, color:T.text, margin:0 }}>📊 Indicadores de Performance</h2>
          <p style={{ fontFamily:FONT, fontSize:12, color:T.textMuted, margin:'3px 0 0' }}>Dados em tempo real · {stats.total} serviços</p>
        </div>
        <button onClick={handleExportarImagem} disabled={exportandoImg}
          style={{ ...BS, background:T.surface, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
          {exportandoImg ? '⏳ Gerando...' : '📷 Exportar imagem'}
        </button>
      </div>

      {unidadesDisponiveis.length > 2 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          {unidadesDisponiveis.map(u => (
            <button key={u} onClick={()=>setUnidadeFiltro(u)}
              style={{ ...BS, background:unidadeFiltro===u?'#1A1612':'#fff', color:unidadeFiltro===u?'white':'#4A3F35', border:`1px solid ${unidadeFiltro===u?'#1A1612':'rgba(26,22,18,.08)'}`, fontSize:10.5, fontWeight:unidadeFiltro===u?700:600, padding:'5px 12px' }}>
              {u==='todas' ? 'Todas as unidades' : u}
            </button>
          ))}
        </div>
      )}

      {/* Acumulado/Mês/Semana — decide o período de TODOS os indicadores
          abaixo (exceto Cenário Operacional Agora, que é sempre o estado
          atual, e o gráfico "Serviços por dia", sempre os últimos 7 dias
          corridos — ver comentário em cardsPeriodo). Acumulado é o padrão
          ao abrir a tela. */}
      <div style={{ background:'#fff', border:'1px solid rgba(26,22,18,.08)', borderRadius:8, display:'flex', padding:2, gap:2, width:'fit-content', marginBottom:14 }}>
        {['acumulado','mes','semana'].map(p => (
          <button key={p} onClick={()=>setPeriodo(p)}
            style={{ padding:'4px 10px', borderRadius:6, background:periodo===p?T.laranja:'transparent', color:periodo===p?'white':T.textMuted, fontSize:9.5, fontWeight:700, border:'none', cursor:'pointer', fontFamily:FONT }}>
            {p==='acumulado'?'Acumulado':p==='mes'?'Mês':'Semana'}
          </button>
        ))}
      </div>

      {/* Cenário operacional AGORA — visão rápida do que está rolando com a
          equipe neste momento, não histórico. Pensado pra quem acompanha a
          operação (ex: gestão regional) sem precisar entrar em cada tela
          operacional pra montar esse panorama sozinho. */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:T.text, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
          🟢 Cenário Operacional Agora
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
          <KPICard title="Em Execução"          value={stats.emExecucao}      icon="🚛" color={T.info}    bg={T.infoLight}    sub="Motoristas em rota agora"/>
          <KPICard title="Aguardando Validação"  value={stats.aguardandoValid} icon="📋" color={T.laranja} bg={T.laranjaXLight} sub="Concluídos pelo motorista, faltando conferir"/>
          <KPICard title="Interrompidos"         value={stats.interrompidos}   icon="⏸"  color={T.perigo}  bg={T.perigoLight}  sub="Parados em campo, aguardando retomada"/>
          <KPICard title="Solicitações Pendentes" value={stats.pendReq}        icon="📥" color={T.verde}   bg={T.verdeLight}   sub="Aguardando atribuição de motorista"/>
        </div>
        {stats.atrasadosAgora.length > 0 && (
          <div style={{ background:T.perigoLight, borderRadius:T.r, padding:'10px 14px', border:`1px solid ${T.perigo}30` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:6 }}>⚠️ Serviços atrasados agora mesmo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {stats.atrasadosAgora.map((a,i) => (
                <div key={i} style={{ fontFamily:FONT, fontSize:11, color:T.textSec, display:'flex', justifyContent:'space-between' }}>
                  <span>{a.cliente} · {a.driver}</span>
                  <span style={{ fontWeight:700, color:T.perigo }}>{a.dias}d de atraso</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SLA por urgência — antes só existia um "no prazo %" geral, misturando
          crítico com baixo. Aqui separa por faixa, então dá pra ver se os
          serviços que mais importam estão realmente sendo cumpridos, mesmo
          que a média geral pareça boa. */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:T.text, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
          🎯 SLA por Urgência
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {stats.slaPorUrgencia.map(s => {
            const u = URGENCY[s.urgencia]
            return (
              <div key={s.urgencia} style={{ background:T.surface, border:BORDER_SUBTLE, borderRadius:14, padding:'12px 14px', boxShadow:SHADOW_CARD }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <span>{u.icon}</span>
                  <span style={{ fontFamily:FONT, fontWeight:700, fontSize:11, color:T.text }}>{u.label}</span>
                </div>
                <div style={{ fontFamily:FONT, fontWeight:900, fontSize:20, color:s.pctOnTime===null?T.textMuted:(s.pctOnTime>=80?T.sucesso:s.pctOnTime>=50?T.laranja:T.perigo) }}>
                  {s.pctOnTime===null ? '—' : `${s.pctOnTime}%`}
                </div>
                <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{s.total} em aberto</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Total de Serviços"
          value={stats.total}
          icon="📋" color={T.laranja} bg={T.laranjaXLight}
          trend={periodoInfo.trend}
          sub={periodoInfo.sub}
          sparkline={stats.sparklineServicos}/>
        <KPICard title="No Prazo"           value={`${stats.pctOnTime}%`}  icon="✅" color={T.sucesso} bg={T.sucessoLight}  sub={`${stats.onTime}/${stats.totalAtivos} em aberto`}/>
        <KPICard title="Aderência"          value={`${stats.pctAder}%`}    icon="📅" color={T.verde}   bg={T.verdeLight}    sub={`${stats.remanejados} remanejamentos`}/>
        <KPICard title="Tempo Médio"        value={stats.tempoMedio}       icon="⏱" color={T.info}    bg={T.infoLight}     sub={stats.tempoMedio==='—'?'Serviços de 1 dia não contam':'Duração por serviço'}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Atrasados"          value={stats.late}              icon="🔴" color={T.perigo}  bg={T.perigoLight}  sub={stats.late?(onNavigateToAprovacoes?'Clique pra ver na fila de aprovações':'endDate < hoje, não concluídos'):'Tudo em dia 🎉'}
          onClick={stats.late && onNavigateToAprovacoes ? onNavigateToAprovacoes : undefined}/>
        <KPICard title="Mês Atual"          value={periodoInfo.mesAtualCount} icon="📆" color={T.amarelo} bg={T.amareloLight} sub="Serviços no mês (fixo, não segue o toggle acima)"/>
        <KPICard title="Solicitações Pend." value={stats.pendReq}           icon="📥" color={T.laranjaDeep} bg="#FDEEE9"        sub="Aguardando resposta"/>
        <KPICard title="Taxa de Aceite"     value={`${stats.taxaAceit}%`}   icon="🤝" color={T.sucesso} bg={T.sucessoLight} sub="Solicitações aceitas"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        <DonutChart title="Por tipo de serviço" data={stats.byType}/>
        <RankingList title="🏆 Top motoristas"   data={stats.byDriver}/>
        <BarChart   title="Por cidade destino"  data={stats.byState}  color={T.verde}/>
      </div>

      <div style={{ marginBottom:10 }}>
        <DayChart title="Serviços por dia" dias={stats.diasSemana} meta={stats.metaDia}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <BarChart title="Por filial de origem"  data={stats.byFilial}  color={T.info}/>
        <BarChart title="Rotas mais frequentes" data={stats.topRoutes} color={T.laranjaDeep}/>
      </div>

      <div style={{ marginTop:14 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:T.text, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
          🌱 Emissão de Carbono <span style={{ color:T.textMuted, fontWeight:500, textTransform:'none', letterSpacing:'normal' }}>— para o time de Meio Ambiente</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          <KPICard title="Emissão Total"    value={`${emissoes.totalEmissaoKg.toLocaleString('pt-BR')} kg`} icon="🌍" color={T.verde}   bg={T.verdeLight}   sub="CO2 — serviços concluídos"/>
          <KPICard title="Escopo 1"         value={`${emissoes.escopo1Kg.toLocaleString('pt-BR')} kg`}      icon="🚛" color={T.info}     bg={T.infoLight}    sub="Frota própria (Motorista Mills)"/>
          <KPICard title="Escopo 3"         value={`${emissoes.escopo3Kg.toLocaleString('pt-BR')} kg`}      icon="📦" color={T.laranja}  bg={T.laranjaLight} sub="Transportadora terceirizada"/>
          <KPICard title="Sem Dado"         value={emissoes.servicosSemDado}                                icon="⚠️" color={T.perigo}   bg={T.perigoLight}  sub="Serviços sem km ou consumo cadastrado"/>
        </div>
      </div>

      {stats.total===0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT, marginTop:20 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>{unidadeFiltro!=='todas' ? '🔍' : '📊'}</div>
          <p>
            {unidadeFiltro!=='todas'
              ? `Nenhum serviço encontrado para "${unidadeFiltro}" no período.`
              : 'Os indicadores serão calculados automaticamente conforme os serviços forem inseridos.'}
          </p>
          {unidadeFiltro!=='todas' && (
            <button onClick={()=>setUnidadeFiltro('todas')}
              style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}40`, fontSize:11, fontWeight:700, marginTop:10 }}>
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}
