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
        {trend!==undefined&&trend!==null && (
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
    const hoje      = new Date().toISOString().split('T')[0]
    const thisMonth = hoje.slice(0,7)
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().slice(0,7)

    // Base pra todas as métricas agregadas — cancelado nunca deve inflar volume,
    // distribuição por motorista/filial/rota, nem comparativo mensal.
    // cardsValidos: base histórica — inclui concluídos, exclui cancelados.
    // Usado para métricas de volume, por tipo, por motorista, rotas (dados históricos completos).
    const cardsValidos = cards.filter(c => c.status !== 'cancelado')
    // cardsAtivos: só o que está em execução — para métricas operacionais (atrasados, prazo).
    const cardsAtivos  = cardsValidos.filter(c => c.status !== 'concluido')

    const monthCards = cardsValidos.filter(c=>c.startDate?.startsWith(thisMonth))
    const lastCards  = cardsValidos.filter(c=>c.startDate?.startsWith(lastMonth))
    const total      = cardsValidos.length

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
      label:v.short, value:cardsValidos.filter(c=>c.type===k).length, color:v.color
    }))

    const driverMap={}
    cardsValidos.forEach(c=>{ const d=c.driver||'Sem motorista'; driverMap[d]=(driverMap[d]||0)+1 })
    const byDriver = Object.entries(driverMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    // Cidade destino — prioriza cidade, cai em estado só se não tiver cidade
    const cityMap={}
    cardsValidos.forEach(c=>{
      const cidade = c.destCity || c.destCityName || c.destState || c.destination
      if (cidade) cityMap[cidade]=(cityMap[cidade]||0)+1
    })
    const byState = Object.entries(cityMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,value:v}))

    const filialMap={}
    cardsValidos.forEach(c=>{ const f=c.unit; if(f) filialMap[f]=(filialMap[f]||0)+1 })
    const byFilial = Object.entries(filialMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k.replace(/ \(.*\)/,''),value:v}))

    // Tempo médio — só conta cards com datas DIFERENTES e não cancelados
    const cardsComDuracao = cardsValidos.filter(c=>
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
    cardsValidos.filter(c=>c.origin&&c.destination).forEach(c=>{
      const origem  = c.originCity || c.originCityName || c.origin
      const destino = c.destCity   || c.destCityName   || c.destination
      if (origem && destino && origem !== destino) {
        const k=`${origem} → ${destino}`
        routeMap[k]=(routeMap[k]||0)+1
      }
    })
    const topRoutes = Object.entries(routeMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({label:k,value:v}))

    const growthPct = lastCards.length ? Math.round(((monthCards.length-lastCards.length)/lastCards.length)*100) : null
    const pendReq   = (requests||[]).filter(r=>r.status==='pendente').length
    const aceitoReq = (requests||[]).filter(r=>r.status==='aceito').length
    const reqValidas = (requests||[]).filter(r=>r.status!=='cancelado').length
    const taxaAceit = reqValidas ? Math.round((aceitoReq/reqValidas)*100) : 0

    return { total,totalAtivos,late,onTime,pctOnTime,pctAder,remanejados,byType,byDriver,byState,byFilial,tempoMedio,topRoutes,monthCards,growthPct,pendReq,taxaAceit }
  }, [cards, requests])

  return (
    <div style={{ padding:'16px 20px', overflowY:'auto', height:'100%' }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontFamily:FONT, fontWeight:900, fontSize:18, color:T.text, margin:0 }}>📊 Indicadores de Performance</h2>
        <p style={{ fontFamily:FONT, fontSize:12, color:T.textMuted, margin:'3px 0 0' }}>Dados em tempo real · {stats.total} serviços · acesso exclusivo Master</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Total de Serviços"  value={stats.total}            icon="📋" color={T.laranja} bg={T.laranjaXLight} trend={stats.growthPct} sub="Todos os períodos"/>
        <KPICard title="No Prazo"           value={`${stats.pctOnTime}%`}  icon="✅" color={T.sucesso} bg={T.sucessoLight}  sub={`${stats.onTime}/${stats.totalAtivos} em aberto`}/>
        <KPICard title="Aderência"          value={`${stats.pctAder}%`}    icon="📅" color={T.verde}   bg={T.verdeLight}    sub={`${stats.remanejados} remanejamentos`}/>
        <KPICard title="Tempo Médio"        value={stats.tempoMedio}       icon="⏱" color={T.info}    bg={T.infoLight}     sub={stats.tempoMedio==='—'?'Serviços de 1 dia não contam':'Duração por serviço'}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        <KPICard title="Atrasados"          value={stats.late}              icon="🔴" color={T.perigo}  bg={T.perigoLight}  sub={stats.late?'endDate < hoje, não concluídos':'Tudo em dia 🎉'}/>
        <KPICard title="Mês Atual"          value={stats.monthCards.length} icon="📆" color={T.amarelo} bg={T.amareloLight} sub="Serviços no mês"/>
        <KPICard title="Solicitações Pend." value={stats.pendReq}           icon="📥" color={T.laranjaDeep} bg="#FDEEE9"        sub="Aguardando resposta"/>
        <KPICard title="Taxa de Aceite"     value={`${stats.taxaAceit}%`}   icon="🤝" color={T.sucesso} bg={T.sucessoLight} sub="Solicitações aceitas"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        <DonutChart title="Por tipo de serviço" data={stats.byType}/>
        <BarChart   title="Por motorista"       data={stats.byDriver} color={T.laranja}/>
        <BarChart   title="Por cidade destino"  data={stats.byState}  color={T.verde}/>
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
