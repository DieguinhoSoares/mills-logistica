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
  const out = []
  for (let i = 0; i < cards.length; i++)
    for (let j = i+1; j < cards.length; j++) {
      const a = cards[i], b = cards[j]
      if (!a.destination || !b.destination) continue
      const diff = Math.abs(new Date(a.startDate) - new Date(b.startDate)) / 86400000
      if ((a.destination === b.destination || a.origin === b.origin) && diff <= 3)
        out.push({ a: a.id, b: b.id,
          msg: `${a.client} e ${b.client} — destino/origem similar em datas próximas (${fmt(a.startDate)} / ${fmt(b.startDate)}). Consolide o frete.`
        })
    }
  return out
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

  const result = Papa.parse(dataText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
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
      r['N\u00BA interno'],  // Nº interno — ordinal masculino U+00BA (real do SIM)
      r['N\u00B0 interno'],  // N° interno — símbolo de grau U+00B0
      r['Nº interno'],
      r['N° interno'],
      r['N° Interno'],
      r['Nº Interno'],
      r['N interno'],
    ]
    return (candidates.find(v => v !== undefined && v !== null) || '').trim()
  }

  const map = {}

  result.data.forEach(r => {
    // Prioridade 1: Planta/Obra do contrato ativo
    const plantaRaw  = (r['Planta/Obra']           || '').trim()
    // Prioridade 2: Planta/Obra da reserva (frota alocada mas ainda não faturada)
    const reservaRaw = (r['Planta/Obra (reserva)']  || '').trim()

    const nameRaw = plantaRaw || reservaRaw
    if (!nameRaw) return

    const name     = normName(nameRaw)
    const nInterno = getNInterno(r)

    // Município e Estado sempre das mesmas colunas, independente da fonte da planta
    const state    = (r['Estado (Planta/Obra)']    || '').trim()
    const city     = (r['Município (Planta/Obra)'] || '').trim()
    const familia     = (r['Família'] || r['Familia'] || '').trim()
    // Grupo de Modelo — coluna que determina o veículo necessário para transporte
    const grupoModelo = (
      r['Grupo de Modelo'] ||   // nome exato do SIM
      r['Grupo de modelo'] ||
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
      }
    }

    map[name].machines++
    if (familia)  map[name].families.add(familia)
    if (nInterno) {
      map[name].nInternos.add(nInterno)
      // Só sobrescreve se tiver grupoModelo real (não apaga dado existente)
      if (grupoModelo) map[name].machineGroups[nInterno] = grupoModelo
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
    }))
    .sort((a, b) => b.machines - a.machines)

  console.log(`✅ SIM parsed: ${clients.length} clientes, ${result.data.length} linhas`)
  return clients
}
