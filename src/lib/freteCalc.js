// ============================================================
// freteCalc.js — Módulo de cálculo de custo de frete
// Mills Pesados | Divisão Pesados
// Tabela Reajustada 2026 (fator +2,4% sobre tabela anterior)
// Diárias e Escolta: valores negociados 2026
// Distância: Nominatim (coords) + OSRM (rota rodoviária real)
// ============================================================

// ── TABELA DE TARIFAS HENGEL — Reajustada 2026 ──────────────
// Frete ida: valor fixo (≤100km) ou R$/km (>100km)
// Fonte: Planilha Tabela Reajustada — coluna SP
const TABELA = [
  { min:0,    max:50,       fixo:true,  '3/4':739.77,  truck:1143.29, bitruck:1291.23, prancha3:1315.27, prancha4:1587.97 },
  { min:51,   max:100,      fixo:true,  '3/4':1143.29, truck:1681.29, bitruck:2017.56, prancha3:2072.81, prancha4:2479.44 },
  { min:101,  max:250,      fixo:false, '3/4':9.75,    truck:13.04,   bitruck:15.38,   prancha3:17.23,   prancha4:21.32   },
  { min:251,  max:500,      fixo:false, '3/4':8.91,    truck:11.43,   bitruck:14.06,   prancha3:15.94,   prancha4:19.32   },
  { min:501,  max:1000,     fixo:false, '3/4':8.16,    truck:11.01,   bitruck:13.17,   prancha3:15.15,   prancha4:18.42   },
  { min:1001, max:2000,     fixo:false, '3/4':7.97,    truck:10.71,   bitruck:12.89,   prancha3:14.59,   prancha4:17.73   },
  { min:2001, max:3000,     fixo:false, '3/4':7.89,    truck:10.68,   bitruck:12.72,   prancha3:14.48,   prancha4:17.56   },
  { min:3001, max:Infinity, fixo:false, '3/4':7.95,    truck:10.64,   bitruck:12.67,   prancha3:14.41,   prancha4:17.51   },
]

// ── DIÁRIAS — valores 2026 ────────────────────────────────────
export const DIARIAS = {
  '3/4':525.00, truck:607.00, bitruck:714.00, prancha3:840.00, prancha4:972.00,
}

// ── ESCOLTA / BATEDOR — valores 2026 ─────────────────────────
const ESCOLTA = [
  { max:50,       fixo:true,  valor:715.00 },
  { max:100,      fixo:true,  valor:858.00 },
  { max:250,      fixo:false, valor:5.50   },
  { max:500,      fixo:false, valor:4.40   },
  { max:Infinity, fixo:false, valor:3.90   },
]

// ── VEÍCULOS ─────────────────────────────────────────────────
// carga: capacidade útil máxima (t) conforme BID Mills 2024
export const VEICULOS = [
  { id:'3/4',      label:'Caminhão 3/4',           carga:3.5,  comp:5,  larg:2.30, eixos:2 },
  { id:'truck',    label:'Caminhão Truck',          carga:13,   comp:9,  larg:2.60, eixos:3 },
  { id:'bitruck',  label:'Caminhão Bi-truck',       carga:17,   comp:10, larg:3.20, eixos:4 },
  { id:'prancha3', label:'Carreta Prancha 3 eixos', carga:32,   comp:15, larg:3.00, eixos:6 },
  { id:'prancha4', label:'Carreta Prancha 4 eixos', carga:40.5, comp:17, larg:3.00, eixos:7 },
]

// Motoristas Mills e seus veículos / descontos sobre Hengel
export const MOTORISTAS_MILLS = [
  { id:'valdir', nome:'Valdir', veiculoId:'bitruck',  desconto:0.35, label:'Valdir — Bi-truck (35% abaixo Hengel)'  },
  { id:'bento',  nome:'Bento',  veiculoId:'prancha3', desconto:0.30, label:'Bento — Prancha 3 eixos (30% abaixo Hengel)' },
]

