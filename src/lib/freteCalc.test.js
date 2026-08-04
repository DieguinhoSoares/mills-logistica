// ============================================================
// Testes do freteCalc.js — regras de cálculo de custo de frete
// (item 17 da revisão — é o código onde erro custa R$)
// Rodar: npm test
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcularFrete, selecionarVeiculoPorPeso, resolverVeiculoTransporte, analisarRotaComParadas, getValorIda, otimizarOrdemParadas, DIARIAS, VEICULOS, formatBRL, PESO_GRUPO, buscarGrupoModelo, buscarFabricanteModelo } from './freteCalc'

describe('calcularFrete — entradas inválidas', () => {
  it('retorna null sem km', () => {
    expect(calcularFrete({ km: 0, veiculoId: 'truck' })).toBeNull()
    expect(calcularFrete({ km: null, veiculoId: 'truck' })).toBeNull()
  })
  it('retorna null sem veículo', () => {
    expect(calcularFrete({ km: 100, veiculoId: '' })).toBeNull()
  })
})

describe('calcularFrete — Guindauto (R$6,00/km, sem ajuste de estado)', () => {
  it('ida = km × 6,00 e retorno ao pátio = ida', () => {
    const r = calcularFrete({ km: 100, veiculoId: 'x', isGuindauto: true, retornoAoPatio: true })
    expect(r.valorIda).toBe(600)
    expect(r.valorRetorno).toBe(600)
    expect(r.total).toBe(1200)
    expect(r.veiculoId).toBe('guindauto')
  })
  it('sem retorno ao pátio: retorno = 0', () => {
    const r = calcularFrete({ km: 100, veiculoId: 'x', isGuindauto: true, retornoAoPatio: false })
    expect(r.valorRetorno).toBe(0)
    expect(r.total).toBe(600)
  })
  it('ignora o adicional de outro estado (regra confirmada com a operação)', () => {
    const r = calcularFrete({ km: 100, veiculoId: 'x', isGuindauto: true, outroEstado: true, retornoAoPatio: true })
    expect(r.valorIda).toBe(600) // sem ×1,12
  })
})

describe('calcularFrete — Hengel/estimativa (tarifa cheia, retorno 30%)', () => {
  it('faixa fixa ≤50km: truck = R$1.143,22', () => {
    const r = calcularFrete({ km: 40, veiculoId: 'truck' })
    expect(r.valorIda).toBe(1143.22)
    expect(r.valorRetorno).toBe(Math.round(1143.22 * 0.30 * 100) / 100)
  })
  it('faixa fixa 51–100km: prancha3 = R$2.072,70', () => {
    const r = calcularFrete({ km: 80, veiculoId: 'prancha3' })
    expect(r.valorIda).toBe(2072.70)
  })
  it('faixa por km 101–250: bitruck = km × 15,38', () => {
    const r = calcularFrete({ km: 200, veiculoId: 'bitruck' })
    expect(r.valorIda).toBe(Math.round(200 * 15.38 * 100) / 100)
  })
  it('outro estado aplica +12%', () => {
    const r = calcularFrete({ km: 200, veiculoId: 'bitruck', outroEstado: true })
    expect(r.valorIda).toBe(Math.round(200 * 15.38 * 1.12 * 100) / 100)
  })
})

describe('calcularFrete — Frete Mills (desconto sobre Hengel, retorno = ida)', () => {
  it('bitruck (Valdir): 65% da tarifa Hengel', () => {
    const hengel = calcularFrete({ km: 200, veiculoId: 'bitruck' })
    const mills  = calcularFrete({ km: 200, veiculoId: 'bitruck', modo: 'mills' })
    expect(mills.valorIda).toBe(Math.round(hengel.valorIda * 0.65 * 100) / 100)
    expect(mills.valorRetorno).toBe(mills.valorIda) // volta carregada
  })
  it('prancha3 (Bento): 70% da tarifa Hengel', () => {
    const hengel = calcularFrete({ km: 200, veiculoId: 'prancha3' })
    const mills  = calcularFrete({ km: 200, veiculoId: 'prancha3', modo: 'mills' })
    expect(mills.valorIda).toBe(Math.round(hengel.valorIda * 0.70 * 100) / 100)
  })
})

