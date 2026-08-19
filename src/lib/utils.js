import { WD_SHORT, CARD_TYPES, CARD_SUBTYPES, URGENCY, SUBTYPES_NF, DOC_URGENCIA } from './constants'

// Antes usava toISOString(), que sempre retorna a data em UTC — entre 21h e
// meia-noite no horário de Brasília (UTC-3), o UTC já tinha virado o dia
// seguinte, fazendo o sistema achar que "hoje" já era amanhã (serviços do
// dia apareciam atrasados 3h antes da hora, relatórios de período ficavam
// um dia adiantados). Agora monta a data a partir dos componentes locais.
export const todayStr  = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
// "N dias atrás", calculado a partir da meia-noite local de hoje — não usa
// Date.now() diretamente (esse é o momento ATUAL, qualquer hora do dia; se
// for calculado depois das 21h no Brasil, o UTC já virou o dia seguinte e o
// resultado sai adiantado em 1 dia). Mesma causa raiz do bug corrigido em
// todayStr() acima, encontrado depois em mais 2 lugares (ExportModal.jsx,
// janela móvel de cards em useFirestore.js).
export const diasAtras = n => {
  const [y,m,d] = todayStr().split('-').map(Number)
  const dt = new Date(y, m-1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}
export const fmt       = d  => { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}` }
export const uid       = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`

export const getWeekDays = base => {
  const [y, m, d] = base.split('-').map(Number)
  const date = new Date(y, m-1, d)
  const day  = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon  = new Date(y, m-1, d + diff)
  return Array.from({length:7}, (_,i) => {
    const x = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)
    return x.toISOString().split('T')[0]
  })
}

export const getMonthWeeks = (y, m) => {
  const days = []
  const first = new Date(y, m, 1)
  const pad   = first.getDay() === 0 ? 6 : first.getDay() - 1
  const d = new Date(y, m, 1)
  while (d.getMonth() === m) { days.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1) }
  const weeks = []; let w = []
  for (let i = 0; i < pad; i++) w.push(null)
  for (const day of days) { w.push(day); if (w.length === 7) { weeks.push(w); w = [] } }
  while (w.length > 0 && w.length < 7) w.push(null)
  if (w.length) weeks.push(w)
  return weeks
}

export const cardsForDay = (cards, day) =>
  cards.filter(c => {
    // Serviços sem endDate desapareciam silenciosamente da agenda semanal/mensal
    // (mas continuavam aparecendo em "Serviços de Hoje" e no rotograma, que não
    // exigem esse campo) — trata como serviço de 1 dia só quando endDate falta.
    if (!c.startDate) return false
    const fim = c.endDate || c.startDate
    return new Date(day) >= new Date(c.startDate) && new Date(day) <= new Date(fim)
  })

export const detectConflicts = cards => {
  // Só considera serviços ainda ativos — concluídos/cancelados não geram sugestão de consolidação
  const ativos = cards.filter(c => !['concluido','cancelado'].includes(c.status))
  const out = []
  for (let i = 0; i < ativos.length; i++)
    for (let j = i+1; j < ativos.length; j++) {
      const a = ativos[i], b = ativos[j]
      // Comparação por CIDADE (destCity/originCity), não por estado — duas cidades do
      // mesmo estado podem estar a centenas de km de distância uma da outra.
      const destA = a.destCity || a.destination, destB = b.destCity || b.destination
      const origA = a.originCity || a.origin,    origB = b.originCity || b.origin
      if (!destA || !destB) continue
      // Urgência crítica não pode esperar consolidação — não entra na sugestão
      if (a.urgency === 'critico' || b.urgency === 'critico') continue
      // Mesmo motorista já atribuído nos dois → consolidação já é o caso na prática
      if (a.driverId && a.driverId === b.driverId) continue
      const diff = Math.abs(new Date(a.startDate) - new Date(b.startDate)) / 86400000
      if ((destA === destB || origA === origB) && diff <= 3)
        out.push({ a: a.id, b: b.id,
          msg: `${a.client} e ${b.client} — destino/origem similar em datas próximas (${fmt(a.startDate)} / ${fmt(b.startDate)}). Consolide o frete.`
        })
    }
  return out
}

