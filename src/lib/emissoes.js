// src/lib/emissoes.js
// Cálculo de emissão de CO2 por serviço — dado enviado ao time de Meio
// Ambiente da Mills para divulgação externa ao mercado (ESG/sustentabilidade).
// Metodologia: distância percorrida (GHG Protocol, método distance-based).
//
// ⚠️ ATENÇÃO — valores marcados "A CONFIRMAR" abaixo foram deduzidos a partir
// de uma planilha de exemplo fornecida, batendo com o fator de emissão do
// diesel (2,68 kg CO2/litro). NÃO FORAM CONFIRMADOS com o time de Meio
// Ambiente da Mills. Como este dado vai pra divulgação externa, confirme
// esses números antes de usar o relatório oficialmente.

// Fator de emissão do diesel — padrão amplamente usado em inventários
// brasileiros (IPCC/GHG Protocol Brasil). Este valor específico não costuma
// mudar por empresa, mas vale confirmar com o time de Meio Ambiente mesmo assim.
export const FATOR_CO2_DIESEL_KG_POR_LITRO = 2.68

// A CONFIRMAR com o time de Meio Ambiente — deduzido da planilha de exemplo.
export const CONSUMO_MEDIO_KM_POR_LITRO = {
  '3/4':      6.0,
  'truck':    3.5,
  'bitruck':  3.5,
  'prancha3': 2.2,
  'prancha4': 2.2,
  // guindauto e frete_rodando não têm consumo genérico — frete_rodando é
  // resolvido por MODELO específico da máquina (ver CONSUMO_MODELO abaixo),
  // já que é a própria máquina rodando, não um caminhão/carreta genérico.
  // bitrem9 (Carreta Bitrem 9 eixos, adicionado 2026-07) também não tem
  // consumo médio confirmado ainda — mesmo gap intencional que as diárias
  // dele em freteCalc.js/DIARIAS (não consta na planilha usada até agora).
  // Serviços com esse veículo ficam corretamente sinalizados como
  // "sem consumo cadastrado" (ver diagnosticarLacunasEmissao) em vez de
  // contar como 0 na emissão total — quando o número chegar, cadastra aqui.
}

// Consumo médio POR MODELO — usado quando a máquina roda sozinha (Frete
// Rodando), caso em que o consumo depende de qual caminhão/trator é, não de
// uma categoria genérica de veículo de transporte. Identificado via
// Fabricante+Modelo do CSV do SIM (mesma base já usada pra peso/dimensão em
// freteCalc.js).
//
// ⚠️ Cobertura ainda muito parcial — só 1 modelo com dado real até agora.
// Pra qualquer modelo fora daqui, o relatório sinaliza "consumo não
// cadastrado" em vez de estimar errado. Precisa de pesquisa contínua
// (mesmo processo já usado pra peso/dimensão: site do fabricante ou da
// Mills, modelo por modelo).
export const CONSUMO_MODELO = {
  // Fonte: estimativa de terceiros (magodoscarros.com/FIPE), NÃO é ficha
  // oficial da Volvo — Volvo não publica consumo oficial de caminhões (varia
  // demais com carga/condição). Usado o meio da faixa de rodovia (3,5-4,5 km/l).
  'VOLVO|VM330': 4.0,
  'VOLVO|VM-330': 4.0,
}

function buscarConsumoModelo(fabricante, modelo) {
  if (!fabricante && !modelo) return null
  const fab = String(fabricante||'').toUpperCase().trim()
  const mod = String(modelo||'').toUpperCase().trim().replace(/\s+/g,'')
  const chaveExata = `${fab}|${mod}`
  if (CONSUMO_MODELO[chaveExata]) return CONSUMO_MODELO[chaveExata]
  // Fallback: tenta achar só pelo modelo, ignorando fabricante (mesma
  // estratégia de faixaSimilar do freteCalc.js)
  const porModelo = Object.entries(CONSUMO_MODELO).find(([k]) => k.endsWith(`|${mod}`))
  return porModelo ? porModelo[1] : null
}

// CEP "principal" (genérico) de cada município brasileiro — base com os
// 5.570 municípios oficiais, derivada de dados públicos dos Correios/IBGE.
// Pra cidades pequenas (a maioria), é o único CEP que existe pra cidade
// inteira (ex: Paraguaçu Paulista, SP → 19700-000). Pra cidades grandes com
// CEP por rua, é o início da faixa de CEPs daquele município — uma
// representação razoável de "o CEP principal", já que não existe um único
// CEP "certo" pra cidade inteira nesses casos.
import CEP_MUNICIPIOS from './data/cep-municipios.json'

function normalizarCidade(cidade) {
  return String(cidade || '').trim().toUpperCase()
}

export function buscarCep(cidade, uf) {
  const chave = `${normalizarCidade(cidade)}|${String(uf || '').trim().toUpperCase()}`
  const cep = CEP_MUNICIPIOS[chave]
  if (!cep) return null
  return `${cep.slice(0,5)}-${cep.slice(5)}`
}

// Escopo do GHG Protocol: frota própria (Motorista Mills) é emissão direta
// da empresa (Escopo 1); transportadora terceirizada é emissão da cadeia de
// valor contratada (Escopo 3). Confirmado com Diego 2026-07.
export function calcularEscopo(card) {
  return card.transportadoraNome ? 'Escopo 3' : 'Escopo 1'
}

import { buscarFabricanteModelo } from './freteCalc'

