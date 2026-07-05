// ============================================================
// Testes do freteCalc.js — regras de cálculo de custo de frete
// (item 17 da revisão — é o código onde erro custa R$)
// Rodar: npm test
// ============================================================
import { describe, it, expect } from 'vitest'
import { calcularFrete, selecionarVeiculoPorPeso, DIARIAS, VEICULOS, formatBRL } from './freteCalc'

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