describe('calcularFrete — escolta e diárias', () => {
  it('escolta ≤50km: fixo R$715', () => {
    const r = calcularFrete({ km: 40, veiculoId: 'truck', comEscolta: true })
    expect(r.valorEscolta).toBe(715)
  })
  it('diárias multiplicam a tabela do veículo', () => {
    const r = calcularFrete({ km: 40, veiculoId: 'prancha3', diarias: 2 })
    expect(r.valorDiaria).toBe(DIARIAS.prancha3 * 2)
    expect(r.total).toBe(Math.round((r.valorIda + r.valorRetorno + r.valorDiaria) * 100) / 100)
  })
})

describe('calcularFrete — flags de negócio', () => {
  it('sinistro é reembolsável e pago pela Mills', () => {
    const r = calcularFrete({ km: 100, veiculoId: 'truck', subtype: 'sinistro' })
    expect(r.reembolsavel).toBe(true)
    expect(r.pagoPorMills).toBe(true)
  })
  it('frete cliente comum não é pago pela Mills', () => {
    const r = calcularFrete({ km: 100, veiculoId: 'truck', subtype: 'entrega' })
    expect(r.reembolsavel).toBe(false)
    expect(r.pagoPorMills).toBe(false)
  })
})

describe('selecionarVeiculoPorPeso — escala BID 2024', () => {
  it('retorna null sem grupos', () => {
    expect(selecionarVeiculoPorPeso([])).toBeNull()
    expect(selecionarVeiculoPorPeso(null)).toBeNull()
  })
  it('limites de faixa batem com a capacidade dos veículos', () => {
    // As faixas (≤3,5 / ≤13 / ≤17 / ≤32 / >32) devem espelhar VEICULOS.carga
    const byId = Object.fromEntries(VEICULOS.map(v => [v.id, v.carga]))
    expect(byId['3/4']).toBe(3.5)
    expect(byId['truck']).toBe(13)
    expect(byId['bitruck']).toBe(17)
    expect(byId['prancha3']).toBe(32)
    expect(byId['prancha4']).toBe(40.5)
  })
  it('grupo desconhecido usa peso conservador (10,5t), não zero — bug real corrigido', () => {
    // Antes: um grupo sem peso cadastrado contava como 0 na soma, podendo
    // sugerir veículo menor que o necessário numa combinação de máquinas.
    const semNenhumConhecido = selecionarVeiculoPorPeso(['Grupo Totalmente Inventado'])
    expect(semNenhumConhecido.pesoTotal).toBe(10.5)
    expect(semNenhumConhecido.temGrupoDesconhecido).toBe(true)
  })
  it('combinação com 1 grupo conhecido + 1 desconhecido soma o conservador, não ignora o desconhecido', () => {
    const grupoConhecido = Object.keys(PESO_GRUPO)[0]
    const pesoConhecido  = PESO_GRUPO[grupoConhecido]
    const combo = selecionarVeiculoPorPeso([grupoConhecido, 'Grupo Inventado Xyz'])
    expect(combo.pesoTotal).toBeCloseTo(pesoConhecido + 10.5, 1)
    expect(combo.temGrupoDesconhecido).toBe(true)
  })
  it('todos os grupos conhecidos não sinaliza desconhecido', () => {
    const grupoConhecido = Object.keys(PESO_GRUPO)[0]
    const combo = selecionarVeiculoPorPeso([grupoConhecido])
    expect(combo.temGrupoDesconhecido).toBe(false)
  })
})

describe('formatBRL', () => {
  it('formata em pt-BR e tolera null', () => {
    expect(formatBRL(1234.5)).toMatch(/1\.234,50/)
    expect(formatBRL(null)).toMatch(/0,00/)
  })
})