// ── MAPEAMENTO GRUPO DE MODELO → VEÍCULO ─────────────────────
// Baseado na escala de carga útil do BID Mills 2024:
//   ≤ 3,5t → 3/4 | ≤ 13t → truck | ≤ 17t → bitruck
//   ≤ 32t  → prancha3 | ≤ 40,5t → prancha4
const GRUPO_VEICULO = {
  'Carregadeira de Pneus 1 a 2 t':             '3/4',      // 1,5t
  'Carregadeira de Pneus 2 a 3 t':             '3/4',      // 2,5t
  'Carregadeira de Pneus 8 a 9 t':             'truck',    // 8,5t
  'Carregadeira de Pneus 10 a 11 t':           'truck',    // 10,5t
  'Carregadeira de Pneus 12 a 13 t':           'truck',    // 12,5t
  'Carregadeira de Pneus 14 a 16 t':           'bitruck',  // 15,0t
  'Carregadeira de Pneus 17 a 18 t':           'prancha3', // 17,5t
  'Carregadeira de Pneus 19 a 20 t':           'prancha3', // 19,5t
  'Carregadeira de Pneus 21 a 23 t':           'prancha3', // 22,0t
  'Mini Carregadeira 2 a 3 t':                 '3/4',      // 2,5t
  'Mini Carregadeira 4 a 5 t':                 'truck',    // 4,5t
  'Mini Escavadeira 3 t':                      '3/4',      // 3,0t
  'Escavadeira de esteiras 12 a 13 t':         'truck',    // 12,5t
  'Escavadeira de esteiras 14 a 16 t':         'bitruck',  // 15,0t
  'Escavadeira de esteiras 16 t':              'bitruck',  // 16,0t
  'Escavadeira de esteiras 17 a 20 t':         'prancha3', // 18,5t
  'Escavadeira de esteiras 20 a 22 t':         'prancha3', // 21,0t
  'Escavadeira de esteiras 30 a 36 t':         'prancha4', // 33,0t
  'Escavadeira de Pneus 23 a 26 t':            'prancha3', // 24,5t
  'Escavadeira Anfíbia 20t':                   'prancha3', // 20,0t
  'Motoniveladora 14 a 16 t':                  'bitruck',  // 15,0t
  'Motoniveladora 17 a 18 t':                  'prancha3', // 17,5t
  'Motoniveladora 19 a 20 t':                  'prancha3', // 19,5t
  'Retroescavadeira 7 a 9 t':                  'truck',    // 8,0t
  'Trator de Esteiras 14 a 16 t':              'bitruck',  // 15,0t
  'Trator de Esteiras 19 a 20 t':              'prancha3', // 19,5t
  'Trator de Esteiras 21 a 22 t':              'prancha3', // 21,5t
  'Trator de Esteiras 23 a 29 t':              'prancha3', // 26,0t
  'Trator de Esteiras 39 t':                   'prancha4', // 39,0t
  'Compactador Vibratório 10 a 11 t / Liso':   'truck',    // 10,5t
  'Compactador Vibratório 10 a 11 t / Kit PD': 'truck',    // 10,5t
  'Compactador Vibratório 10 a 11 t / PD':     'truck',    // 10,5t
  'Compactador Vibratório 12 a 13 t / Kit PD': 'truck',    // 12,5t
  'Compactador Vibratório 21 t':               'prancha3', // 21,0t
  'Compactador Tandem 10 a 11 t / Liso':       'truck',    // 10,5t
  'Compactador Tandem 7t':                     'truck',    // 7,0t
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 'prancha3', // 27,0t
  'Mini Compactador Tandem 2 a 3 t / Liso':    '3/4',      // 2,5t
  'Mini Compactador 1,5 t':                    '3/4',      // 1,5t
}

// ── PESO OPERACIONAL POR GRUPO DE MODELO (t) ─────────────────
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

