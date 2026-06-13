// ============================================================
// freteCalc.js — Módulo de cálculo de custo de frete
// Mills Pesados | Divisão Pesados
// Tabela de referência: março/2026
// ============================================================

// ── TABELA DE TARIFAS ────────────────────────────────────────
const TABELA_SP = [
  { label: 'Até 50 km',        min: 0,    max: 50,   fixo: true,  '3/4': 722.43,  truck: 1116.49, bitruck: 1260.97, prancha3: 1284.44, prancha4: 1550.75 },
  { label: '51 a 100 km',      min: 51,   max: 100,  fixo: true,  '3/4': 1116.49, truck: 1641.89, bitruck: 1970.27, prancha3: 2024.23, prancha4: 2421.72 },
  { label: '101 a 250 km',     min: 101,  max: 250,  fixo: false, '3/4': 9.52,    truck: 12.73,   bitruck: 15.02,   prancha3: 16.83,   prancha4: 20.82   },
  { label: '251 a 500 km',     min: 251,  max: 500,  fixo: false, '3/4': 8.70,    truck: 11.16,   bitruck: 13.73,   prancha3: 15.57,   prancha4: 18.87   },
  { label: '501 a 1000 km',    min: 501,  max: 1000, fixo: false, '3/4': 7.97,    truck: 10.75,   bitruck: 12.86,   prancha3: 14.80,   prancha4: 17.99   },
  { label: '1001 a 2000 km',   min: 1001, max: 2000, fixo: false, '3/4': 7.78,    truck: 10.46,   bitruck: 12.59,   prancha3: 14.25,   prancha4: 17.31   },
  { label: '2001 a 3000 km',   min: 2001, max: 3000, fixo: false, '3/4': 7.71,    truck: 10.43,   bitruck: 12.42,   prancha3: 14.14,   prancha4: 17.15   },
  { label: 'Acima de 3000 km', min: 3001, max: Infinity, fixo: false, '3/4': 7.76, truck: 10.39, bitruck: 12.37,  prancha3: 14.07,   prancha4: 17.10   },
]

const DIARIAS = {
  '3/4':     573.35,
  truck:     662.90,
  bitruck:   779.75,
  prancha3:  917.36,
  prancha4: 1061.51,
}

const ESCOLTA_SP = [
  { max: 50,       fixo: true,  valor: 780.85 },
  { max: 100,      fixo: true,  valor: 937.01 },
  { max: 250,      fixo: false, valor: 6.01   },
  { max: 500,      fixo: false, valor: 4.81   },
  { max: Infinity, fixo: false, valor: 4.26   },
]

// ── VEÍCULOS ─────────────────────────────────────────────────
export const VEICULOS = [
  { id: '3/4',     label: 'Caminhão 3/4',         carga: 3.5,  comp: 5,  larg: 2.30 },
  { id: 'truck',   label: 'Caminhão Truck',        carga: 13,   comp: 9,  larg: 2.60 },
  { id: 'bitruck', label: 'Caminhão Bi-truck',     carga: 17,   comp: 10, larg: 2.60 },
  { id: 'prancha3',label: 'Carreta Prancha 3 eixos', carga: 32, comp: 15, larg: 3.00 },
  { id: 'prancha4',label: 'Carreta Prancha 4 eixos', carga: 40, comp: 17, larg: 3.00 },
]