// ── resolverVeiculoTransporte — reconhecimento de modelo (bug real: CAT 120) ──
describe('resolverVeiculoTransporte — reconhecimento de Fabricante+Modelo', () => {
  // Fixture mínima no formato que useSimClients monta a partir do CSV do SIM.
  const simClients = [{
    machineModelos: {
      'MNA00001': { fabricante: 'CATERPILLAR', modelo: '120' },
      'MNA00002': { fabricante: 'CATERPILLAR', modelo: '120' },
    },
  }]

  it('2x CAT 120 reconhece o modelo exato e usa peso real (15,7t cada), não o fallback de 10,5t', () => {
    const res = resolverVeiculoTransporte(['MNA00001', 'MNA00002'], [], simClients)
    // Antes do fix: modelo "120" não batia com a chave catalogada "120LVR",
    // cada unidade caía no fallback conservador de 10,5t (metade do peso real).
    expect(res.pesoIda).toBeCloseTo(15.7 * 2, 1)
    expect(res.veiculoId).not.toBe('truck') // 31,4t não cabe em truck (limite 13t)
  })

  it('máquina sem grupoModelo E sem modelo catalogado usa o fallback conservador (10,5t)', () => {
    const semDados = [{ machineModelos: { 'MNA09999': { fabricante: 'MARCA_DESCONHECIDA', modelo: 'X1' } } }]
    const res = resolverVeiculoTransporte(['MNA09999'], [], semDados)
    expect(res.pesoIda).toBeCloseTo(10.5, 1)
  })

  it('grupoModelo com faixa não catalogada cai na faixa mais próxima da MESMA categoria', () => {
    // "Motoniveladora 12 a 13 t" não existe em PESO_GRUPO (só 14-16/17-18/19-20) —
    // deve escolher "Motoniveladora 14 a 16 t" (15,0t, a mais próxima), nunca 0.
    const grupoNaoCatalogado = [{ machineGroups: { 'MNA05000': 'Motoniveladora 12 a 13 t' } }]
    const res = resolverVeiculoTransporte(['MNA05000'], [], grupoNaoCatalogado)
    expect(res.pesoIda).toBeCloseTo(15.0, 1) // faixa "14 a 16 t", não 0
  })
})

describe('buscarGrupoModelo/buscarFabricanteModelo — fallback numérico não adivinha entre máquinas diferentes', () => {
  it('MNA01106 (não cadastrado) x PC1106 (cadastrado) com mesmo sufixo numérico: match exato de PC1106 funciona normalmente', () => {
    const sim = [{ machineGroups: { 'PC1106': 'Escavadeira de Pneus 23 a 26 t' } }]
    expect(buscarGrupoModelo(['PC1106'], sim)).toBe('Escavadeira de Pneus 23 a 26 t')
  })

  it('2 N° internos com prefixos diferentes mas mesmo sufixo numérico (ex: MNA01106 e PC1106) → fallback numérico não escolhe nenhum dos dois (ambíguo)', () => {
    // Bug real: antes, Object.entries(...).find(...) pegava o primeiro que
    // encontrasse na ordem de iteração — podia devolver o grupo/peso da
    // máquina ERRADA silenciosamente. Agora recusa a adivinhar.
    const sim = [{ machineGroups: {
      'MNA01106': 'Mini Carregadeira 2 a 3 t',
      'PC1106':   'Escavadeira de Pneus 23 a 26 t',
    } }]
    // Busca por um 3º N° interno que não bate exato com nenhum dos dois,
    // mas cujo sufixo numérico (1106) colide com ambos.
    expect(buscarGrupoModelo(['XXX01106'], sim)).toBeNull()
  })

  it('fallback numérico ainda funciona quando só 1 candidato bate (caso comum: zero à esquerda/prefixo digitado diferente)', () => {
    const sim = [{ machineModelos: { 'MNA01106': { fabricante:'CATERPILLAR', modelo:'320GC' } } }]
    expect(buscarFabricanteModelo(['XXX1106'], sim)).toEqual({ fabricante:'CATERPILLAR', modelo:'320GC' })
  })
})

