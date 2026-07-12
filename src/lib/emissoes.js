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
  // guindauto e frete_rodando não têm consumo definido ainda — o relatório
  // sinaliza "consumo não cadastrado" em vez de chutar um número.
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

// Calcula consumo (litros) e emissão (kg CO2) de UM card, a partir do km
// já persistido nele (ver AssignDriverModal/FrotasView — km passou a ser
// salvo no card justamente pra alimentar este relatório).
export function calcularEmissaoCard(card) {
  const km = card.km
  const consumoMedio = CONSUMO_MEDIO_KM_POR_LITRO[card.veiculoId]

  if (!km || km <= 0) {
    return { km:null, consumoLitros:null, emissaoKg:null, semDadoSuficiente:true, motivo:'Sem km registrado neste serviço.' }
  }
  if (!consumoMedio) {
    return { km, consumoLitros:null, emissaoKg:null, semDadoSuficiente:true, motivo:`Consumo médio não cadastrado para o veículo "${card.veiculoId || '—'}".` }
  }

  const consumoLitros = km / consumoMedio
  const emissaoKg = consumoLitros * FATOR_CO2_DIESEL_KG_POR_LITRO

  return {
    km,
    consumoLitros: Math.round(consumoLitros * 100) / 100,
    emissaoKg: Math.round(emissaoKg * 100) / 100,
    semDadoSuficiente: false,
  }
}

// Monta a linha completa do relatório pra um card concluído — mesmas
// colunas do modelo que o time de Meio Ambiente já usa hoje.
export function montarLinhaRelatorio(card) {
  const calc = calcularEmissaoCard(card)
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
export function resumirEmissoes(cards) {
  const linhas = cards
    .filter(c => c.status === 'concluido')
    .map(montarLinhaRelatorio)

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