// ── SUGESTÃO DE VEÍCULO POR GRUPO DE MODELO ──────────────────
const GRUPO_VEICULO = {
  // Carregadeiras de Pneus
  'Carregadeira de Pneus 1 a 2 t':   '3/4',
  'Carregadeira de Pneus 2 a 3 t':   '3/4',
  'Carregadeira de Pneus 8 a 9 t':   'truck',
  'Carregadeira de Pneus 10 a 11 t': 'bitruck',
  'Carregadeira de Pneus 12 a 13 t': 'bitruck',
  'Carregadeira de Pneus 14 a 16 t': 'prancha3',
  'Carregadeira de Pneus 17 a 18 t': 'prancha3',
  'Carregadeira de Pneus 19 a 20 t': 'prancha4',
  'Carregadeira de Pneus 21 a 23 t': 'prancha4',
  // Mini Carregadeiras
  'Mini Carregadeira 2 a 3 t':        '3/4',
  'Mini Carregadeira 4 a 5 t':        'truck',
  'Mini Escavadeira 3 t':             '3/4',
  // Escavadeiras de Esteiras
  'Escavadeira de esteiras 12 a 13 t': 'bitruck',
  'Escavadeira de esteiras 14 a 16 t': 'prancha3',
  'Escavadeira de esteiras 16 t':      'prancha3',
  'Escavadeira de esteiras 17 a 20 t': 'prancha3',
  'Escavadeira de esteiras 20 a 22 t': 'prancha3',
  'Escavadeira de esteiras 30 a 36 t': 'prancha4',
  'Escavadeira de Pneus 23 a 26 t':    'prancha4',
  'Escavadeira Anfíbia 20t':           'prancha3',
  // Motoniveladoras
  'Motoniveladora 14 a 16 t': 'prancha3',
  'Motoniveladora 17 a 18 t': 'prancha3',
  'Motoniveladora 19 a 20 t': 'prancha4',
  // Retroescavadeiras
  'Retroescavadeira 7 a 9 t': 'truck',
  // Tratores de Esteiras
  'Trator de Esteiras 14 a 16 t': 'prancha3',
  'Trator de Esteiras 19 a 20 t': 'prancha3',
  'Trator de Esteiras 21 a 22 t': 'prancha4',
  'Trator de Esteiras 23 a 29 t': 'prancha4',
  'Trator de Esteiras 39 t':      'prancha4',
  // Compactadores
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

/**
 * Sugere o veículo com base no grupo de modelo.
 * Retorna { veiculoId, sugerido: true } ou { veiculoId: null, sugerido: false }
 */
export function sugerirVeiculo(grupoModelo) {
  if (!grupoModelo) return { veiculoId: null, sugerido: false }
  const id = GRUPO_VEICULO[grupoModelo.trim()]
  return id ? { veiculoId: id, sugerido: true } : { veiculoId: null, sugerido: false }
}

// ── CÁLCULO DE DISTÂNCIA (coordenadas IBGE × fator 1.3) ──────
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  const linha = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(linha * 1.3)
}

export async function calcularDistancia(cidadeOrigemNome, ufOrigem, cidadeDestinoNome, ufDestino) {
  try {
    const [resO, resD] = await Promise.all([
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(cidadeOrigemNome)}`),
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(cidadeDestinoNome)}`),
    ])
    const [munOs, munDs] = await Promise.all([resO.json(), resD.json()])

    const munO = munOs.find(m => m.microrregiao?.mesorregiao?.UF?.sigla === ufOrigem) || munOs[0]
    const munD = munDs.find(m => m.microrregiao?.mesorregiao?.UF?.sigla === ufDestino) || munDs[0]

    if (!munO || !munD) return null

    const [resOCoord, resDCoord] = await Promise.all([
      fetch(`https://servicodados.ibge.gov.br/api/v2/malhas/${munO.id}?formato=application/vnd.geo+json`),
      fetch(`https://servicodados.ibge.gov.br/api/v2/malhas/${munD.id}?formato=application/vnd.geo+json`),
    ])
    const [geoO, geoD] = await Promise.all([resOCoord.json(), resDCoord.json()])

    const coordO = geoO?.features?.[0]?.geometry?.coordinates?.[0]?.[0]
    const coordD = geoD?.features?.[0]?.geometry?.coordinates?.[0]?.[0]

    if (!coordO || !coordD) return null

    return distanciaKm(coordO[1], coordO[0], coordD[1], coordD[0])
  } catch {
    return null
  }
}

// ── CÁLCULO DE FRETE ─────────────────────────────────────────
function getFaixa(km) {
  return TABELA_SP.find(f => km >= f.min && km <= f.max)
}

function calcularIda(km, veiculoId) {
  const faixa = getFaixa(km)
  if (!faixa) return 0
  return faixa.fixo ? faixa[veiculoId] : Math.round(faixa[veiculoId] * km * 100) / 100
}

