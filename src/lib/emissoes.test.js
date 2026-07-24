import { describe, it, expect } from 'vitest'
import { calcularEmissaoCard, calcularEscopo, buscarCep, montarLinhaRelatorio, resumirEmissoes, diagnosticarLacunasEmissao } from './emissoes'

// Casos abaixo replicam EXATAMENTE as 10 linhas da planilha de exemplo
// fornecida pela Mills — servem tanto de teste quanto de documentação viva
// da fórmula usada (km ÷ consumo médio do veículo × 2,68 kg CO2/litro).
describe('calcularEmissaoCard — validado contra a planilha real de exemplo', () => {
  it('Cerquilho → Sumaré, 100km, 3/4: consumo 16,67L, emissão 44,67kg', () => {
    const r = calcularEmissaoCard({ km:100, veiculoId:'3/4' })
    expect(r.consumoLitros).toBeCloseTo(16.67, 1)
    expect(r.emissaoKg).toBeCloseTo(44.67, 1)
  })

  it('Brusque → Sumaré, 725km, Prancha 3 eixos: consumo 329,55L, emissão 883,18kg', () => {
    const r = calcularEmissaoCard({ km:725, veiculoId:'prancha3' })
    expect(r.consumoLitros).toBeCloseTo(329.55, 1)
    expect(r.emissaoKg).toBeCloseTo(883.18, 1)
  })

  it('Sumaré → Cotia, 126km, Truck: consumo 36,00L, emissão 96,48kg', () => {
    const r = calcularEmissaoCard({ km:126, veiculoId:'truck' })
    expect(r.consumoLitros).toBeCloseTo(36.00, 1)
    expect(r.emissaoKg).toBeCloseTo(96.48, 1)
  })

  it('Mogi Guaçu → Sumaré, 91km, Bi-truck: consumo 26,00L, emissão 69,68kg', () => {
    const r = calcularEmissaoCard({ km:91, veiculoId:'bitruck' })
    expect(r.consumoLitros).toBeCloseTo(26.00, 1)
    expect(r.emissaoKg).toBeCloseTo(69.68, 1)
  })

  it('Presidente Prudente → Assis, 166km, Prancha 4 eixos: consumo 75,45L, emissão 202,22kg', () => {
    const r = calcularEmissaoCard({ km:166, veiculoId:'prancha4' })
    expect(r.consumoLitros).toBeCloseTo(75.45, 1)
    expect(r.emissaoKg).toBeCloseTo(202.22, 1)
  })

  it('sem km registrado: sinaliza "sem dado suficiente" em vez de assumir 0', () => {
    const r = calcularEmissaoCard({ km:null, veiculoId:'truck' })
    expect(r.semDadoSuficiente).toBe(true)
    expect(r.emissaoKg).toBeNull()
  })

  it('veículo sem consumo médio cadastrado (ex: frete_rodando): sinaliza, não inventa número', () => {
    const r = calcularEmissaoCard({ km:100, veiculoId:'frete_rodando' })
    expect(r.semDadoSuficiente).toBe(true)
    expect(r.emissaoKg).toBeNull()
  })
})

describe('calcularEscopo', () => {
  it('Motorista Mills (frota própria) = Escopo 1', () => {
    expect(calcularEscopo({ transportadoraNome:'' })).toBe('Escopo 1')
  })
  it('Transportadora Externa = Escopo 3', () => {
    expect(calcularEscopo({ transportadoraNome:'Transportadora Cliente' })).toBe('Escopo 3')
  })
})

describe('buscarCep — base completa de 5.570 municípios (Correios/IBGE)', () => {
  it('encontra o CEP principal de um município pequeno (bate com o exemplo da Mills: Paraguaçu Paulista)', () => {
    expect(buscarCep('Paraguaçu Paulista', 'SP')).toBe('19700-000')
  })
  it('encontra o CEP principal de uma cidade maior, mesmo sem CEP único pra cidade inteira', () => {
    expect(buscarCep('Sumaré', 'SP')).toBe('13170-000')
  })
  it('não inventa CEP pra cidade não cadastrada — devolve null', () => {
    expect(buscarCep('Cidade Inexistente', 'XX')).toBeNull()
  })
  it('ignora maiúsculas/minúsculas e espaços', () => {
    expect(buscarCep('  paraguaçu paulista  ', 'sp')).toBe('19700-000')
  })
})

describe('montarLinhaRelatorio', () => {
  it('monta a linha completa com todas as colunas do modelo', () => {
    const card = {
      id: 'ABC123', client:'Teste02',
      originCity:'Sumaré', origin:'SP', destCity:'Cotia', destination:'SP',
      km:126, veiculoId:'truck', veiculoLabel:'Truck',
      startDate:'2026-07-08', nInterno:'02 Caçambas Pa 966',
      numeroNF:'41172', transportadoraNome:'',
    }
    const linha = montarLinhaRelatorio(card)
    expect(linha.codigo).toBe('ABC123')
    expect(linha.escopo).toBe('Escopo 1')
    expect(linha.cepOrigem).toBe('13170-000')
    expect(linha.cepDestino).toBe('06700-000')
    expect(linha.emissaoKg).toBeCloseTo(96.48, 1)
    expect(linha.numeroNF).toBe('41172')
  })
})