describe('resolverVeiculoTransporte — confiabilidade da sugestão (item não identificado)', () => {
  it('máquina não identificada marca temItemNaoIdentificado=true (sugestão não deve ser exibida como confiável)', () => {
    const semDados = [{ machineModelos: { 'MNA09999': { fabricante: 'MARCA_DESCONHECIDA', modelo: 'X1' } } }]
    const res = resolverVeiculoTransporte(['MNA09999'], [], semDados)
    expect(res.temItemNaoIdentificado).toBe(true)
  })

  it('máquinas 100% reconhecidas NÃO marcam temItemNaoIdentificado', () => {
    const reconhecidas = [{
      machineModelos: {
        'MNA00001': { fabricante: 'CATERPILLAR', modelo: '320GC' },
        'MNA00002': { fabricante: 'CATERPILLAR', modelo: '416F' },
      },
    }]
    const res = resolverVeiculoTransporte(['MNA00001', 'MNA00002'], [], reconhecidas)
    expect(res.temItemNaoIdentificado).toBe(false)
  })
})

describe('resolverVeiculoTransporte — categorias sempre rebocadas (Conjunto Canavieiro)', () => {
  it('Conjunto Canavieiro nunca sugere Prancha/Truck — sinaliza reboque manual', () => {
    const canavieiro = [{ machineGroups: { 'MNA07000': 'Conjunto Canavieiro 4 E / 34 t Conj.' } }]
    const res = resolverVeiculoTransporte(['MNA07000'], [], canavieiro)
    expect(res.rebocado).toBe(true)
    expect(res.veiculoId).toBeNull()
    expect(res.label).toContain('cavalo mecânico')
  })

  it('máquina normal (não rebocada) continua calculando peso normalmente', () => {
    const escavadeira = [{ machineModelos: { 'MNA00001': { fabricante: 'CATERPILLAR', modelo: '320GC' } } }]
    const res = resolverVeiculoTransporte(['MNA00001'], [], escavadeira)
    expect(res.rebocado).toBeUndefined()
    expect(res.veiculoId).not.toBeNull()
  })
})

// ── Bitrem 9 eixos — regra especial por-máquina (carreta bipartida, 2026-07) ──
describe('resolverVeiculoTransporte — Bitrem 9 eixos (porte L60F/924K, máx. 4 unidades)', () => {
  it('4x Volvo L60F (11,6t cada) vai de Bitrem — 46,4t excede a prancha4 (40,5t) mas está dentro do porte', () => {
    const ids = ['MNA10001', 'MNA10002', 'MNA10003', 'MNA10004']
    const machineModelos = {}
    ids.forEach(id => { machineModelos[id] = { fabricante: 'VOLVO', modelo: 'L60F' } })
    const res = resolverVeiculoTransporte(ids, [], [{ machineModelos }])
    expect(res.veiculoId).toBe('bitrem9')
    expect(res.pesoExcedido).toBe(false)
  })

  it('5x Volvo L60F excede o teto de 4 unidades do Bitrem — cai pra prancha4 com pesoExcedido', () => {
    const ids = ['MNA11001', 'MNA11002', 'MNA11003', 'MNA11004', 'MNA11005']
    const machineModelos = {}
    ids.forEach(id => { machineModelos[id] = { fabricante: 'VOLVO', modelo: 'L60F' } })
    const res = resolverVeiculoTransporte(ids, [], [{ machineModelos }])
    expect(res.veiculoId).not.toBe('bitrem9')
    expect(res.pesoExcedido).toBe(true)
  })

  it('3x Cat 930K (13,1t, acima do porte L60F/924K) nunca vai de Bitrem, mesmo com peso total dentro de 50t', () => {
    const ids = ['MNA12001', 'MNA12002', 'MNA12003']
    const machineModelos = {}
    ids.forEach(id => { machineModelos[id] = { fabricante: 'CATERPILLAR', modelo: '930K' } })
    const res = resolverVeiculoTransporte(ids, [], [{ machineModelos }])
    // peso total 39,3t < 50t (caberia no Bitrem por peso), mas cada 930K
    // individualmente (13,1t) já é maior que o porte L60F/924K (11,6t) —
    // regra é por-máquina, não pela soma. Comprimento somado (22,83m)
    // também excede a prancha4 (17m), então fica sinalizado.
    expect(res.veiculoId).not.toBe('bitrem9')
    expect(res.comprimentoExcedido).toBe(true)
  })
})

