import { WD_SHORT, CARD_TYPES, CARD_SUBTYPES, URGENCY } from './constants'

export const todayStr  = () => new Date().toISOString().split('T')[0]
export const fmt       = d  => { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}` }
export const uid       = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`

export const getWeekDays = base => {
  const d = new Date(base), day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return Array.from({length:7}, (_,i) => {
    const x = new Date(mon); x.setDate(mon.getDate() + i)
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

// ─── SUBTYPE LABEL ────────────────────────────────────────────────────────────
export function getSubtypeLabel(type, subtype) {
  if (!subtype) return '—'
  const list = CARD_SUBTYPES[type] || []
  return list.find(s => s.value === subtype)?.label || subtype
}

// ─── REPORT BUILDER ──────────────────────────────────────────────────────────
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
      const subtypeLabel = getSubtypeLabel(c.type, c.subtype)
      lines.push(`  ${CARD_TYPES[c.type]?.icon}  ${CARD_TYPES[c.type]?.label.toUpperCase()}`)
      if (c.subtype) lines.push(`  Subtipo    : ${subtypeLabel}`)
      lines.push(`  Cliente    : ${c.client}${c.clientCity ? ` (${c.clientCity}/${c.clientState})` : ''}`)
      if (c.plantaObra) lines.push(`  Planta/Obra: ${c.plantaObra}`)
      lines.push(`  OM         : ${c.om||'—'}  |  Máquina: ${c.machine||'—'}`)
      if (c.nInterno)  lines.push(`  N° Interno : ${c.nInterno}`)
      lines.push(`  Rota       : ${c.origin||'—'} → ${c.destination||'—'}`)
      lines.push(`  Urgência   : ${URGENCY[c.urgency]?.label}  |  Status: ${c.status==='atrasado'?'⚠ ATRASADO':'✓ Em dia'}`)
      lines.push(`  Motorista  : ${c.driver||'—'}  |  Unidade: ${c.unit||'—'}`)
      if (c.notes) lines.push(`  Obs.       : ${c.notes}`)
      lines.push('')
    })
  })
  if (!hasAny) lines.push('\n  Nenhum serviço registrado para este período.\n')
  const rel = driverFilter
    ? conflicts.filter(cf => { const a=cards.find(x=>x.id===cf.a),b=cards.find(x=>x.id===cf.b); return a?.driver===driverFilter||b?.driver===driverFilter })
    : conflicts
  if (rel.length) {
    lines.push('⚠  ALERTAS DE OTIMIZAÇÃO')
    lines.push('─────────────────────────────────────────────────────────')
    rel.forEach(c => lines.push(`  → ${c.msg}`))
    lines.push('')
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

// ─── TEAMS WEBHOOK ───────────────────────────────────────────────────────────
export async function sendTeamsNotification(webhookUrl, title, message, color = '#F37021') {
  if (!webhookUrl) return
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type:'TextBlock', text:'🚛 mills · Gestão de Frotas', weight:'Bolder', size:'Small', color:'Accent' },
          { type:'TextBlock', text: title, weight:'Bolder', size:'Medium', wrap:true },
          { type:'TextBlock', text: message, wrap:true, spacing:'Small' },
          { type:'TextBlock', text: `Enviado em: ${new Date().toLocaleString('pt-BR')}`, size:'Small', isSubtle:true },
        ],
        msteams: { width: 'Full' },
      }
    }]
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      mode: 'no-cors',
    })
  } catch (e) { console.warn('Teams webhook error:', e) }
}

// ─── CSV PARSER (SIM) ─────────────────────────────────────────────────────────
// Corrigido: usa import ESM (Papa do npm), lê Planta/Obra e N° Interno
export function parseSIMCsv(text, Papa) {
  const result = Papa.parse(text, { header:true, skipEmptyLines:true, delimiter:';' })
  const stateMap = {
    'São Paulo':'SP','Minas Gerais':'MG','Rio de Janeiro':'RJ','Paraná':'PR',
    'Santa Catarina':'SC','Rio Grande do Sul':'RS','Bahia':'BA','Goiás':'GO',
    'Mato Grosso':'MT','Mato Grosso do Sul':'MS','Pará':'PA','Amazonas':'AM',
    'Ceará':'CE','Pernambuco':'PE','Tocantins':'TO','Maranhão':'MA','Piauí':'PI',
    'Rio Grande do Norte':'RN','Paraíba':'PB','Alagoas':'AL','Sergipe':'SE',
    'Espírito Santo':'ES','Distrito Federal':'DF','Rondônia':'RO',
    'Roraima':'RR','Amapá':'AP','Acre':'AC',
  }
  const map = {}
  result.data.forEach(r => {
    // Cliente → coluna "Planta/Obra" ou fallback para colunas antigas
    const name = (
      r['Planta/Obra'] ||
      r['Planta / Obra'] ||
      r['Cliente (CT)'] ||
      r['Cliente (reserva)'] || ''
    ).trim()
    if (!name) return

    // N° Interno da frota
    const nInterno = (r['N° Interno'] || r['N Interno'] || r['Nº Interno'] || r['n_interno'] || '').trim()

    const state = stateMap[r['Estado (Planta/Obra)']?.trim()] || r['Estado (Planta/Obra)']?.trim() || ''
    const city  = r['Município (Planta/Obra)']?.trim() || ''
    const seg   = r['Segmento de mercado']?.trim() || ''
    const fam   = r['Família']?.trim() || ''

    if (!map[name]) map[name] = { name, state, city, segment:seg, families:new Set(), machines:0, nInternos:new Set() }
    map[name].machines++
    if (fam)      map[name].families.add(fam)
    if (nInterno) map[name].nInternos.add(nInterno)
    if (!map[name].state && state) map[name].state = state
    if (!map[name].city  && city)  map[name].city  = city
  })
  return Object.values(map)
    .map(c => ({
      ...c,
      families:  [...c.families].slice(0,5),
      nInternos: [...c.nInternos].slice(0,10),
    }))
    .sort((a,b) => b.machines - a.machines)
}
