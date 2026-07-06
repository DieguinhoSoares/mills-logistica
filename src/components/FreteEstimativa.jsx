// ============================================================
// FreteEstimativa.jsx
// Estimativa de custo pela tabela Hengel (preço de mercado).
// Exibida para TODOS os perfis: solicitante, gestor, frotas.
// Nenhuma referência a Mills/Hengel ou motorista aqui —
// essa decisão é feita pelo Noelio em FreteAtribuicao.
//
// Props:
//   request    — objeto da solicitação
//   simClients — array do CSV SIM (busca grupoModelo/peso)
//   readOnly   — true para gestores (sem edição de campos)
//   isFrotas   — true para Noelio (exibe peso/sentido extra)
//   onChange({ veiculoId, veiculoLabel, km, valorEstimado, sugerido }) — chamado
//     sempre que o veículo/km/valor mudam (inclusive por override manual do
//     analista). Sem isso, a escolha do analista ficava presa ao estado
//     interno deste componente e nunca chegava a ser salva em lugar nenhum —
//     o botão "Confirmar" ignorava completamente o que estava selecionado
//     aqui (bug: "não deixa selecionar a melhor opção manualmente").
// ============================================================
import { useState, useEffect } from 'react'
import {
  calcularFrete, calcularDistancia, sugerirVeiculo,
  buscarGrupoModelo, selecionarVeiculoPorPeso,
  resolverVeiculoTransporte, analisarRotaComParadas, VEICULOS, DIARIAS, formatBRL
} from '../lib/freteCalc'
import { T, FONT, IS, LS } from '../lib/constants'

