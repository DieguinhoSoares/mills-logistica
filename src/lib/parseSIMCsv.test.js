// ============================================================
// Testes de parseSIMCsv — captura do campo Cliente separado de
// Planta/Obra. Bug real reportado: solicitante buscava pelo nome do
// cliente ("INFRAINVEST") no campo Planta/Obra do formulário e não
// encontrava nada, porque a obra específica tinha um nome de site
// diferente (ex: "Obra Rodovia BR-153") e só esse nome virava a chave
// buscável — o valor da coluna Cliente era descartado.
// ============================================================
import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { parseSIMCsv } from './utils'

describe('parseSIMCsv — Cliente capturado separado de Planta/Obra', () => {
  it('Planta/Obra com nome de site diferente do Cliente: nome agrupado é a Planta/Obra, mas Cliente fica disponível pra busca', () => {
    const csv = [
      'grupo;grupo;grupo;grupo;grupo;grupo',
      'Cliente;Planta/Obra;Estado (Planta/Obra);Município (Planta/Obra);Nº interno;Família',
      'INFRAINVEST;Obra Rodovia BR-153;GO;Anápolis;PCP01234;Escavadeira',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client.name).toBe('Obra Rodovia BR-153')
    expect(client.cliente).toBe('INFRAINVEST')
  })

  it('Planta/Obra e Cliente com o mesmo nome: não duplica (cliente fica vazio, evita "X · Cliente: X" redundante)', () => {
    const csv = [
      'grupo;grupo;grupo;grupo',
      'Cliente;Planta/Obra;Estado (Planta/Obra);Nº interno',
      'INFRAINVEST;INFRAINVEST;GO;PCP01234',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client.name).toBe('INFRAINVEST')
    expect(client.cliente).toBe('')
  })

  it('sem Planta/Obra, só Cliente: agrupa pelo Cliente (já era o comportamento — sem regressão)', () => {
    const csv = [
      'grupo;grupo;grupo',
      'Cliente;Estado (Planta/Obra);Nº interno',
      'INFRAINVEST;GO;PCP01234',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client.name).toBe('INFRAINVEST')
    expect(client.cliente).toBe('')
  })
})
