// ============================================================
// FreteAtribuicao.jsx — Exclusivo perfil Frotas (Noelio)
// Exibido APÓS aprovação do gestor, na fila de demandas.
//
// Responsabilidades:
//   1. Decidir Mills ou Hengel
//   2. Se Mills: selecionar motorista (Valdir/Bento)
//   3. Se Hengel: informar transportadora
//   4. Editar km se necessário
//   5. Confirmar → salva custoReal no Firestore
//
// Props:
//   request        — objeto da solicitação (com custoEstimado salvo)
//   simClients     — CSV SIM
//   onAtribuir(data) — callback Firebase: salva campos de atribuição
// ============================================================
import { useState, useEffect } from 'react'
import {
  calcularFrete, resolverVeiculoTransporte,
  VEICULOS, MOTORISTAS_MILLS, DIARIAS, formatBRL
} from '../lib/freteCalc'
import { T, FONT, IS, LS } from '../lib/constants'

export function FreteAtribuicao({ request, simClients = [], onAtribuir }) {
  const [tipoFreteReal,    setTipoFreteReal]    = useState('mills')   // 'mills' | 'hengel'
  const [motoristaId,      setMotoristaId]      = useState('valdir')
  const [transportadora,   setTransportadora]   = useState('')
  const [veiculoHengel,    setVeiculoHengel]    = useState('')
  const [kmReal,           setKmReal]           = useState(String(request?.kmEstimado || ''))
  const [comEscolta,       setComEscolta]       = useState(false)
  const [diarias,          setDiarias]          = useState(0)
  const [outroEstado,      setOutroEstado]      = useState(false)
  const [resultado,        setResultado]        = useState(null)
  const [salvando,         setSalvando]         = useState(false)
  const [veiculoSugerido,  setVeiculoSugerido]  = useState(null)   // do resolverVeiculoTransporte

  const subtype     = request?.subtype || ''
  const isGuindauto = request?.type === 'guindauto'
  const custoEstimado = request?.custoEstimado || 0

  // Outro estado
  useEffect(() => {
    setOutroEstado((request?.origin || '') !== 'SP' || (request?.destination || '') !== 'SP')
  }, [request])

  // Resolve veículo sugerido pelo peso (para referência e validação)
  useEffect(() => {
    if (isGuindauto || !simClients?.length) return
    const res = resolverVeiculoTransporte(
      request?.nInternosReserva || [],
      request?.nInternos        || [],
      simClients,
      request?.requiresEspecial || false,
    )
    setVeiculoSugerido(res)

    // Se peso > 32t, força Hengel automaticamente
    if (!res.milsSuporta) {
      setTipoFreteReal('hengel')
      setVeiculoHengel(res.veiculoId)
    } else {
      // Pré-seleciona motorista Mills pelo veículo sugerido
      if (res.veiculoId === 'prancha3') setMotoristaId('bento')
      else setMotoristaId('valdir')
    }
  }, [request, simClients])

  // Km inicial do request
  useEffect(() => {
    if (request?.kmEstimado) setKmReal(String(request.kmEstimado))
  }, [request])

  // ── Recalcula custo real ─────────────────────────────────────
  useEffect(() => {
    const kmVal = parseFloat(kmReal)
    if (!kmVal) { setResultado(null); return }

    let veiculoId, modo

    if (isGuindauto) {
      veiculoId = 'guindauto'
      modo      = 'estimativa'
    } else if (tipoFreteReal === 'mills') {
      const motorista = MOTORISTAS_MILLS.find(m => m.id === motoristaId)
      veiculoId = motorista?.veiculoId || 'bitruck'
      modo      = 'mills'
    } else {
      veiculoId = veiculoHengel || veiculoSugerido?.veiculoId || 'prancha3'
      modo      = 'hengel'
    }

    if (!veiculoId) { setResultado(null); return }

    const res = calcularFrete({
      km: kmVal, veiculoId, modo, subtype,
      outroEstado, comEscolta,
      diarias: parseInt(diarias) || 0,
      isGuindauto,
    })
    setResultado(res)
  }, [kmReal, tipoFreteReal, motoristaId, veiculoHengel, outroEstado, comEscolta, diarias])

  // ── Confirmar atribuição ─────────────────────────────────────
  const handleAtribuir = async () => {
    if (!resultado) return
    setSalvando(true)
    try {
      const motorista = MOTORISTAS_MILLS.find(m => m.id === motoristaId)
      await onAtribuir({
        tipoFreteReal,
        veiculoReal:            resultado.veiculoId,
        veiculoRealLabel:       resultado.veiculoLabel,
        kmReal:                 parseFloat(kmReal),
        motoristaOuTransportadora: tipoFreteReal === 'mills'
          ? motorista?.nome || ''
          : transportadora,
        custoReal:              resultado.total,
        custoEstimado,          // referência para comparação
        economia:               Math.round((custoEstimado - resultado.total) * 100) / 100,
        comEscolta,
        diarias:                parseInt(diarias) || 0,
        atribuidoEm:            new Date().toISOString(),
      })
    } finally {
      setSalvando(false)
    }
  }

  // ── Variação estimado × real ─────────────────────────────────
  const variacao   = resultado ? resultado.total - custoEstimado : null
  const variacaoPC = custoEstimado > 0 && variacao !== null
    ? Math.round((variacao / custoEstimado) * 100)
    : null

  const milsNaoSuporta = veiculoSugerido && !veiculoSugerido.milsSuporta

  return (
    <div style={{ background:T.surfaceAlt, borderRadius:T.rLg, padding:16,
      border:`2px solid ${T.laranja}40`, marginTop:12 }}>

      {/* Cabeçalho */}
      <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:13, marginBottom:12 }}>
        🔧 Atribuição de Frete — Frotas
      </div>

      {/* Alerta peso > 32t */}
      {milsNaoSuporta && (
        <div style={{ background:'#FFEBEE', border:'1px solid #EF9A9A', borderRadius:T.rSm,
          padding:'8px 12px', marginBottom:12, color:'#C62828', fontFamily:FONT,
          fontWeight:700, fontSize:11 }}>
          🚫 Peso {veiculoSugerido.pesoMax}t excede 32t — Frete Mills não suporta. Atribuir à Hengel.
        </div>
      )}

      {/* Info de peso */}
      {veiculoSugerido && !veiculoSugerido.especial && (
        <div style={{ display:'flex', gap:16, marginBottom:12, padding:'6px 10px',
          background:T.infoLight, borderRadius:T.rSm, color:T.info,
          fontFamily:FONT, fontSize:10, fontWeight:600 }}>
          <span>⚖️ Ida: {veiculoSugerido.pesoIda}t</span>
          <span>Volta: {veiculoSugerido.pesoVolta}t</span>
          <span>Sentido crítico: <b>{veiculoSugerido.sentidoPesado === 'ida' ? '→ ida' : '← volta'}</b></span>
          <span>Veículo mínimo: <b>{veiculoSugerido.veiculo?.label}</b></span>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>

        {/* Km real */}
        <div style={{ gridColumn:'1/-1' }}>
          <label style={LS}>Distância real (km)</label>
          <input type="number" value={kmReal} onChange={e => setKmReal(e.target.value)}
            style={{ ...IS, marginTop:4 }} placeholder="Confirme ou ajuste"/>
          {request?.kmEstimado && kmReal !== String(request.kmEstimado) && (
            <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginLeft:8 }}>
              Estimativa: {request.kmEstimado} km
            </span>
          )}
        </div>

        {/* Tipo de frete */}
        {!isGuindauto && (
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Executar com</label>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {[
                ['mills',  '🏢 Frota Mills',        !milsNaoSuporta],
                ['hengel', '🚛 Hengel (externo)',    true],
              ].map(([v, l, enabled]) => (
                <div key={v}
                  onClick={() => enabled && setTipoFreteReal(v)}
                  style={{ flex:1, border:`2px solid ${tipoFreteReal===v?T.laranja:T.border}`,
                    borderRadius:T.rSm, padding:'8px 10px', textAlign:'center',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    opacity: enabled ? 1 : 0.4,
                    background: tipoFreteReal===v ? T.laranjaLight : T.surface }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11,
                    fontWeight:tipoFreteReal===v?800:500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mills: motorista */}
        {!isGuindauto && tipoFreteReal === 'mills' && (
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Motorista</label>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {MOTORISTAS_MILLS.map(m => (
                <div key={m.id}
                  onClick={() => setMotoristaId(m.id)}
                  style={{ flex:1, border:`2px solid ${motoristaId===m.id?T.laranja:T.border}`,
                    borderRadius:T.rSm, padding:'8px 10px', cursor:'pointer',
                    background: motoristaId===m.id ? T.laranjaLight : T.surface }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:11,
                    fontWeight: motoristaId===m.id?800:500 }}>{m.nome}</div>
                  <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:9, marginTop:2 }}>
                    {m.veiculoId === 'bitruck' ? 'Bi-truck' : 'Prancha 3 eixos'} · {Math.round(m.desconto*100)}% abaixo Hengel
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hengel: veículo + transportadora */}
        {!isGuindauto && tipoFreteReal === 'hengel' && (
          <>
            <div>
              <label style={LS}>Veículo</label>
              <select value={veiculoHengel}
                onChange={e => setVeiculoHengel(e.target.value)}
                style={{ ...IS, marginTop:4 }}>
                <option value="">— selecione —</option>
                {VEICULOS.map(v => (
                  <option key={v.id} value={v.id}>{v.label} (até {v.carga}t)</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LS}>Transportadora</label>
              <input value={transportadora}
                onChange={e => setTransportadora(e.target.value)}
                style={{ ...IS, marginTop:4 }} placeholder="Ex: Hengel"/>
            </div>
          </>
        )}

        {/* Escolta */}
        <div>
          <label style={LS}>Escolta / Batedor</label>
          <div style={{ display:'flex', gap:6, marginTop:4 }}>
            {[['false','Não'],['true','Sim']].map(([v,l]) => (
              <div key={v} onClick={() => setComEscolta(v === 'true')}
                style={{ flex:1, border:`2px solid ${String(comEscolta)===v?T.laranja:T.border}`,
                  borderRadius:T.rSm, padding:'6px 8px', cursor:'pointer', textAlign:'center',
                  background: String(comEscolta)===v ? T.laranjaLight : T.surface }}>
                <div style={{ color:T.text, fontFamily:FONT, fontSize:10,
                  fontWeight:String(comEscolta)===v?800:500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Diárias */}
        <div>
          <label style={LS}>Diárias</label>
          <input type="number" min="0" value={diarias}
            onChange={e => setDiarias(e.target.value)}
            style={{ ...IS, marginTop:4 }}/>
        </div>
      </div>

      {/* Resultado + comparação */}
      {resultado && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:T.r, padding:14, marginBottom:12 }}>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            {[
              ['Veículo real',   resultado.veiculoLabel],
              ['Frete ida',      formatBRL(resultado.valorIda)],
              ['Retorno',        formatBRL(resultado.valorRetorno)],
              ...(resultado.valorEscolta > 0 ? [['Escolta', formatBRL(resultado.valorEscolta)]] : []),
              ...(resultado.valorDiaria  > 0 ? [['Diárias', formatBRL(resultado.valorDiaria)]]  : []),
              ...(resultado.ajuste > 1       ? [['Ajuste estado', '+12%']]                      : []),
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT,
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Custo real vs estimado */}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10,
            display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div>
              {custoEstimado > 0 && variacao !== null && (
                <div style={{ fontFamily:FONT, fontSize:10, fontWeight:600,
                  color: variacao < 0 ? T.verde : '#C62828' }}>
                  {variacao < 0
                    ? `✅ Economia de ${formatBRL(Math.abs(variacao))} (${Math.abs(variacaoPC)}% abaixo da estimativa)`
                    : `⚠️ Custo ${formatBRL(variacao)} acima da estimativa (${variacaoPC}%)`}
                </div>
              )}
              {custoEstimado > 0 && (
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginTop:2 }}>
                  Estimativa original: {formatBRL(custoEstimado)}
                </div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT }}>CUSTO REAL</div>
              <div style={{ color:T.laranja, fontFamily:FONT, fontWeight:900, fontSize:22 }}>
                {formatBRL(resultado.total)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão confirmar */}
      <button
        onClick={handleAtribuir}
        disabled={!resultado || salvando || (tipoFreteReal === 'hengel' && !veiculoHengel)}
        style={{
          width:'100%', padding:'12px 0', borderRadius:T.rSm, border:'none',
          background: resultado ? T.laranja : T.border,
          color:'#fff', fontFamily:FONT, fontWeight:800, fontSize:13,
          cursor: resultado ? 'pointer' : 'not-allowed', opacity: salvando ? 0.7 : 1,
        }}>
        {salvando ? '⏳ Salvando...' : '✅ Confirmar atribuição'}
      </button>
    </div>
  )
}