describe('resolverVeiculoTransporte — Trator Agrícola (dados reais deere.com.br)', () => {
  it('JD 7M 230 (220-230cv, 9,2t) cabe no Truck', () => {
    const g = [{ machineGroups: { 'MNA08001': 'Trator Agrícola 220 a 230 CV' } }]
    const res = resolverVeiculoTransporte(['MNA08001'], [], g)
    expect(res.veiculoId).toBe('truck')
  })
  it('JD 8270R (250-270cv, 14t) precisa de Bi-truck (peso)', () => {
    const g = [{ machineGroups: { 'MNA08002': 'Trator Agrícola 250 a 270 CV' } }]
    const res = resolverVeiculoTransporte(['MNA08002'], [], g)
    expect(res.veiculoId).toBe('bitruck')
  })
  it('JD 6150J (140-159cv, 8,55t) precisa de Bi-truck por LARGURA (2,65m > 2,60m do Truck), não por peso', () => {
    const g = [{ machineGroups: { 'MNA08003': 'Trator Agrícola 140 a 159 CV' } }]
    const res = resolverVeiculoTransporte(['MNA08003'], [], g)
    expect(res.veiculoId).toBe('bitruck')
  })
})

describe('resolverVeiculoTransporte — Empilhadeiras (peso extraído do texto do grupo)', () => {
  it('extrai o peso direto de "Empilhadeira Diesel 3,5 t / 3,7 m Elev."', () => {
    const g = [{ machineGroups: { 'MNA09001': 'Empilhadeira Diesel 3,5 t / 3,7 m Elev.' } }]
    const res = resolverVeiculoTransporte(['MNA09001'], [], g)
    expect(res.pesoIda).toBeCloseTo(3.5, 1)
    expect(res.temItemNaoIdentificado).toBe(false)
  })

  it('funciona sem casa decimal: "Empilhadeira Diesel 16 t / 6,1 m Elev."', () => {
    const g = [{ machineGroups: { 'MNA09002': 'Empilhadeira Diesel 16 t / 6,1 m Elev.' } }]
    const res = resolverVeiculoTransporte(['MNA09002'], [], g)
    expect(res.pesoIda).toBeCloseTo(16, 1)
  })

  it('duas empilhadeiras somam peso E comprimento (3,5t+8,6t=12,1t · 4,3m+5,8m=10,1m estoura o Bi-truck por comprimento → Prancha 3)', () => {
    const g = [{ machineGroups: {
      'MNA09003': 'Empilhadeira Diesel 3,5 t / 3,0 m Elev.',
      'MNA09004': 'Empilhadeira Diesel 8,6 t / 3,0 m Elev.',
    } }]
    const res = resolverVeiculoTransporte(['MNA09003','MNA09004'], [], g)
    expect(res.pesoIda).toBeCloseTo(12.1, 1)
    expect(res.veiculoId).toBe('prancha3')
  })

  it('variante nova/desconhecida ainda funciona (não precisa catalogar cada uma)', () => {
    const g = [{ machineGroups: { 'MNA09005': 'Empilhadeira Híbrida 5,2 t / 4,5 m Elev.' } }]
    const res = resolverVeiculoTransporte(['MNA09005'], [], g)
    expect(res.pesoIda).toBeCloseTo(5.2, 1)
    expect(res.temItemNaoIdentificado).toBe(false)
  })
})

describe('resolverVeiculoTransporte — item não identificado NÃO sugere veículo (força manual)', () => {
  it('veiculoId vem null quando há item não identificado — não arrisca sugerir Truck/Prancha', () => {
    const semDados = [{ machineModelos: { 'MNA09999': { fabricante: 'MARCA_DESCONHECIDA', modelo: 'X1' } } }]
    const res = resolverVeiculoTransporte(['MNA09999'], [], semDados)
    expect(res.veiculoId).toBeNull()
    expect(res.temItemNaoIdentificado).toBe(true)
  })
})

