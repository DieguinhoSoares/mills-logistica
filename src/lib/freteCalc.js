// ============================================================
// freteCalc.js — Módulo de cálculo de custo de frete
// Mills Pesados | Divisão Pesados — Tabela março/2026
// Distância: Nominatim (coords) + OSRM (rota rodoviária real)
// ============================================================

// ── TABELA DE TARIFAS ────────────────────────────────────────
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
export const VEICULOS = [
  { id:'3/4',      label:'Caminhão 3/4',           carga:3.5,  comp:5,  larg:2.30 },
  { id:'truck',    label:'Caminhão Truck',          carga:13,   comp:9,  larg:2.60 },
  { id:'bitruck',  label:'Caminhão Bi-truck',       carga:17,   comp:10, larg:2.60 },
  { id:'prancha3', label:'Carreta Prancha 3 eixos', carga:32,   comp:15, larg:3.00 },
  { id:'prancha4', label:'Carreta Prancha 4 eixos', carga:40,   comp:17, larg:3.00 },
]

// ── MAPEAMENTO GRUPO DE MODELO → VEÍCULO ─────────────────────
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

// ── BUSCA GRUPO DE MODELO NO CSV ──────────────────────────────
export function buscarGrupoModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]
  for (const n of lista) {
    const found = simClients.find(c =>
      String(c['Nº interno'] || c['N° interno'] || c['nInterno'] || '').trim() === String(n).trim()
    )
    if (found) return found['Grupo de modelo'] || found['grupoModelo'] || null
  }
  return null
}

// ── SUGESTÃO DE VEÍCULO ───────────────────────────────────────
export function sugerirVeiculo(grupoModelo) {
  if (!grupoModelo) return { veiculoId: null, sugerido: false }
  const id = GRUPO_VEICULO[grupoModelo.trim()]
  return id ? { veiculoId: id, sugerido: true } : { veiculoId: null, sugerido: false }
}

// ── CÁLCULO DE DISTÂNCIA: Nominatim + OSRM ───────────────────

/**
 * Busca coordenadas de uma cidade via Nominatim (OpenStreetMap).
 * Gratuito, sem chave de API, funciona direto no browser.
 */
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

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'mills-logistica/1.0' }
    })
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

/**
 * Calcula distância rodoviária real via OSRM (OpenStreetMap Routing Machine).
 * Gratuito, sem chave de API.
 * Fallback: Haversine × 1.3 se OSRM falhar.
 */
async function calcularDistanciaOSRM(coordO, coordD) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${coordO.lon},${coordO.lat};${coordD.lon},${coordD.lat}?overview=false`
    const res  = await fetch(url)
    const data = await res.json()
    if (data?.routes?.[0]?.distance) {
      return Math.round(data.routes[0].distance / 1000)
    }
  } catch { /* fallback abaixo */ }

  // Fallback: Haversine × 1.3
  const R    = 6371
  const dLat = (coordD.lat - coordO.lat) * Math.PI / 180
  const dLon = (coordD.lon - coordO.lon) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 +
    Math.cos(coordO.lat * Math.PI/180) * Math.cos(coordD.lat * Math.PI/180) * Math.sin(dLon/2)**2
  const linha = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(linha * 1.3)
}

/**
 * Função principal de cálculo de distância.
 * Retorna km ou null se não conseguir calcular.
 */
export async function calcularDistancia(cidadeOrigem, ufOrigem, cidadeDestino, ufDestino) {
  const [coordO, coordD] = await Promise.all([
    buscarCoordenadas(cidadeOrigem, ufOrigem),
    buscarCoordenadas(cidadeDestino, ufDestino),
  ])
  if (!coordO || !coordD) return null
  return calcularDistanciaOSRM(coordO, coordD)
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
 */
export function calcularFrete({
  km, veiculoId, tipoFrete = 'externo', subtype = '',
  outroEstado = false, comEscolta = false, diarias = 0, isGuindauto = false,
}) {
  if (!km || km <= 0 || !veiculoId) return null

  const ajuste = outroEstado ? 1.12 : 1
  let valorIda = 0, valorRetorno = 0, valorEscolta = 0, valorDiaria = 0

  // ── Guindauto: R$ 7,00/km fixo ──────────────────────────────
  if (isGuindauto) {
    const base = km * 7.00 * ajuste
    valorIda     = tipoFrete === 'interno' ? base * 0.70 : base
    valorRetorno = tipoFrete === 'interno' ? valorIda    : base * 0.30
    const total  = Math.round((valorIda + valorRetorno) * 100) / 100
    return {
      km, veiculoId, veiculoLabel: VEICULOS.find(v=>v.id===veiculoId)?.label || veiculoId,
      tipoFrete, subtype, isGuindauto: true,
      valorIda:     Math.round(valorIda * 100) / 100,
      valorRetorno: Math.round(valorRetorno * 100) / 100,
      valorRetornoLabel: tipoFrete === 'interno'
        ? `${formatBRL(Math.round(valorRetorno*100)/100)} (retorno carregado)`
        : `${formatBRL(Math.round(valorRetorno*100)/100)} (30% retorno vazio)`,
      valorEscolta: 0, valorDiaria: 0, ajuste, total,
      reembolsavel: subtype === 'sinistro',
      pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
    }
  }

  // ── Frete normal ────────────────────────────────────────────
  const baseIda = getValorIda(km, veiculoId) * ajuste

  if (tipoFrete === 'interno') {
    // Valdir (bi-truck): 30% desconto, volta carregado = mesmo valor da ida
    valorIda     = Math.round(baseIda * 0.70 * 100) / 100
    valorRetorno = valorIda
  } else {
    valorIda     = Math.round(baseIda * 100) / 100
    valorRetorno = Math.round(baseIda * 0.30 * 100) / 100
  }

  if (comEscolta) valorEscolta = Math.round(getValorEscolta(km) * ajuste * 100) / 100
  if (diarias > 0 && DIARIAS[veiculoId]) {
    valorDiaria = Math.round(DIARIAS[veiculoId] * diarias * ajuste * 100) / 100
  }

  const total = Math.round((valorIda + valorRetorno + valorEscolta + valorDiaria) * 100) / 100

  return {
    km,
    veiculoId,
    veiculoLabel: VEICULOS.find(v=>v.id===veiculoId)?.label || veiculoId,
    tipoFrete,
    subtype,
    isGuindauto: false,
    valorIda,
    valorRetorno,
    valorRetornoLabel: tipoFrete === 'interno'
      ? `${formatBRL(valorRetorno)} (retorno carregado)`
      : `${formatBRL(valorRetorno)} (30% retorno vazio)`,
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
