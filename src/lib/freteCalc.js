// ============================================================
// freteCalc.js — Módulo de cálculo de custo de frete
// Mills Pesados | Divisão Pesados — Tabela março/2026
// Distância: Nominatim (coords) + OSRM (rota rodoviária real)
// ============================================================

// ── TABELA DE TARIFAS HENGEL ─────────────────────────────────
const TABELA = [
  { min:0,    max:50,       fixo:true,  '3/4':722.43,  truck:1116.49, bitruck:1260.97, prancha3:1284.44, prancha4:1550.75 },
  { min:51,   max:100,      fixo:true,  '3/4':1116.49, truck:1641.89, bitruck:1970.27, prancha3:2024.23, prancha4:2421.72 },
  { min:101,  max:250,      fixo:false, '3/4':9.52,    truck:12.73,   bitruck:15.02,   prancha3:16.83,   prancha4:20.82   },
  { min:251,  max:500,      fixo:false, '3/4':8.70,    truck:11.16,   bitruck:13.73,   prancha3:15.57,   prancha4:18.87   },
  { min:501,  max:1000,     fixo:false, '3/4':7.97,    truck:10.75,   bitruck:12.86,   prancha3:14.80,   prancha4:17.99   },
  { min:1001, max:2000,     fixo:false, '3/4':7.78,    truck:10.46,   bitruck:12.59,   prancha3:14.25,   prancha4:17.31   },
  { min:2001, max:3000,     fixo:false, '3/4':7.71,    truck:10.43,   bitruck:12.42,   prancha3:14.14,   prancha4:17.15   },
  { min:3001, max:Infinity, fixo:false, '3/4':7.76,    truck:10.39,   bitruck:12.37,   prancha3:14.07,   prancha4:17.10   },
]

export const DIARIAS = {
  '3/4':573.35, truck:662.90, bitruck:779.75, prancha3:917.36, prancha4:1061.51,
}

const ESCOLTA = [
  { max:50,       fixo:true,  valor:780.85 },
  { max:100,      fixo:true,  valor:937.01 },
  { max:250,      fixo:false, valor:6.01   },
  { max:500,      fixo:false, valor:4.81   },
  { max:Infinity, fixo:false, valor:4.26   },
]

// ── VEÍCULOS ─────────────────────────────────────────────────
// eixos: total de eixos para referência
export const VEICULOS = [
  { id:'3/4',      label:'Caminhão 3/4',           carga:3.5,  comp:5,  larg:2.30, eixos:2 },
  { id:'truck',    label:'Caminhão Truck',          carga:13,   comp:9,  larg:2.60, eixos:3 },
  { id:'bitruck',  label:'Caminhão Bi-truck',       carga:17,   comp:10, larg:2.60, eixos:4 },
  { id:'prancha3', label:'Carreta Prancha 3 eixos', carga:32,   comp:15, larg:3.00, eixos:6 },
  { id:'prancha4', label:'Carreta Prancha 4 eixos', carga:40,   comp:17, larg:3.00, eixos:7 },
]

// ── MAPEAMENTO GRUPO DE MODELO → VEÍCULO (Frete Externo) ─────
const GRUPO_VEICULO = {
  'Carregadeira de Pneus 1 a 2 t':             '3/4',
  'Carregadeira de Pneus 2 a 3 t':             '3/4',
  'Carregadeira de Pneus 8 a 9 t':             'truck',
  'Carregadeira de Pneus 10 a 11 t':           'bitruck',
  'Carregadeira de Pneus 12 a 13 t':           'bitruck',
  'Carregadeira de Pneus 14 a 16 t':           'prancha3',
  'Carregadeira de Pneus 17 a 18 t':           'prancha3',
  'Carregadeira de Pneus 19 a 20 t':           'prancha4',
  'Carregadeira de Pneus 21 a 23 t':           'prancha4',
  'Mini Carregadeira 2 a 3 t':                 '3/4',
  'Mini Carregadeira 4 a 5 t':                 'truck',
  'Mini Escavadeira 3 t':                      '3/4',
  'Escavadeira de esteiras 12 a 13 t':         'bitruck',
  'Escavadeira de esteiras 14 a 16 t':         'prancha3',
  'Escavadeira de esteiras 16 t':              'prancha3',
  'Escavadeira de esteiras 17 a 20 t':         'prancha3',
  'Escavadeira de esteiras 20 a 22 t':         'prancha3',
  'Escavadeira de esteiras 30 a 36 t':         'prancha4',
  'Escavadeira de Pneus 23 a 26 t':            'prancha4',
  'Escavadeira Anfíbia 20t':                   'prancha3',
  'Motoniveladora 14 a 16 t':                  'prancha3',
  'Motoniveladora 17 a 18 t':                  'prancha3',
  'Motoniveladora 19 a 20 t':                  'prancha4',
  'Retroescavadeira 7 a 9 t':                  'truck',
  'Trator de Esteiras 14 a 16 t':              'prancha3',
  'Trator de Esteiras 19 a 20 t':              'prancha3',
  'Trator de Esteiras 21 a 22 t':              'prancha4',
  'Trator de Esteiras 23 a 29 t':              'prancha4',
  'Trator de Esteiras 39 t':                   'prancha4',
  'Compactador Vibratório 10 a 11 t / Liso':   'bitruck',
  'Compactador Vibratório 10 a 11 t / Kit PD': 'bitruck',
  'Compactador Vibratório 10 a 11 t / PD':     'bitruck',
  'Compactador Vibratório 12 a 13 t / Kit PD': 'prancha3',
  'Compactador Vibratório 21 t':               'prancha4',
  'Compactador Tandem 10 a 11 t / Liso':       'bitruck',
  'Compactador Tandem 7t':                     'truck',
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 'prancha4',
  'Mini Compactador Tandem 2 a 3 t / Liso':    '3/4',
  'Mini Compactador 1,5 t':                    '3/4',
}

