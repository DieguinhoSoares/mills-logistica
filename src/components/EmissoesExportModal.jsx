import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS } from '../lib/constants'
import { fmt, todayStr, getWeekDays } from '../lib/utils'
import { montarLinhaRelatorio } from '../lib/emissoes'

// Exportação em Excel do relatório de emissão de carbono — enviado ao time
// de Meio Ambiente da Mills para divulgação externa ao mercado. Colunas no
// mesmo formato do modelo já usado hoje pelo time (ver conversa 2026-07).
export function EmissoesExportModal({ cards, simClients, onClose, onRunMigration, migrating, migrateLog, migrateProgress }) {
  const today = todayStr()
  const [dateFrom, setDateFrom] = useState(getWeekDays(today)[0])
  const [dateTo,   setDateTo]   = useState(getWeekDays(today)[6])
  const [done, setDone] = useState(false)
  const [erro, setErro] = useState('')

  const concluidos = cards.filter(c =>
    c.status === 'concluido' && c.startDate && c.startDate >= dateFrom && c.startDate <= dateTo
  )
  const linhas = concluidos.map(c => montarLinhaRelatorio(c, simClients))
  const semDado = linhas.filter(l => l.semDadoSuficiente).length

  const handleExport = async () => {
    setErro('')
    try {
      const XLSX = await import('xlsx')
      const header = ['Código','Solicitante','Origem','CEP Origem','Destino','CEP Destino','Distância (km)','Consumo (L)','Emissão (kg)','Tipo Veículo','Data','Frota','Num. NF','Escopo']
      const rows = linhas.map(l => [
        l.codigo, l.solicitante, l.origem, l.cepOrigem, l.destino, l.cepDestino,
        l.distanciaKm ?? '—', l.consumoLitros ?? '—', l.emissaoKg ?? '—',
        l.tipoVeiculo, fmt(l.data), l.frota, l.numeroNF || '—', l.escopo,
      ])
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
      ws['!cols'] = [
        {wch:22},{wch:16},{wch:22},{wch:12},{wch:22},{wch:12},
        {wch:14},{wch:12},{wch:12},{wch:16},{wch:12},{wch:24},{wch:12},{wch:10},
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Emissão CO2')
      XLSX.writeFile(wb, `mills-emissao-co2_${dateFrom}_a_${dateTo}.xlsx`)
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      console.error('Erro ao exportar emissões:', err)
      setErro('Erro ao gerar o arquivo. Tente novamente.')
    }
  }

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={onClose}>
      <motion.div initial={{scale:.95,opacity:0}} animate={{scale:1,opacity:1}}
        onClick={e=>e.stopPropagation()}
        style={{ background:T.surface, borderRadius:T.rLg, padding:24, width:420, maxWidth:'90vw', boxShadow:T.shadowLg }}>
        <h3 style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:T.text, margin:'0 0 4px' }}>🌱 Exportar Emissão de CO2</h3>
        <p style={{ fontFamily:FONT, fontSize:11, color:T.textMuted, margin:'0 0 16px' }}>
          Relatório para o time de Meio Ambiente — apenas serviços concluídos no período.
        </p>

        <label style={LS}>De</label>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={IS}/>
        <label style={{...LS, marginTop:10}}>Até</label>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={IS}/>

        <div style={{ marginTop:14, padding:'10px 12px', background:T.surfaceAlt, borderRadius:T.rSm, fontFamily:FONT, fontSize:11, color:T.textSec }}>
          {linhas.length} serviço(s) concluído(s) no período.
          {semDado > 0 && (
            <div style={{ color:T.perigo, fontWeight:700, marginTop:4 }}>
              ⚠️ {semDado} sem km ou consumo médio cadastrado — aparecem no arquivo com "—", não são inventados.
            </div>
          )}
        </div>

        {semDado > 0 && onRunMigration && (
          <div style={{ marginTop:10, padding:'10px 12px', background:T.amareloLight, borderRadius:T.rSm }}>
            <div style={{ fontFamily:FONT, fontSize:10, color:'#8A6D00', marginBottom:6 }}>
              Serviços concluídos antes da correção de {new Date().toLocaleDateString('pt-BR')} não têm km salvo.
              Isso recalcula usando a origem/destino que o card já tem — é seguro rodar mais de uma vez.
            </div>
            <button onClick={onRunMigration} disabled={migrating}
              style={{ ...BS, background:T.amarelo, color:'#8A6D00', fontWeight:700, fontSize:11, width:'100%' }}>
              {migrating
                ? `⏳ Recalculando... ${migrateProgress ? `${migrateProgress.atual}/${migrateProgress.total}` : ''}`
                : '🔧 Recalcular km de serviços antigos'}
            </button>
            {migrateLog && <div style={{ fontFamily:FONT, fontSize:10, color:'#8A6D00', marginTop:6, fontWeight:700 }}>{migrateLog}</div>}
          </div>
        )}

        {erro && <div style={{ marginTop:10, color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>{erro}</div>}
        {done && <div style={{ marginTop:10, color:T.verde, fontFamily:FONT, fontSize:11, fontWeight:700 }}>✅ Arquivo gerado!</div>}

        <div style={{ display:'flex', gap:8, marginTop:18 }}>
          <button onClick={onClose} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec }}>Cancelar</button>
          <button onClick={handleExport} disabled={linhas.length===0}
            style={{ ...BS, flex:1, background:linhas.length?T.verde:T.textMuted, color:'white', fontWeight:700, cursor:linhas.length?'pointer':'not-allowed' }}>
            📥 Exportar Excel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