export function FreteEstimativa({ request, simClients = [], readOnly = false, isFrotas = false, onChange }) {
  const [km,           setKm]           = useState('')
  const [kmAuto,       setKmAuto]       = useState(null)
  const [kmLoading,    setKmLoading]    = useState(false)
  const [veiculoId,    setVeiculoId]    = useState('')
  const [sugerido,     setSugerido]     = useState(false)
  const [grupoLabel,   setGrupoLabel]   = useState('')
  const [pesoInfo,     setPesoInfo]     = useState(null)   // { pesoIda, pesoVolta, pesoMax, sentidoPesado }
  const [comEscolta,   setComEscolta]   = useState(false)
  const [diarias,      setDiarias]      = useState(0)
  const [resultado,    setResultado]    = useState(null)
  const [outroEstado,  setOutroEstado]  = useState(false)
  const [retornoAoPatio, setRetornoAoPatio] = useState(true)
  // Quando o sistema não reconhece a(s) máquina(s) — nem modelo exato, nem
  // grupo de peso, nem categoria similar — ou quando é uma categoria sempre
  // rebocada (sem tarifa cadastrada), força o modo manual em vez de arriscar
  // sugerir Prancha/Truck errado ou ficar preso num aviso sem saída.
  const [modoManual,  setModoManual]  = useState(false)
  const [valorManual, setValorManual] = useState('')
  // Frete combinado (2+ paradas na mesma solicitação) — resultado completo
  // da análise de rota (trechos, km real vs direto, %desvio, sugestão de
  // cobrança) e o override manual "usar sugestão / cobrar separado".
  const [rotaInfo,       setRotaInfo]       = useState(null)
  const [rotaLoading,    setRotaLoading]    = useState(false)
  const [cobrarSeparado, setCobrarSeparado] = useState(null) // null = usar sugestão do sistema

  const isGuindauto = request?.type === 'guindauto'
  const subtype     = request?.subtype || ''

  // Detecta outro estado
  useEffect(() => {
    setOutroEstado((request?.origin || '') !== 'SP' || (request?.destination || '') !== 'SP')
  }, [request])

  // ── Frete combinado (2+ paradas) — roda a análise de rota completa e para
  // por aqui: não passa pelo fluxo normal de ida/volta abaixo, que assume
  // sempre 2 pontos só. ──────────────────────────────────────────────────
  useEffect(() => {
    const paradas = request?.paradas
    if (!paradas || paradas.length < 2 || !simClients?.length) { setRotaInfo(null); return }
    setRotaLoading(true)
    setCobrarSeparado(null)
    analisarRotaComParadas({
      origemCidade: 'Sumaré', origemUf: 'SP', // base fixa da Mills
      paradas: paradas.map(p => ({ tipo:p.tipo, cidade:p.cidade, uf:p.uf, nInternos:p.nInternos||[] })),
      simClients,
    }).then(res => {
      setRotaInfo(res)
      setVeiculoId(res?.veiculoId || '')
      setSugerido(!res?.temItemNaoIdentificado)
      if (!res?.veiculoId) setModoManual(true)
    }).finally(() => setRotaLoading(false))
  }, [request?.paradas, simClients])

  // ── Seleção de veículo por peso ──────────────────────────────
  // Sempre baseada no peso real das máquinas (lookup SIM).
  // Não há distinção Mills/Hengel aqui — apenas o veículo necessário.
  useEffect(() => {
    if (isGuindauto) {
      setVeiculoId('guindauto')
      setGrupoLabel('')
      setPesoInfo(null)
      setSugerido(false)
      return
    }

    const nIda   = request?.nInternosReserva || []
    const nVolta = request?.nInternos        || []

    // Se há N° internos, resolve por peso (caminho principal)
    if ((nIda.length > 0 || nVolta.length > 0) && simClients?.length > 0) {
      const res = resolverVeiculoTransporte(
        nIda, nVolta, simClients, request?.podeEmbarcar === 'nao'
      )

      if (res.rebocado) {
        // Conjunto Canavieiro (ou outra categoria sempre rebocada) — não
        // existe tarifa Hengel nem veículo cadastrado pra esse modo de
        // transporte ainda. Não adivinha: sinaliza claramente que precisa
        // de cotação manual, sem marcar "✓ sugerido automaticamente".
        setVeiculoId('')
        setGrupoLabel(res.label)
        setPesoInfo(null)
        setSugerido(false)
        setModoManual(true)
        return
      }

      if (res.especial) {
        setVeiculoId('bitruck')
        setGrupoLabel('Bi-truck · cabo reboque')
        setPesoInfo(null)
        setSugerido(true)
        return
      }

      if (res.temItemNaoIdentificado) {
        // Nem modelo exato, nem grupo de peso, nem categoria similar — o
        // sistema genuinamente não sabe que máquina é essa. Em vez de
        // arriscar uma sugestão errada (já causou 3 incidentes reais:
        // motoniveladora, escavadeira/retro, caminhão basculante), força
        // o modo manual direto — pede pro analista informar o frete.
        const nSentido = nIda.length > 0 ? nIda.length : nVolta.length
        setVeiculoId('')
        setGrupoLabel(`⚠️ ${nSentido} máquina(s) não reconhecida(s) na base — informe o frete manualmente`)
        setPesoInfo(null)
        setSugerido(false)
        setModoManual(true)
        return
      }

      if (res.veiculoId) {
        const nSentido = res.sentidoPesado === 'ida' ? nIda.length : nVolta.length
        const pesoSentido = res.sentidoPesado === 'ida' ? res.pesoIda : res.pesoVolta
        const detalhe = pesoSentido > 0 ? `${nSentido} máq. · ${pesoSentido}t` : ''

        setVeiculoId(res.veiculoId)
        setSugerido(true)
        setGrupoLabel(detalhe ? `${res.veiculo?.label} · ${detalhe}` : res.veiculo?.label || '')
        setPesoInfo(res)
        return
      }
    }

    // Fallback 1: grupoModelo salvo direto na solicitação
    if (request?.grupoModelo) {
      const { veiculoId: vid, sugerido: s } = sugerirVeiculo(request.grupoModelo)
      if (vid) {
        setGrupoLabel(request.grupoModelo)
        setVeiculoId(vid)
        setSugerido(s)
        setPesoInfo(null)
        return
      }
    }

    // Fallback 2: machine como grupo
    if (request?.machine) {
      const { veiculoId: vid, sugerido: s } = sugerirVeiculo(request.machine)
      if (vid) {
        setGrupoLabel(request.machine)
        setVeiculoId(vid)
        setSugerido(s)
        setPesoInfo(null)
        return
      }
    }

    // Sem dados suficientes
    setVeiculoId('')
    setGrupoLabel('')
    setPesoInfo(null)
    setSugerido(false)
  }, [request, simClients])

  // Calcula distância automática
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

  // ── Recalcula estimativa (sempre modo Hengel) ────────────────
  useEffect(() => {
    const kmVal = parseFloat(km)
    const vid   = veiculoId || (readOnly ? 'prancha3' : '')
    if (!kmVal || !vid) { setResultado(null); return }
    const res = calcularFrete({
      km: kmVal, veiculoId: vid,
      modo: 'estimativa',   // sempre Hengel aqui
      subtype, outroEstado,
      comEscolta, diarias: parseInt(diarias) || 0,
      isGuindauto, retornoAoPatio,
    })
    setResultado(res)
  }, [km, veiculoId, subtype, outroEstado, comEscolta, diarias, readOnly, retornoAoPatio])

  // Reporta a seleção atual pro componente pai — inclusive quando o analista
  // troca o veículo manualmente (setSugerido(false) no onChange do <select>
  // já sinaliza isso; aqui é só repassar pra fora).
  useEffect(() => {
    if (!onChange) return
    const vid = veiculoId || (readOnly ? 'prancha3' : '')
    const usarSeparado = cobrarSeparado ?? rotaInfo?.ehDesvio
    onChange({
      veiculoId: vid,
      veiculoLabel: VEICULOS.find(v => v.id === vid)?.label || '',
      km: rotaInfo ? (usarSeparado ? rotaInfo.kmReal : rotaInfo.kmDireto) : (parseFloat(km) || null),
      // Prioridade: rota com paradas > modo manual > cálculo normal ida/volta.
      valorEstimado: rotaInfo
        ? (usarSeparado ? rotaInfo.valorSeparado : rotaInfo.valorCombinado)
        : modoManual ? (parseFloat(valorManual) || null) : (resultado?.total ?? null),
      sugerido: rotaInfo ? !rotaInfo.temItemNaoIdentificado : (modoManual ? false : sugerido),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculoId, km, resultado, sugerido, modoManual, valorManual, rotaInfo, cobrarSeparado])

  return (
    <div style={{ background:T.surfaceAlt, borderRadius:T.rLg, padding:16, border:`1px solid ${T.border}`, marginTop:12, marginBottom:12 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:13 }}>🚚 Estimativa de Custo de Frete</div>
        <div style={{ display:'flex', gap:6 }}>
          {outroEstado && !isGuindauto && (
            <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>
              +12% outro estado
            </span>
          )}
          {readOnly && (
            <span style={{ background:T.infoLight, color:T.info, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, fontFamily:FONT }}>
              📋 Estimativa automática
            </span>
          )}
        </div>
      </div>

      {/* Frete combinado — resumo de rota com paradas */}
      {rotaLoading && (
        <div style={{ textAlign:'center', padding:'12px 0', color:T.textMuted, fontFamily:FONT, fontSize:11 }}>
          ⏳ Calculando rota com {request?.paradas?.length} paradas...
        </div>
      )}
      {rotaInfo && !rotaLoading && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.r, padding:14, marginBottom:12 }}>
          <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:12, marginBottom:8 }}>
            🗺️ Rota calculada — {request.paradas.length} paradas
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10, fontSize:11, fontFamily:FONT }}>
            <div>
              <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase' }}>Distância direta</div>
              <div style={{ color:T.text, fontWeight:700 }}>{rotaInfo.kmDireto} km</div>
            </div>
            <div>
              <div style={{ color:T.textMuted, fontSize:9, textTransform:'uppercase' }}>Distância real (rota)</div>
              <div style={{ color:T.text, fontWeight:700 }}>{rotaInfo.kmReal} km</div>
            </div>
          </div>
          <div style={{ padding:'8px 10px', borderRadius:T.rSm, marginBottom:10,
            background: rotaInfo.ehDesvio ? '#FFF3E0' : T.verdeLight,
            color: rotaInfo.ehDesvio ? '#E65100' : T.verde, fontSize:11, fontFamily:FONT, fontWeight:700 }}>
            Diferença: {rotaInfo.desvioPct > 0 ? '+' : ''}{rotaInfo.desvioPct}%
            {rotaInfo.ehDesvio ? ' → desvio de rota significativo' : ' → dentro da rota, sem desvio significativo'}
          </div>

          <div style={{ fontSize:11, fontFamily:FONT, color:T.textSec, marginBottom:8 }}>
            💰 Cobrança sugerida: {rotaInfo.ehDesvio
              ? <>{rotaInfo.pernas.length} trechos separados ({rotaInfo.pernas.join('km + ')}km) — {formatBRL(rotaInfo.valorSeparado)}</>
              : <>1 trecho de {rotaInfo.kmDireto}km (tabela) — {formatBRL(rotaInfo.valorCombinado)}</>}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setCobrarSeparado(null)}
              style={{ ...IS, width:'auto', padding:'6px 12px', fontSize:10, fontWeight:700, cursor:'pointer',
                background:(cobrarSeparado===null)?T.laranja:T.surfaceAlt, color:(cobrarSeparado===null)?'white':T.textSec, border:`1px solid ${T.border}` }}>
              ✓ Usar sugestão
            </button>
            <button onClick={()=>setCobrarSeparado(!rotaInfo.ehDesvio)}
              style={{ ...IS, width:'auto', padding:'6px 12px', fontSize:10, fontWeight:700, cursor:'pointer',
                background:(cobrarSeparado!==null)?T.laranja:T.surfaceAlt, color:(cobrarSeparado!==null)?'white':T.textSec, border:`1px solid ${T.border}` }}>
              ✏️ {rotaInfo.ehDesvio ? 'Cobrar como 1 trecho direto' : 'Cobrar por trecho separado'}
            </button>
          </div>

          {rotaInfo.temItemNaoIdentificado && (
            <div style={{ marginTop:8, color:T.perigo, fontSize:10, fontFamily:FONT, fontWeight:700 }}>
              ⚠ Uma ou mais máquinas não foram reconhecidas — confira o veículo sugerido manualmente.
            </div>
          )}
        </div>
      )}

      {/* Veículo detectado pelo peso */}
      {!rotaInfo && grupoLabel && (
        <div style={{ marginBottom:10, padding:'6px 10px', background:T.verdeLight, borderRadius:T.rSm,
          color:T.verde, fontSize:10, fontFamily:FONT, fontWeight:700 }}>
          🔧 {grupoLabel} {sugerido ? '✓ sugerido automaticamente' : ''}
        </div>
      )}

      {/* Info de peso/largura/comprimento — apenas Frotas */}
      {isFrotas && pesoInfo && !pesoInfo.especial && (
        <div style={{ marginBottom:10, padding:'6px 10px', background:T.infoLight, borderRadius:T.rSm,
          color:T.info, fontSize:10, fontFamily:FONT, fontWeight:600,
          display:'flex', gap:16, flexWrap:'wrap' }}>
          <span>⚖️ Ida: {pesoInfo.pesoIda}t</span>
          <span>Volta: {pesoInfo.pesoVolta}t</span>
          <span style={{ fontWeight:800 }}>Sentido crítico: {pesoInfo.sentidoPesado === 'ida' ? '→ ida' : '← volta'}</span>
          {pesoInfo.motivoBasculante && (
            <span style={{ fontWeight:800 }}>🚛 Caminhão basculante — sempre embarca em prancha</span>
          )}
          {pesoInfo.larguraMax > 0 && (
            <span>📏 Largura: {pesoInfo.larguraMax}m{pesoInfo.motivoLargura ? ' (definiu o veículo)' : ''}</span>
          )}
          {pesoInfo.comprimentoMax > 0 && (
            <span>📐 Comprimento: {pesoInfo.comprimentoMax}m{pesoInfo.motivoComprimento ? ' (definiu o veículo)' : ''}</span>
          )}
          {!pesoInfo.milsSuporta && (
            <span style={{ color:'#C62828', fontWeight:800 }}>⚠️ Peso &gt; 32t — somente Hengel</span>
          )}
          {pesoInfo.pesoExcedido && (
            <span style={{ color:'#C62828', fontWeight:800 }}>⚠️ Peso {pesoInfo.pesoMax}t excede a capacidade da maior prancha (40,5t) — necessário dividir em 2 viagens</span>
          )}
          {pesoInfo.larguraExcedida && !pesoInfo.pesoExcedido && (
            <span style={{ color:'#C62828', fontWeight:800 }}>⚠️ Largura {pesoInfo.larguraMax}m excede até a prancha — avaliar remoção de implemento ou AET especial</span>
          )}
          {pesoInfo.comprimentoExcedido && (
            <span style={{ color:'#C62828', fontWeight:800 }}>⚠️ Comprimento excede até a prancha — considerar viagens separadas</span>
          )}
        </div>
      )}
      {isFrotas && pesoInfo?.sugestaoDesmontagem && (
        <div style={{ marginBottom:10, padding:'6px 10px', background:T.amareloLight, borderRadius:T.rSm,
          color:'#8A6D00', fontSize:10, fontFamily:FONT, fontWeight:600 }}>
          {pesoInfo.sugestaoDesmontagem.resolveAET && !pesoInfo.sugestaoDesmontagem.maisBarato
            ? <>💡 Desmontando a lâmina, a largura fica dentro do limite (sem necessidade de AET especial) — mesmo veículo <strong>{pesoInfo.sugestaoDesmontagem.veiculo?.label}</strong>, operação mais simples.</>
            : <>💡 Desmontando a lâmina, cabe em <strong>{pesoInfo.sugestaoDesmontagem.veiculo?.label}</strong> — opção mais econômica.</>
          }
        </div>
      )}

      {/* Guindauto */}
      {isGuindauto && (
        <div style={{ marginBottom:10, padding:'8px 12px', background:T.infoLight, borderRadius:T.rSm }}>
          <div style={{ color:T.info, fontSize:11, fontFamily:FONT, fontWeight:700 }}>
            🏗️ Guindauto — R$ 6,00/km fixo
          </div>
        </div>
      )}

      {/* Formulário — apenas edição */}
      {!readOnly && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>

          {/* Distância */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ ...LS, display:'flex', alignItems:'center', gap:4 }}>
              Distância (km)
              {kmLoading && <span style={{ color:T.textMuted, fontWeight:400, fontSize:10, marginLeft:6 }}>⏳ calculando...</span>}
              {kmAuto && !kmLoading && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ automática</span>}
            </label>
            <input type="number" value={km} onChange={e => setKm(e.target.value)}
              style={{ ...IS, marginTop:4 }} placeholder="Ex: 380"/>
            {kmAuto && km !== String(kmAuto) && (
              <button onClick={() => setKm(String(kmAuto))}
                style={{ background:'none', border:'none', color:T.laranja, fontSize:10, fontFamily:FONT, cursor:'pointer', padding:0, marginTop:2 }}>
                ↩ restaurar ({kmAuto} km)
              </button>
            )}
          </div>

          {/* Veículo — editável apenas se não detectado automaticamente */}
          {!isGuindauto && (
            <div>
              <label style={LS}>
                Veículo
                {sugerido && <span style={{ color:T.verde, fontWeight:400, fontSize:10, marginLeft:6 }}>✓ sugerido</span>}
              </label>
              <select value={veiculoId} onChange={e => { setVeiculoId(e.target.value); setSugerido(false) }}
                style={{ ...IS, marginTop:4 }}>
                <option value="">— selecione —</option>
                {VEICULOS.map(v => (
                  <option key={v.id} value={v.id}>{v.label} (até {v.carga}t / {v.comp}m)</option>
                ))}
              </select>
            </div>
          )}

          {/* Retorno ao pátio — Guindauto */}
          {isGuindauto && (
            <div style={{ gridColumn:'1/-1' }}>
              <label style={LS}>Retorno ao pátio após o serviço?</label>
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                {[['true','✅ Sim'],['false','🔄 Não — próximo cliente']].map(([v,l]) => (
                  <div key={v} onClick={() => setRetornoAoPatio(v === 'true')}
                    style={{ flex:1, border:`2px solid ${String(retornoAoPatio)===v?T.laranja:T.border}`,
                      borderRadius:T.rSm, padding:'6px 8px', cursor:'pointer', textAlign:'center',
                      background:String(retornoAoPatio)===v?T.laranjaLight:T.surface }}>
                    <div style={{ color:T.text, fontFamily:FONT, fontSize:10, fontWeight:String(retornoAoPatio)===v?800:500 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Escolta */}
          <div>
            <label style={LS}>Escolta / Batedor</label>
            <div style={{ display:'flex', gap:6, marginTop:4 }}>
              {[['false','Não'],['true','Sim']].map(([v,l]) => (
                <div key={v} onClick={() => setComEscolta(v === 'true')}
                  style={{ flex:1, border:`2px solid ${String(comEscolta)===v?T.laranja:T.border}`,
                    borderRadius:T.rSm, padding:'6px 8px', cursor:'pointer', textAlign:'center',
                    background:String(comEscolta)===v?T.laranjaLight:T.surface }}>
                  <div style={{ color:T.text, fontFamily:FONT, fontSize:10, fontWeight:String(comEscolta)===v?800:500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Diárias */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={LS}>Diárias (0 se nenhuma)</label>
            <input type="number" min="0" value={diarias} onChange={e => setDiarias(e.target.value)}
              style={{ ...IS, marginTop:4, width:100 }}/>
            {diarias > 0 && resultado?.veiculoId && DIARIAS[resultado.veiculoId] && (
              <span style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginLeft:8 }}>
                {formatBRL(DIARIAS[resultado.veiculoId])} × {diarias} = {formatBRL(DIARIAS[resultado.veiculoId] * parseInt(diarias))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Modo manual — sempre disponível como opção; forçado automaticamente
          quando a máquina não é reconhecida ou é uma categoria sempre
          rebocada (sem tarifa cadastrada, ex: Conjunto Canavieiro).
          Não aparece em rota com paradas — ali a cobrança já vem pronta
          no bloco acima, com seu próprio override (Usar sugestão / Cobrar
          separado), que cobre o mesmo papel sem duplicar UI. */}
      {!rotaInfo && (
      <>
      <div style={{ marginBottom:12 }}>
        <button onClick={()=>setModoManual(m=>!m)}
          style={{ background:'none', border:'none', color:T.laranja, fontFamily:FONT, fontWeight:700, fontSize:11, cursor:'pointer', padding:0 }}>
          {modoManual ? '← Voltar para cálculo automático' : '✏️ Prefere informar o frete manualmente?'}
        </button>
      </div>

      {modoManual ? (
        <div style={{ background:T.laranjaXLight || '#FFF5EE', border:`1px solid ${T.laranja}40`, borderRadius:T.r, padding:14, marginBottom:12 }}>
          {grupoLabel && (
            <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:10 }}>
              {grupoLabel}
            </div>
          )}
          <label style={LS}>Valor do frete (R$) <span style={{ color:T.perigo }}>*</span></label>
          <input type="number" step="0.01" min="0" value={valorManual}
            onChange={e=>setValorManual(e.target.value)}
            placeholder="Peça uma cotação e informe o valor aqui..."
            style={IS}/>
          <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginTop:6, lineHeight:1.4 }}>
            Este valor substitui o cálculo automático. Use quando a máquina não
            for reconhecida pelo sistema ou quando o transporte exigir cotação
            específica (ex: reboque, frete combinado, condição fora do padrão).
          </div>
        </div>
      ) : (
      <>
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
          {readOnly && !grupoLabel && (
            <div style={{ color:T.amarelo, fontFamily:FONT, fontSize:10, marginBottom:8 }}>
              ⚠️ Veículo padrão (Prancha 3 eixos) — grupo de modelo não detectado
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              ['Rota',         `${request?.originCityName||'—'} → ${request?.destCityName||'—'}`],
              ['Distância',    `${resultado.km} km`],
              ['Veículo',      resultado.veiculoLabel],
              ['Frete ida',    formatBRL(resultado.valorIda)],
              ['Retorno',      formatBRL(resultado.valorRetorno)],
              ...(resultado.valorEscolta > 0 ? [['Escolta/batedor', formatBRL(resultado.valorEscolta)]] : []),
              ...(resultado.valorDiaria  > 0 ? [['Diárias',         formatBRL(resultado.valorDiaria)]]  : []),
              ...(resultado.ajuste > 1       ? [['Ajuste estado',    '+12%']]                           : []),
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{l}</div>
                <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, marginBottom:2 }}>
                Estimativa de mercado · sem pedágio, seguro e ICMS
              </div>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, fontStyle:'italic' }}>
                ⚠️ Valores podem ser alterados de acordo com as condições na data do frete.
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
              : !veiculoId
              ? '🚛 Selecione o veículo para calcular.'
              : ''}
          </div>
        )
      )}
      </>
      )}
      </>
      )}
    </div>
  )
}