// Detecta quando o Frotas abriu um card direto (sem passar pela solicitação)
// pra um serviço que o solicitante também já pediu formalmente e está pendente
// de aprovação. Critério: mesmo nº interno (campo obrigatório na maioria dos
// pedidos) + datas com sobreposição. Cliente é usado como reforço, não como
// critério único, pra não perder o caso de nome digitado de forma diferente.
export const findRelatedPendingRequest = (card, requests) => {
  if (!card || card.requestId) return null // já é oriundo de uma solicitação — não tem o que comparar
  const cardNumeros = (card.nInterno || '').split(',').map(s=>s.trim()).filter(Boolean)
  if (cardNumeros.length === 0) return null
  return requests.find(r => {
    if (r.status !== 'pendente') return false
    const reqNumeros = (r.nInterno || '').split(',').map(s=>s.trim()).filter(Boolean)
    const bateNumero = reqNumeros.some(n => cardNumeros.includes(n))
    if (!bateNumero) return false
    const diff = Math.abs(new Date(card.startDate) - new Date(r.desiredDate)) / 86400000
    return diff <= 3
  }) || null
}

export function getSubtypeLabel(type, subtype) {
  if (!subtype) return '—'
  const list = CARD_SUBTYPES[type] || []
  return list.find(s => s.value === subtype)?.label || subtype
}

// Status da solicitação de NF de um card, a partir dos registros da coleção
// nfRequests (ver useNfRequests em useFirestore.js) — 3 estados possíveis:
// 'pendente' (exige NF, nenhuma solicitação registrada — o lembrete que
// avisa "esqueceram de pedir"), 'solicitada' (registrada, aguardando
// emissão) ou 'emitida'. Retorna null para cards que não exigem NF (fora de
// SUBTYPES_NF) ou já cancelados — nesse caso não há badge nenhum a mostrar.
// card.nfConfirmada (campo legado, ainda gravado pelo popup de fechamento do
// serviço) também conta como 'emitida', para não regredir cards já
// confirmados antes desta coleção existir.
export function nfStatusForCard(card, nfRequests) {
  if (!card || !SUBTYPES_NF.includes(card.subtype) || card.status === 'cancelado') return null
  const registros = (nfRequests || []).filter(r => r.cardId === card.id)
  if (card.nfConfirmada || registros.some(r => r.status === 'emitida')) return 'emitida'
  if (registros.some(r => r.status === 'solicitada')) return 'solicitada'
  return 'pendente'
}

// Nível de urgência de um documento de veículo, a partir da data de
// validade — 3 janelas combinadas com o usuário (ver DOC_URGENCIA em
// constants.js): 'aviso' (30 dias), 'alerta' (15 dias, pede ação) e
// 'critico' (7 dias ou já vencido — exige confirmação de que a renovação
// foi solicitada, ver documentoPrecisaConfirmacao abaixo). null = sem
// validade cadastrada, ou validade confortável (>30 dias), nada a mostrar.
export function documentoUrgencia(validade) {
  if (!validade) return null
  const dias = Math.floor((new Date(validade) - new Date(todayStr())) / 86400000)
  if (dias > DOC_URGENCIA.aviso.dias)   return null
  if (dias > DOC_URGENCIA.alerta.dias)  return 'aviso'
  if (dias > DOC_URGENCIA.critico.dias) return 'alerta'
  return 'critico'
}

