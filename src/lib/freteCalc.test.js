// ============================================================
// Testes do freteCalc.js — regras de cálculo de custo de frete
// (item 17 da revisão — é o código onde erro custa R$)
// Rodar: npm test
// ============================================================
import { describe, it, expect } from 'vitest'
import { calcularFrete, selecionarVeiculoPorPeso, resolverVeiculoTransporte, DIARIAS, VEICULOS, formatBRL } from './freteCalc'

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
  it('faixa fixa ≤50km: truck = R$1.143,29', () => {
    const r = calcularFrete({ km: 40, veiculoId: 'truck' })
    expect(r.valorIda).toBe(1143.29)
    expect(r.valorRetorno).toBe(Math.round(1143.29 * 0.30 * 100) / 100)
  })
  it('faixa fixa 51–100km: prancha3 = R$2.072,81', () => {
    const r = calcularFrete({ km: 80, veiculoId: 'prancha3' })
    expect(r.valorIda).toBe(2072.81)
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
