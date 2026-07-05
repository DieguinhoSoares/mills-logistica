import { WD_SHORT, CARD_TYPES, CARD_SUBTYPES, URGENCY } from './constants'

export const todayStr  = () => new Date().toISOString().split('T')[0]
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
  cards.filter(c => c.startDate && c.endDate &&
    new Date(day) >= new Date(c.startDate) &&
    new Date(day) <= new Date(c.endDate))

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

    const nameRaw = plantaRaw || reservaRaw || clienteRaw || clienteReservaRaw
    if (!nameRaw) return

    const name     = normName(nameRaw)
    const nInterno = getNInterno(r)

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

    if (!map[name]) {
      map[name] = {
        name:         nameRaw.trim(),
        state, city,
        segment:      '',
        families:     new Set(),
        machines:     0,
        nInternos:    new Set(),
        machineGroups: {},  // nInterno → grupoModelo (para cálculo de frete)
        machineModelos: {}, // nInterno → {fabricante, modelo} (dimensão exata)
      }
    }

    map[name].machines++
    if (familia)  map[name].families.add(familia)
    if (nInterno) {
      map[name].nInternos.add(nInterno)
      // Só sobrescreve se tiver grupoModelo real (não apaga dado existente)
      if (grupoModelo) map[name].machineGroups[nInterno] = grupoModelo
      if (fabricante || modelo) map[name].machineModelos[nInterno] = { fabricante, modelo }
    }
    if (!map[name].state && state) map[name].state = state
    if (!map[name].city  && city)  map[name].city  = city
  })

  const clients = Object.values(map)
    .map(c => ({
      name:      c.name,
      state:     c.state,
      city:      c.city,
      segment:   c.segment,
      machines:  c.machines,
      families:  Array.from(c.families).slice(0, 5),
      nInternos:     Array.from(c.nInternos),
      machineGroups: c.machineGroups || {},  // nInterno → grupoModelo
      machineModelos: c.machineModelos || {}, // nInterno → {fabricante, modelo}
    }))
    .sort((a, b) => b.machines - a.machines)

  console.log(`✅ SIM parsed: ${clients.length} clientes, ${result.data.length} linhas`)
  return clients
}

// Re-export da fonte única em constants.js — mantém compatível quem importa de utils
export { sortByUrgency } from './constants'
