import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, CARD_TYPES } from '../lib/constants'

function KPICard({ title, value, sub, color, bg, icon, trend }) {
  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      style={{ background:bg||T.surface, border:`1px solid ${color}30`, borderRadius:T.rLg, padding:'15px 16px', boxShadow:T.shadow, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, right:0, width:4, height:'100%', background:color, borderRadius:'0 12px 12px 0' }}/>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:7 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        {trend!==undefined && trend!==null && (
          <span style={{ fontSize:10, fontFamily:FONT, fontWeight:800, color:trend>=0?T.sucesso:T.perigo, background:trend>=0?T.sucessoLight:T.perigoLight, borderRadius:20, padding:'2px 7px' }}>
            {trend>=0?'↑':'↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontFamily:FONT, fontWeight:900, fontSize:26, color, lineHeight:1, marginBottom:3 }}>{value}</div>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:10, color:T.text, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>{title}</div>
      {sub && <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{sub}</div>}
    </motion.div>
  )
}

function BarChart({ title, data, color }) {
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:'14px 16px', boxShadow:T.shadow }}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:10, color:T.text, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>{title}</div>
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
  let offset = 0
  const R=34, C=2*Math.PI*R
  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:'14px 16px', boxShadow:T.shadow }}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:10, color:T.text, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>{title}</div>
      <div style={{ display:'flex', gap:14, alignItems:'center' }}>
        <svg width="82" height="82" viewBox="0 0 82 82" style={{ flexShrink:0 }}>
          <circle cx="41" cy="41" r={R} fill="none" stroke={T.surfaceLow} strokeWidth="9"/>
          {data.map((d,i) => {
            const pct=d.value/total, dashLen=pct*C
            const el=<circle key={i} cx="41" cy="41" r={R} fill="none" stroke={d.color} strokeWidth="9"
              strokeDasharray={`${dashLen} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 41 41)" strokeLinecap="round"/>
            offset+=dashLen; return el
          })}
          <text x="41" y="46" textAnchor="middle" fontFamily="IBM Plex Sans,sans-serif" fontWeight="900" fontSize="13" fill={T.text}>{total}</text>
        </svg>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
          {data.map((d,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:9, height:9, borderRadius:3, background:d.color, flexShrink:0 }}/>
              <span style={{ fontFamily:FONT, fontSize:10, color:T.textSec, flex:1 }}>{d.label}</span>
              <span style={{ fontFamily:FONT, fontSize:10, fontWeight:800, color:T.text }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function KPIView({ cards, requests }) {
  const stats = useMemo(() => {
    const today     = new Date().toISOString().split('T')[0]
    const thisMonth = today.slice(0,7)
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().slice(0,7)

    const monthCards = cards.filter(c => c.startDate?.startsWith(thisMonth))
    const lastCards  = cards.filter(c => c.startDate?.startsWith(lastMonth))
    const total      = cards.length
    const late       = cards.filter(c => c.calendarStatus==='atrasado').length
    const onTime     = total - late
    const pctOnTime  = total ? Math.round((onTime/total)*100) : 0
    const remanejados = cards.filter(c => c.moveLog?.length > 0).length
    const pctAder    = total ? Math.round(((total-remanejados)/total)*100) : 0

    const byType = Object.entries(CARD_TYPES).map(([k,v]) => ({
      label: v.short, value: cards.filter(c=>c.type===k).length, color: v.color
    }))

    const driverMap = {}
    cards.forEach(c => { const d=c.driver||'Sem motorista'; driverMap[d]=(driverMap[d]||0)+1 })
    const byDriver = Object.entries(driverMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    const stateMap = {}
    cards.forEach(c => { const s=c.destState||c.destination; if(s) stateMap[s]=(stateMap[s]||0)+1 })
    const byState = Object.entries(stateMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    const filialMap = {}
    cards.forEach(c => { const f=c.unit; if(f) filialMap[f]=(filialMap[f]||0)+1 })
    const byFilial = Object.entries(filialMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k.replace(/ \(.*\)/,''),value:v}))

    // Tempo médio — só conta cards com datas diferentes (serviços com duração real)
    const cardsComDuracao = cards.filter(c => c.startDate && c.endDate && c.startDate !== c.endDate)
    let tempoMedio = '—'
    if (cardsComDuracao.length) {
      const totalDias = cardsComDuracao.reduce((s,c) => {
        const diff = (new Date(c.endDate) - new Date(c.startDate)) / 86400000
        return s + Math.max(0, diff)
      }, 0)
      tempoMedio = `${Math.round(totalDias / cardsComDuracao.length * 10) / 10}d`
    }

    // Rotas — prioriza cidade sobre estado
    const routeMap = {}
    cards.filter(c => c.origin && c.destination).forEach(c => {
      const origem  = c.originCityName || c.origin
      const destino = c.destCityName   || c.destination
      if (origem && destino && origem !== destino) {
        const k = `${origem} → ${destino}`
        routeMap[k] = (routeMap[k]||0) + 1
      }
    })
    const topRoutes = Object.entries(routeMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k,value:v}))

    const growthPct  = lastCards.length ? Math.round(((monthCards.length-lastCards.length)/lastCards.length)*100) : null
    const pendReq    = (requests||[]).filter(r=>r.status==='pendente').length
    const aceitoReq  = (requests||[]).filter(r=>r.status==='aceito').length
    const taxaAceit  = (requests||[]).length ? Math.round((aceitoReq/(requests||[]).length)*100) : 0

    return { total, late, onTime, pctOnTime, pctAder, remanejados, byType, byDriver, byState, byFilial, tempoMedio, topRoutes, monthCards, growthPct, pendReq, taxaAceit }
  }, [cards, requests])

  return (
    <div style={{ padding:'16px 20px', overflowY:'auto', height:'100%' }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontFamily:FONT, fontWeight:900, fontSize:18, color:T.text, margin:0 }}>📊 Indicadores de Performance</h2>
        <p style={{ fontFamily:FONT, fontSize:12, color:T.textMuted, margin:'3px 0 0' }}>Dados em tempo real · {stats.total} serviços · acesso exclusivo Master</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Total de Serviços"  value={stats.total}            icon="📋" color={T.laranja} bg={T.laranjaXLight} trend={stats.growthPct} sub="Todos os períodos"/>
        <KPICard title="No Prazo"           value={`${stats.pctOnTime}%`}  icon="✅" color={T.sucesso} bg={T.sucessoLight}  sub={`${stats.onTime}/${stats.total} serviços`}/>
        <KPICard title="Aderência"          value={`${stats.pctAder}%`}    icon="📅" color={T.verde}   bg={T.verdeLight}    sub={`${stats.remanejados} remanejamentos`}/>
        <KPICard title="Tempo Médio"        value={stats.tempoMedio}       icon="⏱" color={T.info}    bg={T.infoLight}     sub={stats.tempoMedio==='—' ? 'Dados insuficientes' : 'Duração por serviço'}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Atrasados"          value={stats.late}              icon="🔴" color={T.perigo}  bg={T.perigoLight}  sub={stats.late?'Requer atenção':'Tudo em dia 🎉'}/>
        <KPICard title="Mês Atual"          value={stats.monthCards.length} icon="📆" color={T.amarelo} bg={T.amareloLight} sub="Serviços no mês"/>
        <KPICard title="Solicitações Pend." value={stats.pendReq}           icon="📥" color="#6A1B9A"   bg="#F3E5F5"        sub="Aguardando resposta"/>
        <KPICard title="Taxa de Aceite"     value={`${stats.taxaAceit}%`}   icon="🤝" color={T.sucesso} bg={T.sucessoLight} sub="Solicitações aceitas"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        <DonutChart title="Por tipo de serviço" data={stats.byType}/>
        <BarChart   title="Por motorista"       data={stats.byDriver} color={T.laranja}/>
        <BarChart   title="Por estado destino"  data={stats.byState}  color={T.verde}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <BarChart title="Por filial de origem"  data={stats.byFilial}  color={T.info}/>
        <BarChart title="Rotas mais frequentes" data={stats.topRoutes} color={T.laranjaDeep}/>
      </div>

      {stats.total===0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontFamily:FONT, marginTop:20 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>📊</div>
          <p>Os indicadores serão calculados automaticamente conforme os serviços forem inseridos.</p>
        </div>
      )}
    </div>
  )
}
