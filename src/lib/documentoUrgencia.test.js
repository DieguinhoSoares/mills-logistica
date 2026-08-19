// ============================================================
// Testes de documentoUrgencia/documentoPrecisaConfirmacao/documentosPendentes
// — janelas de vencimento de documento de veículo combinadas com o usuário:
// 30d aviso / 15d alerta / 7d crítico (exige confirmação de renovação).
// ============================================================
import { describe, it, expect } from 'vitest'
import { documentoUrgencia, documentoPrecisaConfirmacao, documentosPendentes, todayStr } from './utils'

function diasAFrente(n) {
  const [y,m,d] = todayStr().split('-').map(Number)
  const dt = new Date(y, m-1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}

describe('documentoUrgencia', () => {
  it('sem validade: null (nada a mostrar)', () => {
    expect(documentoUrgencia(null)).toBe(null)
    expect(documentoUrgencia('')).toBe(null)
  })

  it('validade confortável (>30 dias): null', () => {
    expect(documentoUrgencia(diasAFrente(45))).toBe(null)
  })

  it('entre 16 e 30 dias: aviso', () => {
    expect(documentoUrgencia(diasAFrente(30))).toBe('aviso')
    expect(documentoUrgencia(diasAFrente(20))).toBe('aviso')
  })

  it('entre 8 e 15 dias: alerta', () => {
    expect(documentoUrgencia(diasAFrente(15))).toBe('alerta')
    expect(documentoUrgencia(diasAFrente(10))).toBe('alerta')
  })

  it('7 dias ou menos, ou já vencido: critico', () => {
    expect(documentoUrgencia(diasAFrente(7))).toBe('critico')
    expect(documentoUrgencia(diasAFrente(0))).toBe('critico')
    expect(documentoUrgencia(diasAFrente(-5))).toBe('critico')
  })
})

describe('documentoPrecisaConfirmacao', () => {
  it('crítico sem confirmação: true', () => {
    expect(documentoPrecisaConfirmacao({ validade: diasAFrente(3) })).toBe(true)
  })
  it('crítico já confirmado: false (não pede de novo até a validade mudar)', () => {
    expect(documentoPrecisaConfirmacao({ validade: diasAFrente(3), renovacaoSolicitada: true })).toBe(false)
  })
  it('fora do nível crítico: false, mesmo sem confirmação', () => {
    expect(documentoPrecisaConfirmacao({ validade: diasAFrente(20) })).toBe(false)
  })
})

describe('documentosPendentes', () => {
  it('achata documentos de vários veículos, ordenado crítico > alerta > aviso', () => {
    const veiculos = [
      { id:'v1', placa:'ABC1D23', tipo:'cavalo', documentos:[
        { tipo:'Seguro', validade: diasAFrente(20) },      // aviso
        { tipo:'CRLV',   validade: diasAFrente(400) },     // fora da janela — não entra
      ]},
      { id:'v2', placa:'XYZ9E87', tipo:'prancha', documentos:[
        { tipo:'ANTT/RNTRC', validade: diasAFrente(2) },   // critico
      ]},
    ]
    const pendentes = documentosPendentes(veiculos)
    expect(pendentes).toHaveLength(2)
    expect(pendentes[0].nivel).toBe('critico')
    expect(pendentes[0].veiculoPlaca).toBe('XYZ9E87')
    expect(pendentes[1].nivel).toBe('aviso')
    expect(pendentes[1].veiculoPlaca).toBe('ABC1D23')
  })
})