// ── analisarRotaComParadas — mocka rede (Nominatim + OSRM) p/ testes determinísticos ──
const MOCK_COORDS = {
  'Sumaré':          { lat:-22.82, lon:-47.27 },
  'São Paulo':       { lat:-23.55, lon:-46.63 },
  'Rio de Janeiro':  { lat:-22.90, lon:-43.17 },
  'Franca':          { lat:-20.53, lon:-47.40 },
  'Assis':           { lat:-22.66, lon:-50.41 },
  'Bauru':           { lat:-22.31, lon:-49.06 },
}
// km "reais" fictícios entre cada par usado nos testes (mesmo valor nos 2 sentidos)
const MOCK_KM = {
  'Sumaré|Rio de Janeiro': 430,
  'Sumaré|São Paulo': 100, 'São Paulo|Rio de Janeiro': 340,   // via SP: 100+340=440 (desvio ~2,3%)
  'Sumaré|Franca': 300,    'Franca|Rio de Janeiro': 430,       // via Franca: 300+430=730 (desvio ~69,8%)
  'Sumaré|Assis': 300,     'Assis|Bauru': 150,
}
function kmEntre(a, b) { return MOCK_KM[`${a}|${b}`] ?? MOCK_KM[`${b}|${a}`] ?? 999 }
function cidadeDoCoord(lon, lat) {
  return Object.entries(MOCK_COORDS).find(([,c]) => Math.abs(c.lon-lon)<0.001 && Math.abs(c.lat-lat)<0.001)?.[0]
}

function mockFetch(url) {
  if (url.includes('nominatim.openstreetmap.org')) {
    const m = decodeURIComponent(url).match(/city=([^&]+)/)
    const cidade = m?.[1]
    const c = MOCK_COORDS[cidade]
    return Promise.resolve({ json: async () => c ? [{ lat:String(c.lat), lon:String(c.lon) }] : [] })
  }
  if (url.includes('router.project-osrm.org')) {
    const path = url.split('/driving/')[1].split('?')[0]
    const pontos = path.split(';').map(p => p.split(',').map(Number)) // [lon,lat]
    const cidades = pontos.map(([lon,lat]) => cidadeDoCoord(lon,lat))
    const legs = []
    for (let i=0;i<cidades.length-1;i++) legs.push({ distance: kmEntre(cidades[i], cidades[i+1]) * 1000 })
    return Promise.resolve({ json: async () => ({ routes:[{ legs, distance: legs.reduce((a,l)=>a+l.distance,0) }] }) })
  }
  return Promise.resolve({ json: async () => ({}) })
}

describe('analisarRotaComParadas — peso por TRECHO (não soma tudo)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(mockFetch)) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('2 entregas: trecho 1 carrega as 2 juntas, trecho 2 só a que sobrou', async () => {
    const sim = [{ machineModelos: {
      'MNA0001': { fabricante:'CATERPILLAR', modelo:'320GC' }, // 20,5t
      'MNA0002': { fabricante:'CATERPILLAR', modelo:'416F'  }, // 7,2t
    } }]
    const paradas = [
      { tipo:'entrega', cidade:'Assis', uf:'SP', nInternos:['MNA0001'] },
      { tipo:'entrega', cidade:'Bauru', uf:'SP', nInternos:['MNA0002'] },
    ]
    const res = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim })
    // trecho 0 (Sumaré->Assis): as 2 juntas = 27,7t. trecho 1 (Assis->Bauru): só a 416F = 7,2t
    expect(res.trechos[0].peso).toBeCloseTo(27.7, 1)
    expect(res.trechos[1].peso).toBeCloseTo(7.2, 1)
    // pesoMax é o PIOR trecho (27,7t), não a soma de tudo (que também seria 27,7 aqui,
    // mas o ponto é que NÃO soma peso de trechos diferentes — ver teste de coleta abaixo)
    expect(res.pesoMax).toBeCloseTo(27.7, 1)
  })

  it('entrega + coleta: peso muda entre trechos sem somar o que já foi entregue', async () => {
    const sim = [{ machineModelos: {
      'MNA0001': { fabricante:'CATERPILLAR', modelo:'320GC' }, // 20,5t — vai (entrega)
      'MNA0002': { fabricante:'CATERPILLAR', modelo:'416F'  }, // 7,2t — volta (coleta)
    } }]
    const paradas = [
      { tipo:'entrega', cidade:'Assis', uf:'SP', nInternos:['MNA0001'] },
      { tipo:'coleta',  cidade:'Bauru', uf:'SP', nInternos:['MNA0002'] },
    ]
    const res = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim })
    // trecho 0 (Sumaré->Assis): carrega a 320GC (indo entregar) = 20,5t
    expect(res.trechos[0].peso).toBeCloseTo(20.5, 1)
    // trecho 1 (Assis->Bauru): já entregou a 320GC em Assis, ainda não coletou a 416F = 0t
    expect(res.trechos[1].peso).toBeCloseTo(0, 1)
    // pesoMax = 20,5t (pior trecho) — se somasse tudo, daria 27,7t e sugeriria veículo maior que o necessário
    expect(res.pesoMax).toBeCloseTo(20.5, 1)
  })
})

