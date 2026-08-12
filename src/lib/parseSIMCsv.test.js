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
import { parseSIMCsv, buildFrotaIndex } from './utils'

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

  // Caso real: PCP01167 (Caterpillar 938K SC, confirmadamente cadastrada no
  // SIM) não aparecia em nenhum cliente da base carregada — a linha do CSV
  // não tinha Planta/Obra nem Cliente preenchidos (equipamento parado no
  // pátio, sem alocação atual), e a linha inteira era descartada antes de
  // guardar Fabricante/Modelo/Grupo de Modelo. A máquina simplesmente
  // desaparecia da base, mesmo estando corretamente registrada no SIM.
  it('sem Planta/Obra e sem Cliente (equipamento no pátio): não descarta a linha — agrupa num cliente sentinela pra manter a máquina pesquisável', () => {
    const csv = [
      'grupo;grupo;grupo;grupo',
      'Nº interno;Fabricante;Modelo;Grupo de modelo',
      'PCP01167;CATERPILLAR;938K-SC;Pá Carregadeira 15 a 17 t',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client).toBeDefined()
    expect(client.nInternos).toContain('PCP01167')
    expect(client.machineModelos['PCP01167']).toEqual({ fabricante:'CATERPILLAR', modelo:'938K-SC' })
    expect(client.machineGroups['PCP01167']).toBe('Pá Carregadeira 15 a 17 t')
  })

  it('linha sem Planta/Obra, sem Cliente E sem N° interno: continua descartada (nada pra agrupar nem pesquisar)', () => {
    const csv = [
      'grupo;grupo',
      'Estado (Planta/Obra);Família',
      'GO;Escavadeira',
    ].join('\n')
    const clients = parseSIMCsv(csv, Papa)
    expect(clients).toEqual([])
  })

  it('captura Horímetro/Valor de aquisição/Nº de série por nInterno, usados pelo painel de Solicitação de NF', () => {
    const csv = [
      'grupo;grupo;grupo;grupo;grupo;grupo;grupo',
      'Planta/Obra;Estado (Planta/Obra);Município (Planta/Obra);Nº interno;Horímetro;Valor de aquisição;Nº de série',
      'RAIZEN ENERGIA;SP;Assis;PCP01141;16410;R$ 730.000,00;CAT0938KCW8K02663',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client.machineHorimetro['PCP01141']).toBe('16410')
    expect(client.machineValor['PCP01141']).toBe('R$ 730.000,00')
    expect(client.machineSerie['PCP01141']).toBe('CAT0938KCW8K02663')

    const idx = buildFrotaIndex([client])
    expect(idx.get('PCP01141')).toEqual({
      nInterno:'PCP01141', client:'RAIZEN ENERGIA', city:'Assis', state:'SP',
      horimetro:'16410', valor:'R$ 730.000,00', serie:'CAT0938KCW8K02663',
    })
  })

  it('captura Horímetro/Valor/Série mesmo com grafia de cabeçalho diferente (sem acento, maiúscula, variante abreviada)', () => {
    const csv = [
      'grupo;grupo;grupo;grupo;grupo;grupo',
      'Planta/Obra;Estado (Planta/Obra);Nº interno;HORIMETRO;Vlr Aquisição;N° de Série',
      'RAIZEN ENERGIA;SP;PCP01141;16410;R$ 730.000,00;CAT0938KCW8K02663',
    ].join('\n')
    const [client] = parseSIMCsv(csv, Papa)
    expect(client.machineHorimetro['PCP01141']).toBe('16410')
    expect(client.machineValor['PCP01141']).toBe('R$ 730.000,00')
    expect(client.machineSerie['PCP01141']).toBe('CAT0938KCW8K02663')
  })
})