function calcularEscolta(km) {
  const faixa = ESCOLTA_SP.find(f => km <= f.max)
  if (!faixa) return 0
  return faixa.fixo ? faixa.valor : Math.round(faixa.valor * km * 100) / 100
}

/**
 * Calcula o custo estimado de frete.
 *
 * @param {object} params
 * @param {number}  params.km            - Distância em km
 * @param {string}  params.veiculoId     - ID do veículo (3/4, truck, bitruck, prancha3, prancha4)
 * @param {string}  params.tipoFrete     - 'interno' (Valdir) | 'externo' (transportadora)
 * @param {string}  params.subtype       - subtipo da solicitação (sinistro, troca_tecnica, garantia...)
 * @param {boolean} params.outroEstado   - true se origem ou destino fora de SP
 * @param {boolean} params.comEscolta    - true se requer escolta/batedor
 * @param {number}  params.diarias       - número de diárias (0 se nenhuma)
 * @param {boolean} params.isGuindauto   - true se for guindauto
 *
 * @returns {object} detalhamento completo do custo
 */
export function calcularFrete({
  km,
  veiculoId,
  tipoFrete = 'externo',
  subtype = '',
  outroEstado = false,
  comEscolta = false,
  diarias = 0,
  isGuindauto = false,
}) {
  if (!km || km <= 0) return null

  let valorIda = 0
  let valorRetorno = 0
  let valorEscolta = 0
  let valorDiaria = 0
  let ajusteEstado = 1
  let desconto = 1

  if (outroEstado) ajusteEstado = 1.12

  // ── Guindauto: R$ 7,00/km fixo ──────────────────────────────
  if (isGuindauto) {
    valorIda = km * 7.00
    valorRetorno = km * 7.00 * 0.30 // retorno externo padrão
    if (tipoFrete === 'interno') {
      valorIda = km * 7.00 * 0.70  // 30% desconto interno
      valorRetorno = valorIda       // interno: volta carregado
    }
    const total = (valorIda + valorRetorno) * ajusteEstado
    return {
      km, veiculoId, tipoFrete, subtype, isGuindauto: true,
      valorIda, valorRetorno, valorEscolta: 0, valorDiaria: 0,
      ajusteEstado, desconto: tipoFrete === 'interno' ? 0.30 : 0,
      total: Math.round(total * 100) / 100,
      reembolsavel: subtype === 'sinistro',
      pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
    }
  }

  // ── Frete normal ────────────────────────────────────────────
  valorIda = calcularIda(km, veiculoId) * ajusteEstado

  if (tipoFrete === 'interno') {
    // Valdir (bi-truck): 30% de desconto, ida e volta carregado
    desconto = 0.30
    valorIda = valorIda * 0.70
    valorRetorno = valorIda // volta carregado = mesmo valor
  } else {
    // Transportadora externa: 30% sobre a ida para retorno vazio
    valorRetorno = valorIda * 0.30
  }

  if (comEscolta) {
    valorEscolta = calcularEscolta(km) * ajusteEstado
  }

  if (diarias > 0 && DIARIAS[veiculoId]) {
    valorDiaria = DIARIAS[veiculoId] * diarias * ajusteEstado
  }

  const total = Math.round((valorIda + valorRetorno + valorEscolta + valorDiaria) * 100) / 100

  return {
    km,
    veiculoId,
    veiculoLabel: VEICULOS.find(v => v.id === veiculoId)?.label || veiculoId,
    tipoFrete,
    subtype,
    isGuindauto: false,
    valorIda:     Math.round(valorIda * 100) / 100,
    valorRetorno: Math.round(valorRetorno * 100) / 100,
    valorEscolta: Math.round(valorEscolta * 100) / 100,
    valorDiaria:  Math.round(valorDiaria * 100) / 100,
    ajusteEstado,
    desconto: tipoFrete === 'interno' ? 0.30 : 0,
    total,
    reembolsavel:  subtype === 'sinistro',
    pagoPorMills:  ['sinistro','troca_tecnica','garantia'].includes(subtype),
  }
}

// ── FORMATAÇÃO ───────────────────────────────────────────────
export function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