// No nível crítico (≤7 dias ou vencido), o documento fica "pendente de
// confirmação" até o analista marcar explicitamente que já solicitou a
// renovação (doc.renovacaoSolicitada) — mesmo padrão de gate usado na
// confirmação de NF (ver nfStatusForCard acima). Enquanto não confirmar,
// continua contando no lembrete; depois de confirmado, só some quando a
// validade em si for atualizada (renovação de fato recebida).
export function documentoPrecisaConfirmacao(documento) {
  return documentoUrgencia(documento?.validade) === 'critico' && !documento?.renovacaoSolicitada
}

// Achata todos os documentos de todos os veículos que estão em alguma
// janela de urgência (aviso/alerta/critico) — usado tanto pelo lembrete da
// Central de Ações quanto pela seção "Pendentes" do VeiculosModal.
export function documentosPendentes(veiculos) {
  const pendentes = []
  for (const v of (veiculos || [])) {
    for (const doc of (v.documentos || [])) {
      const nivel = documentoUrgencia(doc.validade)
      if (!nivel) continue
      pendentes.push({ veiculoId:v.id, veiculoPlaca:v.placa, veiculoTipo:v.tipo, documento:doc, nivel })
    }
  }
  // Crítico primeiro, depois alerta, depois aviso — mesma ideia de
  // priorização do URGENCY_ORDER já usado nas filas de aprovação.
  const ordem = { critico:0, alerta:1, aviso:2 }
  return pendentes.sort((a,b) => ordem[a.nivel] - ordem[b.nivel])
}

// Equipamento reserva (a máquina que sai/é enviada ao cliente, distinta da
// que retorna em card.nInterno) — lê o array bruto nInternosReserva primeiro,
// já que card.machine é uma string achatada calculada uma vez na gravação e
// pode ficar congelada desatualizada em cards salvos antes de uma correção.
export function getMaquinaReserva(card) {
  return card.nInternosReserva?.length ? card.nInternosReserva.join(', ') : (card.machine || '')
}

export function buildReport(cards, weekDays, conflicts, driverFilter) {
  const filtered = driverFilter ? cards.filter(c => (c.driver||'Sem motorista') === driverFilter) : cards
  const lines = []
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('  mills infraestrutura  |  GESTÃO DE FROTAS — LOGÍSTICA')
  lines.push(`  RELATÓRIO SEMANAL · ${fmt(weekDays[0])} a ${fmt(weekDays[6])}`)
  lines.push(`  ${driverFilter ? `Motorista: ${driverFilter}` : 'Todos os motoristas'}`)
  lines.push(`  Emitido em: ${new Date().toLocaleString('pt-BR')}`)
  lines.push('═══════════════════════════════════════════════════════════')
  let hasAny = false
  weekDays.forEach((day, idx) => {
    const dc = filtered.filter(c => c.startDate === day)
    if (!dc.length) return
    hasAny = true
    lines.push(`\n▶ ${WD_SHORT[idx].toUpperCase()}  ${fmt(day)}`)
    lines.push('─────────────────────────────────────────────────────────')
    dc.forEach(c => {
      lines.push(`  ${CARD_TYPES[c.type]?.icon}  ${CARD_TYPES[c.type]?.label.toUpperCase()}`)
      if (c.subtype) lines.push(`  Subtipo    : ${getSubtypeLabel(c.type, c.subtype)}`)
      lines.push(`  Cliente    : ${c.client}`)
      if (c.plantaObra) lines.push(`  Planta/Obra: ${c.plantaObra}`)
      lines.push(`  OM         : ${c.om||'—'}  |  Máquina: ${c.machine||'—'}`)
      if (c.nInterno) lines.push(`  N° Interno : ${c.nInterno}`)
      lines.push(`  Rota       : ${c.originCity||c.origin||'—'} → ${c.destCity||c.destination||'—'}`)
      lines.push(`  Urgência   : ${URGENCY[c.urgency]?.label}`)
      lines.push(`  Motorista  : ${c.driver||'—'}  |  Unidade: ${c.unit||'—'}`)
      if (c.notes) lines.push(`  Obs.       : ${c.notes}`)
      lines.push('')
    })
  })
  if (!hasAny) lines.push('\n  Nenhum serviço registrado para este período.\n')
  if (conflicts.length) {
    lines.push('⚠  ALERTAS DE OTIMIZAÇÃO')
    lines.push('─────────────────────────────────────────────────────────')
    conflicts.forEach(c => lines.push(`  → ${c.msg}`))
  }
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('  mills infraestrutura  ·  Segurança para sonhar mais alto')
  return lines.join('\n')
}