// ── BUSCA GRUPO DE MODELO NO CSV SIM ─────────────────────────
export function buscarGrupoModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]

  for (const n of lista) {
    const nStr = String(n).trim()
    const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')

    for (const c of simClients) {
      // ── Caminho principal: machineGroups[nInterno] → grupoModelo ────────────
      // simClients agrupa por cliente; machineGroups mapeia cada N° interno
      // para seu grupoModelo extraído do CSV.
      if (c.machineGroups) {
        // Match exato
        if (c.machineGroups[nStr]) return c.machineGroups[nStr]
        // Match numérico (ex: MNA01106 → 1106)
        const entry = Object.entries(c.machineGroups).find(([k]) =>
          String(k).replace(/\D/g, '').replace(/^0+/, '') === nNum
        )
        if (entry) return entry[1]
      }

      // ── Fallback: N° interno está na lista mas sem grupoModelo ────────────
      // Verifica se o N° interno pertence a este cliente (array nInternos)
      const internos = Array.isArray(c.nInternos) ? c.nInternos : []
      const match = internos.find(k => {
        const kStr = String(k).trim()
        const kNum = kStr.replace(/\D/g, '').replace(/^0+/, '')
        return kStr === nStr || kNum === nNum
      })
      if (match) {
        // N° interno encontrado mas sem grupoModelo no CSV — retorna null
        // (vehicle selection vai cair no fallback da FreteEstimativa)
        return null
      }
    }
  }
  return null
}

// ── SUGESTÃO DE VEÍCULO por grupo de modelo ──────────────────
export function sugerirVeiculo(grupoModelo) {
  if (!grupoModelo) return { veiculoId: null, sugerido: false }
  const id = GRUPO_VEICULO[grupoModelo.trim()]
  return id ? { veiculoId: id, sugerido: true } : { veiculoId: null, sugerido: false }
}

