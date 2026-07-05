// ============================================================
// Testes de sortByUrgency — ordenação das filas de aprovação
// Cobre os riscos do handoff: urgency/desiredDate nulos em
// registros antigos do Firestore não podem quebrar nem ir pro topo.
// ============================================================
import { describe, it, expect } from 'vitest'
import { sortByUrgency } from './constants'

const mk = (urgency, desiredDate, id) => ({ urgency, desiredDate, id })

describe('sortByUrgency — ordem de urgência', () => {
  it('crítico → alto → médio → baixo', () => {
    const out = sortByUrgency([
      mk('baixo', '2026-07-10', 'b'),
      mk('critico', '2026-07-10', 'c'),
      mk('medio', '2026-07-10', 'm'),
      mk('alto', '2026-07-10', 'a'),
    ])
    expect(out.map(x => x.id)).toEqual(['c', 'a', 'm', 'b'])
  })

  it('mesma urgência: prazo mais próximo primeiro', () => {
    const out = sortByUrgency([
      mk('alto', '2026-07-20', 'depois'),
      mk('alto', '2026-07-06', 'antes'),
    ])
    expect(out.map(x => x.id)).toEqual(['antes', 'depois'])
  })
})

describe('sortByUrgency — dados sujos de produção (risco 2 do handoff)', () => {
  it('urgency null/desconhecida vai para o fim, não para o topo', () => {
    const out = sortByUrgency([
      mk(null, '2026-07-06', 'semUrgencia'),
      mk('baixo', '2026-07-06', 'baixo'),
      mk('critico', '2026-07-06', 'critico'),
    ])
    expect(out[0].id).toBe('critico')
    expect(out[out.length - 1].id).toBe('semUrgencia')
  })

  it('desiredDate ausente vai para o fim da mesma urgência', () => {
    const out = sortByUrgency([
      mk('alto', undefined, 'semData'),
      mk('alto', '2026-07-06', 'comData'),
    ])
    expect(out.map(x => x.id)).toEqual(['comData', 'semData'])
  })

  it('desiredDate inválida ("abc") não quebra e vai para o fim', () => {
    const out = sortByUrgency([
      mk('alto', 'abc', 'invalida'),
      mk('alto', '2026-07-06', 'valida'),
    ])
    expect(out.map(x => x.id)).toEqual(['valida', 'invalida'])
  })

  it('não muta o array original', () => {
    const arr = [mk('baixo', '2026-07-10', 'b'), mk('critico', '2026-07-10', 'c')]
    const copia = [...arr]
    sortByUrgency(arr)
    expect(arr).toEqual(copia)
  })
})