export function downloadTxt(content, filename) {
  const blob = new Blob([content], {type:'text/plain;charset=utf-8'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function sendTeamsNotification(webhookUrl, title, message) {
  if (!webhookUrl) return
  const card = {
    type:'message',
    attachments:[{
      contentType:'application/vnd.microsoft.card.adaptive',
      content:{
        type:'AdaptiveCard', version:'1.4',
        body:[
          { type:'TextBlock', text:'🚛 mills · Gestão de Frotas', weight:'Bolder', size:'Small', color:'Accent' },
          { type:'TextBlock', text: title, weight:'Bolder', size:'Medium', wrap:true },
          { type:'TextBlock', text: message, wrap:true, spacing:'Small' },
          { type:'TextBlock', text:`Enviado em: ${new Date().toLocaleString('pt-BR')}`, size:'Small', isSubtle:true },
        ],
        msteams:{ width:'Full' },
      }
    }]
  }
  try {
    await fetch(webhookUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(card), mode:'no-cors' })
  } catch(e) { console.warn('Teams webhook error:', e) }
}

export function parseSIMCsv(text, Papa) {
  // Remove BOM se existir
  const clean = text.replace(/^\uFEFF/, '')

  // CSV tem 2 linhas de cabeçalho — pula a primeira (grupos)
  const lines = clean.split(/\r?\n/)
  const dataText = lines.slice(1).join('\n')

  // O SIM exporta com uma linha extra no topo com agrupamentos de colunas
  // (ex: "Equipamento;Equipamento;...;Reserva atual;..."). Essa linha não é
  // o header real — precisa ser pulada antes de parsear.
  const rawLines = dataText.split('\n')
  const firstLine = (rawLines[0] || '').trim()

  // Detecta linha de grupos: todas as células são palavras genéricas sem nº interno/frota/etc.
  const isGroupRow = firstLine.length > 0 && !firstLine.includes('interno') &&
    !firstLine.includes('Interno') && !firstLine.includes('série') &&
    (firstLine.split(';').every(c => c.trim() === firstLine.split(';')[0].trim() ||
     ['Equipamento','Reserva atual','Última Movimentação','Ãltima MovimentaÃ§Ã£o'].some(g => c.trim().startsWith(g))))

  const dataToparse = isGroupRow ? rawLines.slice(1).join('\n') : dataText
  if (isGroupRow) console.log('[parseSIMCsv] linha de grupos detectada e ignorada — usando linha 2 como header')

  // Auto-detecta o separador
  const headerLine = (isGroupRow ? rawLines[1] : rawLines[0]) || ''
  const countSemi  = (headerLine.match(/;/g)  || []).length
  const countComma = (headerLine.match(/,/g)  || []).length
  const countTab   = (headerLine.match(/\t/g) || []).length
  const delimiter  = countTab > countSemi && countTab > countComma ? '\t'
                   : countComma > countSemi ? ','
                   : ';'
  console.log(`[parseSIMCsv] sep="${delimiter}" | linhas=${rawLines.length} | grupoIgnorado=${isGroupRow}`)

  const result = Papa.parse(dataToparse, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  })

  // Mapa "cabeçalho normalizado → cabeçalho real da linha" — montado UMA vez
  // (não por linha) a partir do header que o Papa.parse já detectou
  // (result.meta.fields). Usado só pra Horímetro/Valor de aquisição/Nº de
  // série (colunas com grafia menos padronizada entre exports do SIM do que
  // "Nº interno"/"Planta/Obra"), pra não depender de adivinhar a acentuação
  // exata usada num export específico. Normaliza removendo acento/pontuação/
  // maiúscula — "Horímetro", "HORIMETRO", "Horas Motor" etc. tudo bate.
  const normKey = k => (k||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
  const headerMap = {}
  for (const h of (result.meta?.fields || [])) headerMap[normKey(h)] = h
  const getByHeader = (r, ...normTargets) => {
    for (const t of normTargets) {
      const key = headerMap[t]
      if (key !== undefined && r[key] !== undefined && r[key] !== null && String(r[key]).trim()) return String(r[key]).trim()
    }
    return ''
  }

  // Normaliza nome para chave de agrupamento:
  // Remove sufixo de localidade entre parênteses no final + trim + uppercase
  // Ex: "CONSTRUTORA APIA (Cambará/PR) " → "CONSTRUTORA APIA"
  //     "CONSTRUTORA APIA (SC)"          → "CONSTRUTORA APIA"
  const normName = raw => {
    if (!raw) return ''
    return raw
      .trim()
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim()
      .toUpperCase()
  }

  // Lê nInterno com todas as variantes do caractere ordinal/grau
  // O SIM exporta "Nº interno" com U+00BA (ordinal masculino)
  const getNInterno = r => {
    const candidates = [
      r['N\u00BA interno'],   // Nº interno — ordinal masculino U+00BA (real do SIM confirmado)
      r['N\u00B0 interno'],   // N° interno — símbolo de grau U+00B0
      r['Nº interno'],         // alias direto
      r['N° interno'],
      r['N° Interno'],
      r['Nº Interno'],
      r['N interno'],
      r['nInterno'],
      r['N Interno'],
    ]
    return (candidates.find(v => v !== undefined && v !== null) || '').trim()
  }

  const map = {}

  result.data.forEach(r => {
    // Prioridade 1: Planta/Obra do contrato ativo
    const plantaRaw  = (r['Planta/Obra']           || '').trim()
    // Prioridade 2: Planta/Obra da reserva (frota alocada mas ainda não faturada)
    const reservaRaw = (r['Planta/Obra (reserva)']  || '').trim()
    // Prioridade 3/4: quando não há Planta/Obra definida, busca por Cliente / Cliente (reserva)
    // (frota reservada para o cliente mas ainda sem obra/planta específica cadastrada)
    const clienteRaw        = (r['Cliente']           || '').trim()
    const clienteReservaRaw = (r['Cliente (reserva)']  || '').trim()

    const nInterno = getNInterno(r)
    // Bug real (caso PCP01167): equipamento sem Planta/Obra e sem Cliente
    // preenchidos no CSV (parado no pátio, sem alocação atual — nenhuma das
    // 4 colunas de origem tem valor) era descartado ANTES até de guardar
    // Fabricante/Modelo/Grupo de Modelo — a linha inteira era ignorada por
    // não ter nome pra agrupar. Resultado: a máquina simplesmente não
    // entrava na base carregada, mesmo estando corretamente cadastrada no
    // SIM — e caía como "não reconhecida" no cálculo de frete. Agora, se
    // não há nome mas há N° interno, agrupa num "cliente" sentinela em vez
    // de descartar, só pra manter a dimensão/peso pesquisável.
    const SEM_CLIENTE = '(Sem Planta/Obra ou Cliente — Pátio)'
    const nameRaw = plantaRaw || reservaRaw || clienteRaw || clienteReservaRaw || (nInterno ? SEM_CLIENTE : '')
    if (!nameRaw) return

    const name = normName(nameRaw)
    // Cliente (dono do contrato) é uma coluna separada de Planta/Obra (o
    // site/obra específico onde o equipamento está) — quando as duas
    // existem e são diferentes (ex: Planta/Obra = "Obra Rodovia BR-153",
    // Cliente = "INFRAINVEST"), a busca por planta/obra em ClientInput só
    // olhava pro nome agrupado (Planta/Obra tem prioridade, Cliente nunca
    // aparecia) — quem digitasse o nome do cliente não encontrava a obra
    // dele. Guarda o Cliente à parte pra também entrar na busca.
    const clienteNome = (clienteRaw || clienteReservaRaw || '').trim()

    // Município e Estado sempre das mesmas colunas, independente da fonte da planta
    const state    = (r['Estado (Planta/Obra)']    || '').trim()
    const city     = (r['Município (Planta/Obra)'] || '').trim()
    const familia     = (r['Família'] || r['Familia'] || '').trim()
    // Fabricante/Modelo — usados pra cruzar com a dimensão real (peso/largura/comprimento)
    // do equipamento específico, mais preciso que a faixa de peso genérica (Grupo de Modelo).
    const fabricante = (r['Fabricante'] || r['fabricante'] || '').trim()
    const modelo     = (r['Modelo'] || r['modelo'] || '').trim()
    // Grupo de Modelo — coluna que determina o veículo necessário para transporte
    const grupoModelo = (
      r['Grupo de modelo'] ||   // nome real do SIM (minúsculo)
      r['Grupo de Modelo'] ||   // variante maiúscula
      r['Grupo De Modelo'] ||
      r['Grupo de modelos'] ||
      r['GrupoModelo'] ||
      ''
    ).trim()
    // Horímetro/Valor de aquisição/Nº de série — usados pelo painel de
    // Solicitação de NF pra autopreencher esses campos a partir da própria
    // base do SIM (evita o analista digitar de cabeça algo que o CSV já
    // traz). Matching normalizado (getByHeader/headerMap acima) — cobre
    // variação de acento/maiúscula/pontuação sem precisar adivinhar a
    // grafia exata usada num export específico do SIM.
    const horimetro      = getByHeader(r, 'horimetro', 'horimetroatual', 'horasmotor', 'horas')
    const valorAquisicao = getByHeader(r, 'valordeaquisicao', 'valoraquisicao', 'vlraquisicao', 'valordecompra', 'valorcompra')
    const serie          = getByHeader(r, 'ndeserie', 'numerodeserie', 'nserie', 'serie')

    if (!map[name]) {
      map[name] = {
        name:         nameRaw.trim(),
        cliente:      '',
        state, city,
        segment:      '',
        families:     new Set(),
        machines:     0,
        nInternos:    new Set(),
        machineGroups: {},  // nInterno → grupoModelo (para cálculo de frete)
        machineModelos: {}, // nInterno → {fabricante, modelo} (dimensão exata)
        machineHorimetro: {}, // nInterno → horímetro
        machineValor:     {}, // nInterno → valor de aquisição
        machineSerie:     {}, // nInterno → nº de série
      }
    }

    map[name].machines++
    if (familia)  map[name].families.add(familia)
    if (nInterno) {
      map[name].nInternos.add(nInterno)
      // Só sobrescreve se tiver grupoModelo real (não apaga dado existente)
      if (grupoModelo) map[name].machineGroups[nInterno] = grupoModelo
      if (fabricante || modelo) map[name].machineModelos[nInterno] = { fabricante, modelo }
      if (horimetro) map[name].machineHorimetro[nInterno] = horimetro
      if (valorAquisicao) map[name].machineValor[nInterno] = valorAquisicao
      if (serie) map[name].machineSerie[nInterno] = serie
    }
    if (!map[name].state && state) map[name].state = state
    if (!map[name].city  && city)  map[name].city  = city
    // Só guarda se for diferente do próprio nome (evita "INFRAINVEST · Cliente: INFRAINVEST"
    // redundante quando Planta/Obra e Cliente já são o mesmo texto)
    if (!map[name].cliente && clienteNome && normName(clienteNome) !== name) map[name].cliente = clienteNome
  })

  const clients = Object.values(map)
    .map(c => ({
      name:      c.name,
      cliente:   c.cliente,
      state:     c.state,
      city:      c.city,
      segment:   c.segment,
      machines:  c.machines,
      families:  Array.from(c.families).slice(0, 5),
      nInternos:     Array.from(c.nInternos),
      machineGroups: c.machineGroups || {},  // nInterno → grupoModelo
      machineModelos: c.machineModelos || {}, // nInterno → {fabricante, modelo}
      machineHorimetro: c.machineHorimetro || {}, // nInterno → horímetro
      machineValor:     c.machineValor || {},     // nInterno → valor de aquisição
      machineSerie:     c.machineSerie || {},     // nInterno → nº de série
    }))
    .sort((a, b) => b.machines - a.machines)

  console.log(`✅ SIM parsed: ${clients.length} clientes, ${result.data.length} linhas`)
  return clients
}

// Índice achatado nInterno → dados da máquina (cliente/cidade/UF/horímetro/
// valor/série), a partir da base SIM já carregada — usado pelo painel de
// Solicitação de NF pra autopreencher Frota/Origem/Horímetro/Valor a partir
// de um nInterno só, sem precisar varrer todos os clientes toda hora.
export function buildFrotaIndex(simClients) {
  const idx = new Map()
  for (const c of (simClients || [])) {
    for (const n of (c.nInternos || [])) {
      idx.set(n, {
        nInterno:  n,
        client:    c.name,
        city:      c.city || '',
        state:     c.state || '',
        horimetro: c.machineHorimetro?.[n] || '',
        valor:     c.machineValor?.[n] || '',
        serie:     c.machineSerie?.[n] || '',
      })
    }
  }
  return idx
}

// Parser da base "Clientes SAP" (Código SAP, CNPJ, Cliente, UF, Endereço) —
// usada pelo painel de Solicitação de NF pra buscar CNPJ/Código SAP do
// destino sem o analista digitar de cabeça. Upload manual (CSV exportado do
// SAP), mesmo padrão de separador/encoding do CSV do SIM (parseSIMCsv
// acima), mas sem a complexidade de linha de grupos/múltiplas fontes de
// nome — a base SAP já vem "achatada", uma linha por cliente.
export function parseSapClientsCsv(text, Papa) {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/)
  const headerLine = lines[0] || ''
  const countSemi  = (headerLine.match(/;/g)  || []).length
  const countComma = (headerLine.match(/,/g)  || []).length
  const countTab   = (headerLine.match(/\t/g) || []).length
  const delimiter  = countTab > countSemi && countTab > countComma ? '\t'
                   : countComma > countSemi ? ',' : ';'

  const result = Papa.parse(clean, { header:true, skipEmptyLines:true, delimiter })

  const get = (r, keys) => {
    for (const k of keys) { if (r[k] !== undefined && r[k] !== null && String(r[k]).trim()) return String(r[k]).trim() }
    return ''
  }

  const clients = result.data
    .map(r => ({
      codigoSap: get(r, ['CODIGO SAP','Código SAP','Codigo SAP','COD SAP','Cod SAP','codigoSap']),
      cnpj:      get(r, ['CNPJ','cnpj']),
      nome:      get(r, ['CLIENTE','Cliente','cliente']),
      uf:        get(r, ['REGIO','UF','Estado','uf']),
      endereco:  get(r, ['ENDEREÇO','ENDERECO','Endereço','Endereco','endereco']),
    }))
    .filter(c => c.nome || c.cnpj)
    .map(c => ({ ...c, cnpjDigits: c.cnpj.replace(/\D/g,'') }))

  console.log(`✅ Clientes SAP parsed: ${clients.length} clientes, ${result.data.length} linhas`)
  return clients
}

// Re-export da fonte única em constants.js — mantém compatível quem importa de utils
export { sortByUrgency } from './constants'