// ── BUSCA GRUPO DE MODELO NO CSV ─────────────────────────────
// Suporta código alfanumérico (MNA01106 → 1106) e numérico puro
export function buscarGrupoModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]

  for (const n of lista) {
    const nStr = String(n).trim()
    // Extrai só os dígitos e remove zeros à esquerda: MNA01106 → 1106, PCP01030 → 1030
    const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')

    const found = simClients.find(c => {
      const chave = Object.keys(c).find(k =>
        k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('ninterno') ||
        k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('nointerno')
      )
      if (!chave) return false
      const val = String(c[chave]).trim().replace(/^0+/, '')
      return val === nStr || val === nNum
    })

    if (found) {
      const grupoKey = Object.keys(found).find(k =>
        k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('grupodemodelo') ||
        k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('grupo')
      )
      return grupoKey ? found[grupoKey] : null
    }
  }
  return null
}

// ── SUGESTÃO DE VEÍCULO (apenas Frete Externo) ───────────────
export function sugerirVeiculo(grupoModelo) {
  if (!grupoModelo) return { veiculoId: null, sugerido: false }
  const id = GRUPO_VEICULO[grupoModelo.trim()]
  return id ? { veiculoId: id, sugerido: true } : { veiculoId: null, sugerido: false }
}


// ── PESO OPERACIONAL POR GRUPO DE MODELO ─────────────────────
const PESO_GRUPO = {
  'Carregadeira de Pneus 1 a 2 t':             1.5,
  'Carregadeira de Pneus 2 a 3 t':             2.5,
  'Carregadeira de Pneus 8 a 9 t':             8.5,
  'Carregadeira de Pneus 10 a 11 t':           10.5,
  'Carregadeira de Pneus 12 a 13 t':           12.5,
  'Carregadeira de Pneus 14 a 16 t':           15.0,
  'Carregadeira de Pneus 17 a 18 t':           17.5,
  'Carregadeira de Pneus 19 a 20 t':           19.5,
  'Carregadeira de Pneus 21 a 23 t':           22.0,
  'Mini Carregadeira 2 a 3 t':                 2.5,
  'Mini Carregadeira 4 a 5 t':                 4.5,
  'Mini Escavadeira 3 t':                      3.0,
  'Escavadeira de esteiras 12 a 13 t':         12.5,
  'Escavadeira de esteiras 14 a 16 t':         15.0,
  'Escavadeira de esteiras 16 t':              16.0,
  'Escavadeira de esteiras 17 a 20 t':         18.5,
  'Escavadeira de esteiras 20 a 22 t':         21.0,
  'Escavadeira de esteiras 30 a 36 t':         33.0,
  'Escavadeira de Pneus 23 a 26 t':            24.5,
  'Escavadeira Anfíbia 20t':                   20.0,
  'Motoniveladora 14 a 16 t':                  15.0,
  'Motoniveladora 17 a 18 t':                  17.5,
  'Motoniveladora 19 a 20 t':                  19.5,
  'Retroescavadeira 7 a 9 t':                  8.0,
  'Trator de Esteiras 14 a 16 t':              15.0,
  'Trator de Esteiras 19 a 20 t':              19.5,
  'Trator de Esteiras 21 a 22 t':              21.5,
  'Trator de Esteiras 23 a 29 t':              26.0,
  'Trator de Esteiras 39 t':                   39.0,
  'Compactador Vibratório 10 a 11 t / Liso':   10.5,
  'Compactador Vibratório 10 a 11 t / Kit PD': 10.5,
  'Compactador Vibratório 10 a 11 t / PD':     10.5,
  'Compactador Vibratório 12 a 13 t / Kit PD': 12.5,
  'Compactador Vibratório 21 t':               21.0,
  'Compactador Tandem 10 a 11 t / Liso':       10.5,
  'Compactador Tandem 7t':                     7.0,
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 27.0,
  'Mini Compactador Tandem 2 a 3 t / Liso':    2.5,
  'Mini Compactador 1,5 t':                    1.5,
}