describe('analisarRotaComParadas — regra dos 10% de desvio', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(mockFetch)) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('parada "no caminho" (via São Paulo, ~2,3% de desvio) → cobra 1 trecho direto', async () => {
    const sim = [{ machineModelos: { 'MNA0001': { fabricante:'CATERPILLAR', modelo:'320GC' } } }]
    const paradas = [
      { tipo:'preparacao', cidade:'São Paulo',      uf:'SP', nInternos:['MNA0001'] },
      { tipo:'entrega',    cidade:'Rio de Janeiro',  uf:'RJ', nInternos:['MNA0001'] },
    ]
    const res = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim })
    expect(res.kmDireto).toBe(430)
    expect(res.kmReal).toBe(440)
    expect(res.ehDesvio).toBe(false)
    // Sem desvio: cobra 1 trecho pela distância DIRETA (430km), não pela
    // rota real (440km) nem pela soma de 2 trechos separados.
    const { calcularFrete } = await import('./freteCalc')
    const direto = calcularFrete({ km:430, veiculoId:res.veiculoId })
    expect(res.valorSugerido).toBeCloseTo(direto.valorIda, 2)
  })

  it('parada fora do caminho (via Franca, ~69,8% de desvio) → cobra trechos separados', async () => {
    const sim = [{ machineModelos: { 'MNA0001': { fabricante:'CATERPILLAR', modelo:'320GC' } } }]
    const paradas = [
      { tipo:'preparacao', cidade:'Franca',        uf:'SP', nInternos:['MNA0001'] },
      { tipo:'entrega',    cidade:'Rio de Janeiro', uf:'RJ', nInternos:['MNA0001'] },
    ]
    const res = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim })
    expect(res.kmDireto).toBe(430)
    expect(res.kmReal).toBe(730)
    expect(res.ehDesvio).toBe(true)
    expect(res.pernas).toEqual([300, 430])
    // Com desvio: soma cada perna separadamente pela tabela, sem desconto —
    // regra combinada com a operação: "soma os 1000+250 da tabela".
    const { calcularFrete } = await import('./freteCalc')
    const perna1 = calcularFrete({ km:300, veiculoId:res.veiculoId })
    const perna2 = calcularFrete({ km:430, veiculoId:res.veiculoId })
    expect(res.valorSugerido).toBeCloseTo(perna1.valorIda + perna2.valorIda, 2)
  })

  it('outroEstado=true aplica o adicional de +12% no valor combinado e no separado (bug real: FreteEstimativa mostrava o badge "+12% outro estado" sem o valor de rotaInfo ter esse adicional aplicado)', async () => {
    const sim = [{ machineModelos: { 'MNA0001': { fabricante:'CATERPILLAR', modelo:'320GC' } } }]
    const paradas = [
      { tipo:'preparacao', cidade:'São Paulo',     uf:'SP', nInternos:['MNA0001'] },
      { tipo:'entrega',    cidade:'Rio de Janeiro', uf:'RJ', nInternos:['MNA0001'] },
    ]
    const semAjuste = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim })
    const comAjuste = await analisarRotaComParadas({ origemCidade:'Sumaré', origemUf:'SP', paradas, simClients:sim, outroEstado:true })
    expect(comAjuste.valorCombinado).toBeCloseTo(semAjuste.valorCombinado * 1.12, 2)
    expect(comAjuste.valorSeparado).toBeCloseTo(semAjuste.valorSeparado * 1.12, 2)
    expect(comAjuste.valorSugerido).toBeCloseTo(semAjuste.valorSugerido * 1.12, 2)
  })
})

