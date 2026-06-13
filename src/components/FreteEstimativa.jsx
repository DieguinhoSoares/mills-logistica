// ============================================================
// FreteEstimativa.jsx — Componente de estimativa de custo de frete
// Usado em: ApprovalModal (GerenteView), FrotasView, MasterView
// ============================================================
import { useState, useEffect } from 'react'
import { calcularFrete, calcularDistancia, sugerirVeiculo, VEICULOS, formatBRL } from '../lib/freteCalc'
import { T, FONT, IS, LS, BS } from '../lib/constants'

export function FreteEstimativa({ request, onResult }) {
  const [km,          setKm]          = useState('')
  const [kmAuto,      setKmAuto]      = useState(null)
  const [kmLoading,   setKmLoading]   = useState(false)
  const [veiculoId,   setVeiculoId]   = useState('')
  const [sugerido,    setSugerido]    = useState(false)
  const [tipoFrete,   setTipoFrete]   = useState('externo')
  const [comEscolta,  setComEscolta]  = useState(false)
  const [diarias,     setDiarias]     = useState(0)
  const [resultado,   setResultado]   = useState(null)
  const [outroEstado, setOutroEstado] = useState(false)

  const isGuindauto = request?.type === 'guindauto'
  const subtype     = request?.subtype || ''

  // Detecta outro estado
  useEffect(() => {
    const ufO = request?.origin || ''
    const ufD = request?.destination || ''
    setOutroEstado(ufO !== 'SP' || ufD !== 'SP')
  }, [request])

  // Sugere veículo pelo grupo de modelo
  useEffect(() => {
    if (request?.grupoModelo || request?.machine) {
      const { veiculoId: vid, sugerido: s } = sugerirVeiculo(request.grupoModelo || request.machine)
      if (vid) { setVeiculoId(vid); setSugerido(s) }
    }
  }, [request])

  // Calcula distância automaticamente via IBGE
  useEffect(() => {
    const origem  = request?.originCityName
    const destino = request?.destCityName
    const ufO     = request?.origin
    const ufD     = request?.destination
    if (!origem || !destino) return
    setKmLoading(true)
    calcularDistancia(origem, ufO, destino, ufD).then(dist => {
      setKmLoading(false)
      if (dist) { setKmAuto(dist); setKm(String(dist)) }
    })
  }, [request])

  // Recalcula resultado sempre que parâmetros mudam
  useEffect(() => {
    const kmVal = parseFloat(km)
    if (!kmVal || !veiculoId) { setResultado(null); return }
    const res = calcularFrete({
      km: kmVal, veiculoId, tipoFrete, subtype,
      outroEstado, comEscolta, diarias: parseInt(diarias)||0, isGuindauto,
    })
    setResultado(res)
    if (onResult) onResult(res)
  }, [km, veiculoId, tipoFrete, subtype, outroEstado, comEscolta, diarias])

  const labelColor = T.laranja
  const borderCard = `1px solid ${T.border}`

  return (
    <div style={{ background:T.surfaceAlt, borderRadius:T.rLg, padding:16, border:borderCard, marginTop:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:13 }}>🚚 Estimativa de Custo de Frete</div>
        {outroEstado && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>+12% outro estado</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>

        {/* Distância */}
        <div>
          <label style={LS}>
            Distância (km)
            {kmLoading && <span style={{ color:T.textMuted, fontWeight:400, fontSize:10, marginLeft:6 }}>⏳ calculando...</span>}
            {kmAuto && !kmLoading && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ estimativa automática</span>}
          </label>
          <input type="number" value={km} onChange={e=>setKm(e.target.value)}
            style={{ ...IS, marginTop:4 }} placeholder="Ex: 380"/>
          {kmAuto && km !== String(kmAuto) && (
            <button onClick={()=>setKm(String(kmAuto))}
              style={{ background:'none', border:'none', color:T.laranja, fontSize:10, fontFamily:FONT, cursor:'pointer', padding:0, marginTop:2 }}>
              ↩ restaurar estimativa ({kmAuto} km)
            </button>
          )}
        </div>

        {/* Veículo */}
        <div>
          <label style={LS}>
            Veículo transportador
            {sugerido && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ sugerido pelo grupo</span>}
          </label>
          <select value={veiculoId} onChange={e=>{setVeiculoId(e.target.value);setSugerido(false)}} style={{ ...IS, marginTop:4 }}>
            <option value="">— selecione —</option>
            {VEICULOS.map(v=>(
              <option key={v.id} value={v.id}>{v.label} (até {v.carga}t / {v.comp}m)</option>
            ))}
          </select>
        </div>

        {/* Tipo de frete */}
        <div>
          <label style={LS}>Tipo de frete</label>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            {[['interno','🏢 Interno (Valdir)'],['externo','🚛 Externo (Transportadora)']].map(([v,l])=>(
              <div key={v} onClick={()=>setTipoFrete(v)}
                style={{ flex:1, border:`2px solid ${tipoFrete===v?T.laranja:T.border}`, borderRadius:T.rSm,
                  padding:'6px 8px', cursor:'pointer', textAlign:'center',
                  background:tipoFrete===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                <div style={{ color:T.text, fontFamily:FONT, fontSize:10, fontWeight:tipoFrete===v?800:500 }}>{l}</div>
              </div>
            ))}
          </div>
          {tipoFrete==='interno' && (
            <div style={{ color:T.verde, fontSize:10, fontFamily:FONT, marginTop:4 }}>✓ 30% desconto · retorno carregado incluído</div>
          )}
        </div>

        {/* Escolta */}
        <div>
          <label style={LS}>Escolta / Batedor</label>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            {[['false','Não'],['true','Sim']].map(([v,l])=>(
              <div key={v} onClick={()=>setComEscolta(v==='true')}
                style={{ flex:1, border:`2px solid ${String(comEscolta)===v?T.laranja:T.border}`, borderRadius:T.rSm,
                  padding:'6px 8px', cursor:'pointer', textAlign:'center',
                  background:String(comEscolta)===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                <div style={{ color:T.text, fontFamily:FONT, fontSize:10, fontWeight:String(comEscolta)===v?800:500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Diárias */}
        <div style={{ gridColumn:'1/-1' }}>
          <label style={LS}>Diárias (0 se nenhuma)</label>
          <input type="number" min="0" value={diarias} onChange={e=>setDiarias(e.target.value)}
            style={{ ...IS, marginTop:4, width:120 }}/>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{ background:resultado.reembolsavel?'#FFF8E1':T.surface, border:`1px solid ${resultado.reembolsavel?'#F9A825':T.border}`, borderRadius:T.r, padding:14 }}>
          {resultado.reembolsavel && (
            <div style={{ color:'#E65100', fontFamily:FONT, fontWeight:800, fontSize:11, marginBottom:10 }}>
              💰 Valor reembolsável pelo cliente (Sinistro)
            </div>
          )}
          {resultado.pagoPorMills && !resultado.reembolsavel && (
            <div style={{ color:T.verde, fontFamily:FONT, fontWeight:700, fontSize:10, marginBottom:10 }}>
              🏢 Custo pago pela Mills
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              ['Distância estimada', `${resultado.km} km`],
              ['Veículo',            resultado.veiculoLabel],
              ['Frete ida',          formatBRL(resultado.valorIda)],
              ['Retorno',            resultado.tipoFrete==='interno'?'Carregado (incluído)':formatBRL(resultado.valorRetorno)],
              ...(resultado.valorEscolta>0?[['Escolta/batedor', formatBRL(resultado.valorEscolta)]]: []),
              ...(resultado.valorDiaria>0 ?[['Diárias',         formatBRL(resultado.valorDiaria)]]:  []),
              ...(resultado.ajusteEstado>1?[['Ajuste outro estado', '+12%']]: []),
              ...(resultado.desconto>0?   [['Desconto interno', '-30%']]:     []),
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>Estimativa · sem pedágio, seguro e ICMS</span>
            <div style={{ textAlign:'right' }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>TOTAL ESTIMADO</div>
              <div style={{ color:resultado.reembolsavel?'#E65100':T.laranja, fontFamily:FONT, fontWeight:900, fontSize:20 }}>
                {formatBRL(resultado.total)}
              </div>
            </div>
          </div>
        </div>
      )}

      {!resultado && km && veiculoId && (
        <div style={{ textAlign:'center', color:T.textMuted, fontFamily:FONT, fontSize:11, padding:'10px 0' }}>
          Preencha os campos para calcular.
        </div>
      )}
    </div>
  )
}