// Calcula consumo (litros) e emissão (kg CO2) de UM card, a partir do km
// já persistido nele (ver AssignDriverModal/FrotasView — km passou a ser
// salvo no card justamente pra alimentar este relatório).
// `simClients` é opcional — só necessário pro Frete Rodando, que precisa
// identificar QUAL máquina está rodando pra buscar o consumo daquele
// modelo específico (não existe um consumo genérico de "frete rodando").
export function calcularEmissaoCard(card, simClients) {
  const km = card.km
  let consumoMedio = CONSUMO_MEDIO_KM_POR_LITRO[card.veiculoId]
  let fonteConsumo = 'categoria'

  if (!consumoMedio && card.veiculoId === 'frete_rodando' && card.nInterno && simClients) {
    const fm = buscarFabricanteModelo(card.nInterno, simClients)
    if (fm) {
      const porModelo = buscarConsumoModelo(fm.fabricante, fm.modelo)
      if (porModelo) { consumoMedio = porModelo; fonteConsumo = 'modelo' }
    }
  }

  if (!km || km <= 0) {
    return { km:null, consumoLitros:null, emissaoKg:null, semDadoSuficiente:true, motivo:'Sem km registrado neste serviço.' }
  }
  if (!consumoMedio) {
    const motivo = card.veiculoId === 'frete_rodando'
      ? `Consumo não cadastrado para o modelo desta máquina (Frete Rodando) — N° interno ${card.nInterno||'—'}.`
      : `Consumo médio não cadastrado para o veículo "${card.veiculoId || '—'}".`
    return { km, consumoLitros:null, emissaoKg:null, semDadoSuficiente:true, motivo }
  }

  const consumoLitros = km / consumoMedio
  const emissaoKg = consumoLitros * FATOR_CO2_DIESEL_KG_POR_LITRO

  return {
    km,
    consumoLitros: Math.round(consumoLitros * 100) / 100,
    emissaoKg: Math.round(emissaoKg * 100) / 100,
    semDadoSuficiente: false,
    consumoPorModelo: fonteConsumo === 'modelo',
  }
}

// Monta a linha completa do relatório pra um card concluído — mesmas
// colunas do modelo que o time de Meio Ambiente já usa hoje.
export function montarLinhaRelatorio(card, simClients) {
  const calc = calcularEmissaoCard(card, simClients)
  const origemCidade  = card.originCity || ''
  const destinoCidade = card.destCity   || ''
  const origemUF  = card.origin      || ''
  const destinoUF = card.destination || ''

  return {
    codigo:        card.id,
    solicitante:   card.client || '—',
    origem:        origemCidade,
    cepOrigem:     buscarCep(origemCidade, origemUF)   || 'CEP não cadastrado',
    destino:       destinoCidade,
    cepDestino:    buscarCep(destinoCidade, destinoUF) || 'CEP não cadastrado',
    distanciaKm:   calc.km,
    consumoLitros: calc.consumoLitros,
    emissaoKg:     calc.emissaoKg,
    tipoVeiculo:   card.veiculoLabel || card.veiculoId || '—',
    data:          card.startDate || '',
    frota:         card.nInterno || card.driver || '—',
    numeroNF:      card.numeroNF || '',
    escopo:        calcularEscopo(card),
    semDadoSuficiente: calc.semDadoSuficiente,
    motivoSemDado: calc.motivo || '',
  }
}

// Agrega um conjunto de cards concluídos num resumo — usado no KPIView e MasterView.
// Diagnóstico das lacunas de dado — "sem dado suficiente" pode acontecer por
// motivos bem diferentes, que pedem ações diferentes:
// 1. Sem km, mas COM origem/destino → a migração "Recalcular km" resolve
// 2. Sem km E sem origem/destino → a migração não tem de onde calcular,
//    precisa de correção manual (abrir o card e confirmar origem/destino)
// 3. TEM km, mas falta consumo médio do veículo/modelo → não é sobre km
//    nenhum, é sobre cadastrar o consumo daquele veículo/modelo específico
export function diagnosticarLacunasEmissao(cards, simClients) {
  const concluidos = cards.filter(c => c.status === 'concluido')
  const recuperavelPorMigracao = []
  const semOrigemDestino = []
  const semConsumoModelo = []

  for (const card of concluidos) {
    const calc = calcularEmissaoCard(card, simClients)
    if (!calc.semDadoSuficiente) continue
    if (!card.km) {
      if (card.originCity && card.destCity) recuperavelPorMigracao.push(card)
      else semOrigemDestino.push(card)
    } else {
      semConsumoModelo.push(card)
    }
  }

  return {
    total: recuperavelPorMigracao.length + semOrigemDestino.length + semConsumoModelo.length,
    recuperavelPorMigracao, semOrigemDestino, semConsumoModelo,
  }
}

export function resumirEmissoes(cards, simClients) {
  const linhas = cards
    .filter(c => c.status === 'concluido')
    .map(c => montarLinhaRelatorio(c, simClients))

  const validas = linhas.filter(l => !l.semDadoSuficiente)
  const totalKm       = validas.reduce((a,l)=>a+(l.distanciaKm||0), 0)
  const totalEmissao  = validas.reduce((a,l)=>a+(l.emissaoKg||0), 0)
  const escopo1       = validas.filter(l=>l.escopo==='Escopo 1').reduce((a,l)=>a+(l.emissaoKg||0), 0)
  const escopo3       = validas.filter(l=>l.escopo==='Escopo 3').reduce((a,l)=>a+(l.emissaoKg||0), 0)
  const semDado       = linhas.filter(l => l.semDadoSuficiente).length

  return {
    linhas,
    totalServicos: linhas.length,
    servicosComDado: validas.length,
    servicosSemDado: semDado,
    totalKm: Math.round(totalKm * 10) / 10,
    totalEmissaoKg: Math.round(totalEmissao * 100) / 100,
    escopo1Kg: Math.round(escopo1 * 100) / 100,
    escopo3Kg: Math.round(escopo3 * 100) / 100,
  }
}