describe('resumirEmissoes', () => {
  it('soma só os cards concluídos, separando por escopo', () => {
    const cards = [
      { id:'1', status:'concluido', km:100, veiculoId:'3/4', transportadoraNome:'' },        // Escopo 1
      { id:'2', status:'concluido', km:100, veiculoId:'3/4', transportadoraNome:'Terc.' },    // Escopo 3
      { id:'3', status:'em_execucao', km:100, veiculoId:'3/4', transportadoraNome:'' },       // ignorado (não concluído)
    ]
    const resumo = resumirEmissoes(cards)
    expect(resumo.totalServicos).toBe(2)
    expect(resumo.escopo1Kg).toBeCloseTo(44.67, 1)
    expect(resumo.escopo3Kg).toBeCloseTo(44.67, 1)
  })
})

describe('calcularEmissaoCard — Frete Rodando, consumo por modelo específico', () => {
  const simClients = [{ machineModelos: {
    'MNA09999': { fabricante: 'Volvo', modelo: 'VM330' },
    'MNA08888': { fabricante: 'Marca Desconhecida', modelo: 'Modelo Nunca Visto' },
  } }]

  it('resolve o consumo pelo modelo real da máquina quando é Frete Rodando', () => {
    const r = calcularEmissaoCard({ km:400, veiculoId:'frete_rodando', nInterno:'MNA09999' }, simClients)
    expect(r.semDadoSuficiente).toBe(false)
    expect(r.consumoLitros).toBeCloseTo(400/4.0, 1) // Volvo VM330 = 4,0 km/l (estimado)
    expect(r.consumoPorModelo).toBe(true)
  })

  it('sinaliza "sem dado suficiente" quando o modelo da máquina não está cadastrado', () => {
    const r = calcularEmissaoCard({ km:400, veiculoId:'frete_rodando', nInterno:'MNA08888' }, simClients)
    expect(r.semDadoSuficiente).toBe(true)
    expect(r.motivo).toMatch(/Frete Rodando/)
  })

  it('sem simClients, Frete Rodando sempre fica sem dado suficiente (não quebra, só não resolve)', () => {
    const r = calcularEmissaoCard({ km:400, veiculoId:'frete_rodando', nInterno:'MNA09999' })
    expect(r.semDadoSuficiente).toBe(true)
  })
})

describe('diasAtras — bug de fuso horário corrigido (todayStr/diasAtras)', () => {
  it('diasAtras(30) fica exatamente 30 dias antes de hoje, sem depender da hora do dia', async () => {
    const { diasAtras, todayStr } = await import('./utils')
    const hoje = new Date(todayStr()+'T12:00:00')
    const trintaAtras = new Date(diasAtras(30)+'T12:00:00')
    const diffDias = Math.round((hoje - trintaAtras) / 86400000)
    expect(diffDias).toBe(30)
  })
})

describe('diagnosticarLacunasEmissao — separa as 3 causas reais de "sem dado suficiente"', () => {
  it('classifica corretamente as 3 categorias distintas', () => {
    const cards = [
      // recuperável: sem km, mas com origem/destino
      { id:'1', status:'concluido', km:null, originCity:'Sumaré', destCity:'Assis', veiculoId:'truck' },
      // sem origem/destino: não recuperável pela migração
      { id:'2', status:'concluido', km:null, originCity:'', destCity:'', veiculoId:'truck' },
      // tem km, mas sem consumo médio pro veículo (modelo desconhecido)
      { id:'3', status:'concluido', km:100, originCity:'Sumaré', destCity:'Assis', veiculoId:'frete_rodando', nInterno:'XYZ00000' },
      // válido — não deve entrar em nenhuma categoria de lacuna
      { id:'4', status:'concluido', km:100, originCity:'Sumaré', destCity:'Assis', veiculoId:'truck' },
      // não concluído — ignorado inteiramente
      { id:'5', status:'em_execucao', km:null, originCity:'', destCity:'', veiculoId:'truck' },
    ]
    const d = diagnosticarLacunasEmissao(cards, [])
    expect(d.recuperavelPorMigracao.map(c=>c.id)).toEqual(['1'])
    expect(d.semOrigemDestino.map(c=>c.id)).toEqual(['2'])
    expect(d.semConsumoModelo.map(c=>c.id)).toEqual(['3'])
    expect(d.total).toBe(3)
  })

  it('sem nenhuma lacuna, todas as listas ficam vazias', () => {
    const cards = [{ id:'1', status:'concluido', km:100, originCity:'Sumaré', destCity:'Assis', veiculoId:'truck' }]
    const d = diagnosticarLacunasEmissao(cards, [])
    expect(d.total).toBe(0)
  })
})
