import { useState } from 'react'
import { BRAZIL_PATHS } from '../lib/brazilPaths'
import { T, FONT, CARD_TYPES } from '../lib/constants'
import { MillsPattern } from './UI'

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

export function BrazilMap({ cards }) {
  const [hov, setHov] = useState(null)
  const cnt = {}; const types = {}

  cards.forEach(c => {
    ;[toSigla(c.originState||c.origin), toSigla(c.destState||c.destination)].filter(Boolean).forEach(s => {
      if (s.length > 2) return
      cnt[s]=(cnt[s]||0)+1
      if(!types[s]) types[s]=new Set()
      types[s].add(c.type)
    })
  })

  const routes = {}
  cards.filter(c=>(c.originState||c.origin)&&(c.destState||c.destination)).forEach(c=>{
    const o=toSigla(c.originState||c.origin), d=toSigla(c.destState||c.destination)
    if(o===d || o.length>2 || d.length>2) return
    const k=[o,d].sort().join('-')
    if(!routes[k]) routes[k]=[]
    routes[k].push(c)
  })

  const getFill = id => {
    const n = cnt[id]||0
    if(!n)    return '#E8F0EE'
    if(n===1) return 'rgba(243,112,33,0.35)'
    if(n<=3)  return 'rgba(243,112,33,0.65)'
    return           'rgba(194,64,3,0.88)'
  }

  return (
    <div style={{ background:T.surface, borderRadius:T.rLg, border:`1px solid ${T.border}`, padding:'12px 14px', height:'100%', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', boxShadow:T.shadow }}>
      <MillsPattern opacity={0.04} color={T.laranja}/>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, position:'relative', zIndex:1, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontFamily:FONT, fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:T.text }}>🗺 Operações Ativas</span>
          {Object.keys(cnt).length>0 && (
            <span style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}50`, borderRadius:20, padding:'1px 7px', color:T.laranja, fontSize:9, fontWeight:700, fontFamily:FONT }}>
              {Object.keys(cnt).length} estados
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[
            {f:'#E8F0EE',    s:'#004042', l:'0'},
            {f:'rgba(243,112,33,0.35)', s:'#F37021', l:'1'},
            {f:'rgba(243,112,33,0.65)', s:'#C24003', l:'2–3'},
            {f:'rgba(194,64,3,0.88)',   s:'#8B2500', l:'4+'},
          ].map(l=>(
            <div key={l.l} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <div style={{ width:8, height:8, background:l.f, border:`1px solid ${l.s}`, borderRadius:2 }}/>
              <span style={{ fontSize:8, color:T.textMuted, fontFamily:FONT }}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>

      {hov && cnt[hov] && (
        <div style={{ background:T.verde, color:'white', borderRadius:6, padding:'3px 10px', marginBottom:4, fontFamily:FONT, fontSize:11, fontWeight:700, display:'inline-flex', gap:8, alignItems:'center', flexShrink:0, position:'relative', zIndex:1 }}>
          <span>{hov} — {cnt[hov]} operaç{cnt[hov]>1?'ões':'ão'}</span>
          {types[hov] && [...types[hov]].map(t=><span key={t} style={{ fontSize:12 }}>{CARD_TYPES[t]?.icon}</span>)}
        </div>
      )}

      <svg viewBox="0 0 600 620" style={{ flex:1, width:'100%', position:'relative', zIndex:1, minHeight:0 }}>
        <defs>
          <filter id="glow2"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F37021" floodOpacity="0.7"/></filter>
        </defs>

        {/* Estado shapes */}
        {Object.entries(BRAZIL_PATHS).map(([sigla, {paths, cx, cy}]) => {
          const isActive = !!cnt[sigla]
          const isHov    = hov === sigla
          const fill     = getFill(sigla)
          return (
            <g key={sigla}
              onMouseEnter={()=>setHov(sigla)}
              onMouseLeave={()=>setHov(null)}
              style={{ cursor: isActive ? 'pointer' : 'default' }}>
              {paths.map((d,i) => (
                <path key={i} d={d}
                  fill={fill}
                  stroke={isHov ? '#004042' : '#004042'}
                  strokeWidth={isHov ? 2 : 1}
                  opacity={isHov ? 1 : 0.9}
                  filter={isActive&&isHov ? 'url(#glow2)' : undefined}
                  style={{ transition:'all .15s' }}/>
              ))}
              <text x={cx} y={cy+4} textAnchor="middle"
                fill={isActive ? (cnt[sigla]>=2 ? 'white' : '#004042') : '#004042'}
                fontSize={isHov?10:8} fontWeight={isActive?'700':'500'}
                fontFamily="IBM Plex Sans, sans-serif"
                style={{ pointerEvents:'none', userSelect:'none' }}>
                {sigla}
              </text>
              {isActive && (
                <text x={cx} y={cy+15} textAnchor="middle"
                  fill={cnt[sigla]>=2 ? 'white' : '#F37021'}
                  fontSize={8} fontWeight="700"
                  fontFamily="IBM Plex Sans, sans-serif"
                  style={{ pointerEvents:'none' }}>
                  {cnt[sigla]}
                </text>
              )}
            </g>
          )
        })}

        {/* Rotas */}
        {Object.entries(routes).map(([key, rts]) => {
          const oId = toSigla(rts[0].originState||rts[0].origin)
          const dId = toSigla(rts[0].destState||rts[0].destination)
          const o   = BRAZIL_PATHS[oId]
          const d   = BRAZIL_PATHS[dId]
          if (!o || !d) return null
          const ct  = CARD_TYPES[rts[0].type]
          const mx  = (o.cx+d.cx)/2
          const my  = (o.cy+d.cy)/2 - 20
          return (
            <g key={key}>
              <path d={`M${o.cx},${o.cy} Q${mx},${my} ${d.cx},${d.cy}`}
                stroke={ct?.color} strokeWidth={rts.length>1?2.5:1.5}
                fill="none" strokeDasharray={rts.length>1?'none':'5,4'} opacity={0.8}/>
              <circle cx={mx} cy={my} r={rts.length>1?9:5}
                fill={rts.length>1?T.amarelo:ct?.bg} stroke={ct?.color} strokeWidth={1.5}/>
              <text x={mx} y={my+4} textAnchor="middle"
                fill={rts.length>1?'#000':ct?.color}
                fontSize={rts.length>1?9:7} fontWeight="700"
                fontFamily="IBM Plex Sans, sans-serif">
                {rts.length>1?rts.length:ct?.icon?.slice(0,1)}
              </text>
            </g>
          )
        })}
      </svg>

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