/**
 * Seleciona o veículo adequado com base no peso total combinado das máquinas.
 * Usado quando há múltiplos N° internos (combinação de carga — frete externo).
 * @param {string[]} grupos — array de grupos de modelo
 * @returns {{ veiculoId, pesoTotal, combinacao }}
 */
export function selecionarVeiculoPorPeso(grupos) {
  if (!grupos?.length) return null

  const pesoTotal = grupos.reduce((acc, g) => acc + (PESO_GRUPO[g] || 0), 0)

  // Seleciona o menor veículo que suporta o peso total
  let veiculoId = null
  if      (pesoTotal <= 3.5)  veiculoId = '3/4'
  else if (pesoTotal <= 13)   veiculoId = 'truck'
  else if (pesoTotal <= 17)   veiculoId = 'bitruck'
  else if (pesoTotal <= 32)   veiculoId = 'prancha3'
  else                        veiculoId = 'prancha4'

  return {
    veiculoId,
    pesoTotal: Math.round(pesoTotal * 10) / 10,
    combinacao: grupos.length > 1,
    veiculo: VEICULOS.find(v => v.id === veiculoId),
  }
}

// ── DISTÂNCIA: Nominatim + OSRM ──────────────────────────────
async function buscarCoordenadas(cidade, uf) {
  try {
    const estadosBR = {
      AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
      CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
      MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul',
      MT:'Mato Grosso', PA:'Pará', PB:'Paraíba', PE:'Pernambuco',
      PI:'Piauí', PR:'Paraná', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte',
      RO:'Rondônia', RR:'Roraima', RS:'Rio Grande do Sul',
      SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins',
    }
    const estado = estadosBR[uf] || uf
    const url = `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(estado)}` +
      `&country=Brazil&format=json&limit=1`
    const res  = await fetch(url, { headers:{ 'Accept-Language':'pt-BR', 'User-Agent':'mills-logistica/1.0' } })
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

export async function calcularDistancia(cidadeOrigem, ufOrigem, cidadeDestino, ufDestino) {
  const [coordO, coordD] = await Promise.all([
    buscarCoordenadas(cidadeOrigem, ufOrigem),
    buscarCoordenadas(cidadeDestino, ufDestino),
  ])
  if (!coordO || !coordD) return { km: null, coordO: null, coordD: null }

  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${coordO.lon},${coordO.lat};${coordD.lon},${coordD.lat}?overview=false`
    const res  = await fetch(url)
    const data = await res.json()
    if (data?.routes?.[0]?.distance) {
      return { km: Math.round(data.routes[0].distance / 1000), coordO, coordD }
    }
  } catch { /* fallback */ }

  // Fallback Haversine × 1.3
  const R    = 6371
  const dLat = (coordD.lat - coordO.lat) * Math.PI / 180
  const dLon = (coordD.lon - coordO.lon) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 +
    Math.cos(coordO.lat * Math.PI/180) * Math.cos(coordD.lat * Math.PI/180) * Math.sin(dLon/2)**2
  const km   = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3)
  return { km, coordO, coordD }
}

// ── CÁLCULO DE FRETE ─────────────────────────────────────────
function getValorIda(km, veiculoId) {
  const faixa = TABELA.find(f => km >= f.min && km <= f.max)
  if (!faixa) return 0
  return faixa.fixo ? faixa[veiculoId] : Math.round(faixa[veiculoId] * km * 100) / 100
}

function getValorEscolta(km) {
  const faixa = ESCOLTA.find(f => km <= f.max)
  if (!faixa) return 0
  return faixa.fixo ? faixa.valor : Math.round(faixa.valor * km * 100) / 100
}

/**
 * Calcula custo estimado de frete.
 *
 * Frete Mills (interno):
 *   - Veículo fixo: bitruck
 *   - Valor: tabela bitruck × 70% (30% abaixo da Hengel)
 *   - Retorno: mesmo valor da ida (volta carregada)
 *
 * Frete Externo (Hengel):
 *   - Veículo: sugerido pelo grupo de modelo
 *   - Valor: tabela conforme veículo
 *   - Retorno: 30% da ida (condição comercial Mills × Hengel)
 */
export function calcularFrete({
  km, veiculoId, tipoFrete = 'externo', subtype = '',
  outroEstado = false, comEscolta = false, diarias = 0,
  isGuindauto = false, retornoAoPatio = true,
}) {
  if (!km || km <= 0) return null

  // Frete Mills sempre usa bitruck
  const vid    = tipoFrete === 'interno' ? 'bitruck' : veiculoId
  if (!vid) return null

  const ajuste = outroEstado ? 1.12 : 1
  let valorIda = 0, valorRetorno = 0, valorEscolta = 0, valorDiaria = 0

  // ── Guindauto: R$ 6,00/km fixo ─────────────────────────────
  // Tarifa única independente de subtipo ou tipo de frete
  // Retorno = mesmo valor da ida (mesmo deslocamento)
  // retornoAoPatio: false quando vai direto de um cliente para outro
  if (isGuindauto) {
    // Guindauto: R$6,00/km fixo — sem ajuste de outro estado
    valorIda     = Math.round(km * 6.00 * 100) / 100
    valorRetorno = retornoAoPatio ? valorIda : 0
    const total  = Math.round((valorIda + valorRetorno) * 100) / 100
    return {
      km, veiculoId: 'guindauto',
      veiculoLabel: 'Caminhão Guindauto',
      tipoFrete, subtype, isGuindauto: true,
      valorIda,
      valorRetorno,
      valorRetornoLabel: retornoAoPatio
        ? `${formatBRL(valorRetorno)} (retorno ao pátio — mesmo valor)`
        : 'Sem retorno (vai direto ao próximo cliente)',
      valorEscolta: 0, valorDiaria: 0, ajuste: 1, total,
      reembolsavel: subtype === 'sinistro',
      pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
    }
  }

  // ── Frete Mills ──────────────────────────────────────────────
  // 1 máquina  → Valdir (bi-truck):   35% abaixo da Hengel bi-truck
  // 2+ máquinas → Bento (prancha3):   30% abaixo da Hengel prancha3
  // Ida e volta sempre com mesmo valor (volta carregada)
  if (tipoFrete === 'interno') {
    if (vid === 'prancha3') {
      // Bento — prancha 3 eixos: 30% abaixo da Hengel prancha3
      const baseIda = getValorIda(km, 'prancha3') * ajuste
      valorIda     = Math.round(baseIda * 0.70 * 100) / 100
    } else {
      // Valdir — bi-truck: 35% abaixo da Hengel bi-truck
      const baseIda = getValorIda(km, 'bitruck') * ajuste
      valorIda     = Math.round(baseIda * 0.65 * 100) / 100
    }
    valorRetorno = valorIda  // volta carregada = mesmo valor
  } else {
    // ── Frete Externo (Hengel) ──────────────────────────────
    const baseIda = getValorIda(km, vid) * ajuste
    valorIda      = Math.round(baseIda * 100) / 100
    valorRetorno  = Math.round(baseIda * 0.30 * 100) / 100   // 30% condição comercial
  }

  if (comEscolta) valorEscolta = Math.round(getValorEscolta(km) * ajuste * 100) / 100
  if (diarias > 0 && DIARIAS[vid]) {
    valorDiaria = Math.round(DIARIAS[vid] * diarias * ajuste * 100) / 100
  }

  const total = Math.round((valorIda + valorRetorno + valorEscolta + valorDiaria) * 100) / 100

  const veiculo = VEICULOS.find(v=>v.id===vid)

  return {
    km, veiculoId: vid,
    veiculoLabel: veiculo?.label || vid,
    eixos:        veiculo?.eixos || 0,
    tipoFrete, subtype, isGuindauto: false,
    valorIda,
    valorRetorno,
    valorRetornoLabel: tipoFrete === 'interno'
      ? `${formatBRL(valorRetorno)} (retorno carregado — mesmo valor)`
      : `${formatBRL(valorRetorno)} (30% — condição Mills × Hengel)`,
    valorEscolta,
    valorDiaria,
    ajuste,
    total,
    reembolsavel: subtype === 'sinistro',
    pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
  }
}

export function formatBRL(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