// ── SELEÇÃO DE VEÍCULO por peso combinado (multi-carga) ──────
export function selecionarVeiculoPorPeso(grupos) {
  if (!grupos?.length) return null
  const pesoTotal = grupos.reduce((acc, g) => acc + (PESO_GRUPO[g] || 0), 0)
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

/**
 * Resolve veículo necessário com base no peso somado de cada sentido.
 *
 * Regras BID:
 *   - Soma pesos das máquinas em cada sentido separadamente
 *   - Dimensiona pelo sentido mais pesado
 *   - Faixa ≤32t: Prancha 3 (suportado por Mills)
 *   - Faixa ≤40,5t: Prancha 4 (somente Hengel)
 *   - requiresEspecial → força bi-truck com cabo reboque (VM330)
 *
 * @param {string[]} nInternosIda   — N° internos reserva (vai ao cliente)
 * @param {string[]} nInternosVolta — N° internos danificadas (retornam)
 * @param {object[]} simClients     — CSV SIM para lookup grupoModelo
 * @param {boolean}  requiresEspecial
 */
export function resolverVeiculoTransporte(
  nInternosIda   = [],
  nInternosVolta = [],
  simClients     = [],
  requiresEspecial = false,
) {
  // Equipamento especial (VM330): força bi-truck com cabo reboque
  if (requiresEspecial) {
    return {
      veiculoId: 'bitruck',
      pesoIda: 0, pesoVolta: 0, pesoMax: 0,
      sentidoPesado: null,
      milsSuporta: true,
      especial: true,
      label: 'Bi-truck · cabo reboque',
      veiculo: VEICULOS.find(v => v.id === 'bitruck'),
    }
  }

  const calcPeso = (lista) =>
    lista.reduce((acc, n) => {
      const grupo = buscarGrupoModelo([n], simClients)
      return acc + (grupo ? (PESO_GRUPO[grupo] || 0) : 0)
    }, 0)

  const pesoIda   = Math.round(calcPeso(nInternosIda)   * 10) / 10
  const pesoVolta = Math.round(calcPeso(nInternosVolta)  * 10) / 10
  const pesoMax   = Math.max(pesoIda, pesoVolta)

  let veiculoId
  if      (pesoMax <= 3.5)  veiculoId = '3/4'
  else if (pesoMax <= 13)   veiculoId = 'truck'
  else if (pesoMax <= 17)   veiculoId = 'bitruck'
  else if (pesoMax <= 32)   veiculoId = 'prancha3'
  else                      veiculoId = 'prancha4'   // ≤40,5t — somente Hengel

  const sentidoPesado = pesoIda >= pesoVolta ? 'ida' : 'volta'
  const milsSuporta   = pesoMax <= 32   // prancha4 → somente Hengel

  return {
    veiculoId,
    pesoIda,
    pesoVolta,
    pesoMax:  Math.round(pesoMax * 10) / 10,
    sentidoPesado,
    milsSuporta,
    especial: false,
    label: null,
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
    Math.cos(coordO.lat*Math.PI/180)*Math.cos(coordD.lat*Math.PI/180)*Math.sin(dLon/2)**2
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
 * Calcula custo de frete.
 *
 * modo = 'estimativa' (padrão — Hengel, retorno 30%):
 *   Usado por solicitante e gestores. Preço de mercado.
 *
 * modo = 'mills':
 *   Usado por Frotas ao atribuir motorista Mills.
 *   bitruck  → 35% abaixo Hengel, retorno = ida
 *   prancha3 → 30% abaixo Hengel, retorno = ida
 *
 * modo = 'hengel':
 *   Usado por Frotas ao atribuir Hengel. Tarifa cheia, retorno 30%.
 *
 * Guindauto: R$6,00/km fixo, retorno = ida (se retorna ao pátio)
 */
export function calcularFrete({
  km, veiculoId, modo = 'estimativa', subtype = '',
  outroEstado = false, comEscolta = false, diarias = 0,
  isGuindauto = false, retornoAoPatio = true,
}) {
  if (!km || km <= 0) return null
  if (!veiculoId) return null

  const ajuste = outroEstado ? 1.12 : 1
  let valorIda = 0, valorRetorno = 0, valorEscolta = 0, valorDiaria = 0

  // ── Guindauto ────────────────────────────────────────────────
  if (isGuindauto) {
    valorIda     = Math.round(km * 6.00 * 100) / 100
    valorRetorno = retornoAoPatio ? valorIda : 0
    const total  = Math.round((valorIda + valorRetorno) * 100) / 100
    return {
      km, veiculoId: 'guindauto', veiculoLabel: 'Caminhão Guindauto',
      modo, subtype, isGuindauto: true,
      valorIda, valorRetorno,
      valorRetornoLabel: retornoAoPatio
        ? `${formatBRL(valorRetorno)} (retorno ao pátio)`
        : 'Sem retorno',
      valorEscolta: 0, valorDiaria: 0, ajuste: 1, total,
      reembolsavel: subtype === 'sinistro',
      pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
    }
  }

  // ── Mills ────────────────────────────────────────────────────
  // bitruck: 35% abaixo Hengel | prancha3: 30% abaixo Hengel
  // Retorno = ida (volta carregada)
  if (modo === 'mills') {
    const desconto = veiculoId === 'prancha3' ? 0.70 : 0.65
    const baseIda  = getValorIda(km, veiculoId) * ajuste
    valorIda     = Math.round(baseIda * desconto * 100) / 100
    valorRetorno = valorIda
  } else {
    // ── Hengel / Estimativa ──────────────────────────────────
    // Tarifa cheia, retorno 30%
    const baseIda = getValorIda(km, veiculoId) * ajuste
    valorIda      = Math.round(baseIda * 100) / 100
    valorRetorno  = Math.round(baseIda * 0.30 * 100) / 100
  }

  if (comEscolta) valorEscolta = Math.round(getValorEscolta(km) * ajuste * 100) / 100
  if (diarias > 0 && DIARIAS[veiculoId]) {
    valorDiaria = Math.round(DIARIAS[veiculoId] * diarias * ajuste * 100) / 100
  }

  const total   = Math.round((valorIda + valorRetorno + valorEscolta + valorDiaria) * 100) / 100
  const veiculo = VEICULOS.find(v => v.id === veiculoId)

  return {
    km, veiculoId,
    veiculoLabel: veiculo?.label || veiculoId,
    eixos:        veiculo?.eixos || 0,
    modo, subtype, isGuindauto: false,
    valorIda, valorRetorno,
    valorRetornoLabel: formatBRL(valorRetorno),
    valorEscolta, valorDiaria, ajuste, total,
    reembolsavel: subtype === 'sinistro',
    pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
  }
}

export function formatBRL(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
