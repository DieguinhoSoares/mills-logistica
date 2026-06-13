// ============================================================
// FreteEstimativa.jsx
// Props:
//   request    — objeto da solicitação
//   simClients — array do CSV (busca grupo de modelo)
//   readOnly   — true para aprovadores (sem edição)
// ============================================================
import { useState, useEffect } from 'react'
import {
  calcularFrete, calcularDistancia, sugerirVeiculo,
  buscarGrupoModelo, VEICULOS, DIARIAS, formatBRL
} from '../lib/freteCalc'
import { T, FONT, IS, LS } from '../lib/constants'

export function FreteEstimativa({ request, simClients = [], readOnly = false }) {
  const [km,           setKm]           = useState('')
  const [kmAuto,       setKmAuto]       = useState(null)
  const [kmLoading,    setKmLoading]    = useState(false)
  const [veiculoId,    setVeiculoId]    = useState('')
  const [sugerido,     setSugerido]     = useState(false)
  const [grupoLabel,   setGrupoLabel]   = useState('')
  const [tipoFrete,    setTipoFrete]    = useState('externo')
  const [comEscolta,   setComEscolta]   = useState(false)
  const [diarias,      setDiarias]      = useState(0)
  const [resultado,    setResultado]    = useState(null)
  const [outroEstado,  setOutroEstado]  = useState(false)

  const isGuindauto = request?.type === 'guindauto'
  const subtype     = request?.subtype || ''

  // Detecta outro estado
  useEffect(() => {
    setOutroEstado((request?.origin||'') !== 'SP' || (request?.destination||'') !== 'SP')
  }, [request])

  // Tipo de frete padrão baseado no tipo da solicitação
  useEffect(() => {
    if (request?.type === 'freteMillsInterno') setTipoFrete('interno')
    else setTipoFrete('externo')
  }, [request])

  // Sugere veículo — apenas para Frete Externo
  // Frete Mills sempre usa bitruck (fixo no calcularFrete)
  useEffect(() => {
    if (tipoFrete === 'interno') {
      // Frete Mills: bitruck fixo, sem sugestão necessária
      setVeiculoId('bitruck')
      setGrupoLabel('')
      setSugerido(false)
      return
    }

    // Tentativa 1: grupoModelo salvo na solicitação
    if (request?.grupoModelo) {
      const { veiculoId: vid, sugerido: s } = sugerirVeiculo(request.grupoModelo)
      if (vid) { setGrupoLabel(request.grupoModelo); setVeiculoId(vid); setSugerido(s); return }
    }

    // Tentativa 2: busca pelo N° interno no CSV
    // Suporta MNA01106 → 1106 (extração de dígitos)
    const nInternos = request?.nInternos || (request?.nInterno ? [request.nInterno] : [])
    if (nInternos.length > 0 && simClients?.length > 0) {
      const grupo = buscarGrupoModelo(nInternos, simClients)
      if (grupo) {
        setGrupoLabel(grupo)
        const { veiculoId: vid, sugerido: s } = sugerirVeiculo(grupo)
        if (vid) { setVeiculoId(vid); setSugerido(s); return }
      }
    }

    // Tentativa 3: machine direto como grupo
    if (request?.machine) {
      const { veiculoId: vid, sugerido: s } = sugerirVeiculo(request.machine)
      if (vid) { setGrupoLabel(request.machine); setVeiculoId(vid); setSugerido(s); return }
    }

    // Sem sugestão — analista escolhe
    setVeiculoId('')
    setGrupoLabel('')
    setSugerido(false)
  }, [request, simClients, tipoFrete])

  // Calcula distância
  useEffect(() => {
    const origem  = request?.originCityName
    const destino = request?.destCityName
    const ufO     = request?.origin
    const ufD     = request?.destination
    if (!origem || !destino) return
    setKmLoading(true)

    const tentar = () =>
      calcularDistancia(origem, ufO, destino, ufD).then(({ km: dist }) => {
        if (dist) { setKmAuto(dist); setKm(String(dist)); setKmLoading(false) }
        return dist
      })

    tentar().then(ok => {
      if (!ok) setTimeout(() => tentar().then(() => setKmLoading(false)), 2000)
    })
  }, [request])

  // Recalcula resultado
  useEffect(() => {
    const kmVal = parseFloat(km)
    // Frete Mills não precisa de veículo selecionado (é fixo bitruck)
    const vid = tipoFrete === 'interno' ? 'bitruck' : (veiculoId || (readOnly ? 'prancha3' : ''))
    if (!kmVal || !vid) { setResultado(null); return }
    const res = calcularFrete({
      km: kmVal, veiculoId: vid, tipoFrete, subtype,
      outroEstado, comEscolta, diarias: parseInt(diarias) || 0, isGuindauto,
    })
    setResultado(res)
  }, [km, veiculoId, tipoFrete, subtype, outroEstado, comEscolta, diarias, readOnly])

  const isInterno = tipoFrete === 'interno'

  return (
    <div style={{ background:T.surfaceAlt, borderRadius:T.rLg, padding:16, border:`1px solid ${T.border}`, marginTop:12, marginBottom:12 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:13 }}>🚚 Estimativa de Custo de Frete</div>
        <div style={{ display:'flex', gap:6 }}>
          {outroEstado && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>+12% outro estado</span>}
          {readOnly && <span style={{ background:T.infoLight, color:T.info, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>📋 Estimativa automática</span>}
        </div>
      </div>

      {/* Grupo de modelo detectado — apenas frete externo */}
      {grupoLabel && !isInterno && (
        <div style={{ marginBottom:10, padding:'6px 10px', background:T.verdeLight, borderRadius:T.rSm, color:T.verde, fontSize:10, fontFamily:FONT, fontWeight:700 }}>
          🔧 {grupoLabel} → {VEICULOS.find(v=>v.id===veiculoId)?.label||''} {sugerido ? '✓ sugerido automaticamente' : ''}
        </div>
      )}

      {/* Frete Mills — informativo fixo */}
      {isInterno && (
        <div style={{ marginBottom:10, padding:'8px 12px', background:T.verdeLight, borderRadius:T.rSm, border:`1px solid ${T.verde}30` }}>
          <div style={{ color:T.verde, fontSize:11, fontFamily:FONT, fontWeight:700 }}>🏢 Frete Mills — Caminhão Bi-truck (Valdir)</div>
          <div style={{ color:T.textSec, fontSize:10, fontFamily:FONT, marginTop:2 }}>Custo 30% abaixo da tabela Hengel · Ida e volta com mesmo valor</div>
        </div>
      )}

      {/* Campos editáveis — apenas analista */}
      {!readOnly && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>

          {/* Distância */}
          <div>
            <label style={LS}>
              Distância ida (km)
              {kmLoading && <span style={{ color:T.textMuted, fontWeight:400, fontSize:10, marginLeft:6 }}>⏳ calculando...</span>}
              {kmAuto && !kmLoading && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ automática</span>}
            </label>
            <input type="number" value={km} onChange={e=>setKm(e.target.value)}
              style={{ ...IS, marginTop:4 }} placeholder="Ex: 380"/>
            {kmAuto && km !== String(kmAuto) && (
              <button onClick={()=>setKm(String(kmAuto))}
                style={{ background:'none', border:'none', color:T.laranja, fontSize:10, fontFamily:FONT, cursor:'pointer', padding:0, marginTop:2 }}>
                ↩ restaurar ({kmAuto} km)
              </button>
            )}
          </div>

          {/* Tipo de frete */}
          <div>
            <label style={LS}>Tipo de frete</label>
            <div style={{ display:'flex', gap:6, marginTop:4 }}>
              {[['interno','🏢 Mills (Valdir)'],['externo','🚛 Externo (Hengel)']].map(([v,l])=>(
                <div key={v} onClick={()=>setTipoFrete(v)}
                  style={{ flex:1, border:`2px solid ${tipoFrete===v?T.laranja:T.border}`, borderRadius:T.rSm,
                    padding:'6px 8px', cursor:'pointer', textAlign:'center',
                    background:tipoFrete===v?T.laranjaLight:T.surface, transition:'all .12s' }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:10, fontWeight:tipoFrete===v?800:500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Veículo — apenas frete externo */}
          {!isInterno && (
            <div>
              <label style={LS}>
                Veículo transportador
                {sugerido && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ sugerido</span>}
              </label>
              <select value={veiculoId} onChange={e=>{setVeiculoId(e.target.value);setSugerido(false)}}
                style={{ ...IS, marginTop:4 }}>
                <option value="">— selecione —</option>
                {VEICULOS.map(v=>(
                  <option key={v.id} value={v.id}>{v.label} (até {v.carga}t / {v.comp}m)</option>
                ))}
              </select>
            </div>
          )}

          {/* Escolta */}
          <div>
            <label style={LS}>Escolta / Batedor</label>
            <div style={{ display:'flex', gap:6, marginTop:4 }}>
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
              style={{ ...IS, marginTop:4, width:100 }}/>
            {diarias > 0 && resultado?.veiculoId && DIARIAS[resultado.veiculoId] && (
              <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginLeft:8 }}>
                {formatBRL(DIARIAS[resultado.veiculoId])} × {diarias} = {formatBRL(DIARIAS[resultado.veiculoId] * parseInt(diarias))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {kmLoading && !resultado && (
        <div style={{ textAlign:'center', padding:'12px 0', color:T.textMuted, fontFamily:FONT, fontSize:11 }}>
          ⏳ Calculando distância...
        </div>
      )}

      {/* Resultado */}
      {resultado ? (
        <div style={{
          background: resultado.reembolsavel ? '#FFF8E1' : T.surface,
          border: `1px solid ${resultado.reembolsavel ? '#F9A825' : T.border}`,
          borderRadius: T.r, padding: 14
        }}>
          {resultado.reembolsavel && (
            <div style={{ color:'#E65100', fontFamily:FONT, fontWeight:800, fontSize:11, marginBottom:8 }}>
              💰 Sinistro — valor reembolsável pelo cliente
            </div>
          )}
          {resultado.pagoPorMills && !resultado.reembolsavel && (
            <div style={{ color:T.verde, fontFamily:FONT, fontWeight:700, fontSize:10, marginBottom:8 }}>
              🏢 Custo pago pela Mills
            </div>
          )}
          {readOnly && !isInterno && !grupoLabel && (
            <div style={{ color:T.amarelo, fontFamily:FONT, fontSize:10, marginBottom:8 }}>
              ⚠️ Veículo padrão (Prancha 3 eixos) — grupo de modelo não detectado
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              ['Rota',               `${request?.originCityName||'—'} → ${request?.destCityName||'—'}`],
              ['Distância',          `${resultado.km} km`],
              ['Veículo',            resultado.veiculoLabel],
              ['Frete ida',          formatBRL(resultado.valorIda)],
              ['Retorno',            resultado.valorRetornoLabel],
              ...(resultado.valorEscolta>0       ? [['Escolta/batedor',          formatBRL(resultado.valorEscolta)]] : []),
              ...(resultado.valorDiaria>0         ? [['Diárias',                 formatBRL(resultado.valorDiaria)]]  : []),
              ...(resultado.ajuste>1              ? [['Ajuste outro estado',      '+12%']]                           : []),
              ...(isInterno                       ? [['Desconto Mills (Valdir)',  '-30% sobre tabela Hengel']]       : []),
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginBottom:2 }}>
                Estimativa · sem pedágio, seguro e ICMS
              </div>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, fontStyle:'italic' }}>
                ⚠️ Os valores podem ser alterados de acordo com as condições apresentadas na data do frete.
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:12 }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>TOTAL ESTIMADO</div>
              <div style={{ color:resultado.reembolsavel?'#E65100':T.laranja, fontFamily:FONT, fontWeight:900, fontSize:22 }}>
                {formatBRL(resultado.total)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        !kmLoading && (
          <div style={{ textAlign:'center', padding:'12px 0', color:T.textMuted, fontFamily:FONT, fontSize:11 }}>
            {!km
              ? '📍 Distância não encontrada — informe os km manualmente.'
              : !isInterno && !veiculoId
              ? '🚛 Selecione o veículo para calcular.'
              : ''}
          </div>
        )
      )}
    </div>
  )
}