describe('Frete Rodando — opção manual, nunca calculada automaticamente', () => {
  it('calcularFrete devolve null pra frete_rodando (nunca calcula sozinho)', () => {
    expect(calcularFrete({ km: 300, veiculoId: 'frete_rodando' })).toBeNull()
  })
  it('getValorIda devolve 0 pra frete_rodando (sem tabela Hengel pra isso)', () => {
    expect(getValorIda(300, 'frete_rodando')).toBe(0)
  })
  it('Frete Rodando nunca é sugerido automaticamente (não está em ORDEM_VEICULOS)', () => {
    // Qualquer peso, mesmo 0, nunca resolve pra frete_rodando sozinho
    const escavadeira = [{ machineModelos: { 'MNA00001': { fabricante: 'CATERPILLAR', modelo: '320GC' } } }]
    const res = resolverVeiculoTransporte(['MNA00001'], [], escavadeira)
    expect(res.veiculoId).not.toBe('frete_rodando')
  })
  it('Frete Rodando existe como opção selecionável em VEICULOS', () => {
    expect(VEICULOS.some(v => v.id === 'frete_rodando')).toBe(true)
  })
})

describe('otimizarOrdemParadas — heurística do vizinho mais próximo', () => {
  it('reordena pra visitar o mais próximo a cada passo, partindo da origem (índice 0)', () => {
    // Origem=0, A=1 (longe, 100km), B=2 (perto da origem, 10km), C=3 (perto de B, 15km depois de B)
    const matriz = [
      /* origem */ [0,   100, 10,  50],
      /* A      */ [100, 0,   90,  60],
      /* B      */ [10,  90,  0,   15],
      /* C      */ [50,  60,  15,  0],
    ]
    const ordem = otimizarOrdemParadas(matriz)
    // Da origem, o mais perto é B(10km) → de B, o mais perto é C(15km) → de C, sobra A
    expect(ordem).toEqual([0, 2, 3, 1])
  })

  it('com 1 parada só, a ordem é trivial (origem + a parada)', () => {
    const matriz = [[0, 20], [20, 0]]
    expect(otimizarOrdemParadas(matriz)).toEqual([0, 1])
  })

  it('nunca visita a origem (índice 0) de novo nem repete parada', () => {
    const matriz = [
      [0, 5, 8, 3],
      [5, 0, 2, 9],
      [8, 2, 0, 4],
      [3, 9, 4, 0],
    ]
    const ordem = otimizarOrdemParadas(matriz)
    expect(new Set(ordem).size).toBe(4) // sem repetição
    expect(ordem[0]).toBe(0) // sempre começa na origem
  })

  it('bug real corrigido: quando o OSRM não acha rota até uma parada (Infinity), a ordem sai INCOMPLETA — quem chama precisa checar o tamanho antes de aplicar', () => {
    // Origem e A se enxergam bem, mas B é inalcançável de qualquer ponto
    // (Infinity em toda a linha/coluna dele) — situação real quando o OSRM
    // não consegue calcular rota rodoviária até algum destino.
    const matriz = [
      [0,        10,       Infinity],
      [10,       0,        Infinity],
      [Infinity, Infinity, 0       ],
    ]
    const ordem = otimizarOrdemParadas(matriz)
    // A função em si não trava nem inventa dado — só para de adicionar
    // paradas que não consegue alcançar. RotogramaModal.jsx é quem precisa
    // comparar ordem.length com matriz.length antes de aplicar o resultado
    // (ver correção em handleOtimizar), senão a parada B desaparece da rota
    // sem nenhum aviso.
    expect(ordem.length).toBeLessThan(matriz.length)
    expect(ordem).not.toContain(2) // parada B (índice 2) ficou de fora
  })
})
