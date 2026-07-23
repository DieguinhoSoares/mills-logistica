import { useState } from 'react'
import { motion } from 'framer-motion'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { T, FONT, BS, IS, LS } from '../lib/constants'
import { fmt, todayStr, getWeekDays } from '../lib/utils'
import { montarLinhaRelatorio, diagnosticarLacunasEmissao } from '../lib/emissoes'

// Linha somente-leitura pra listar um card dentro de uma categoria de lacuna
// (recuperável por migração / sem consumo cadastrado) — sem ação, só identificação.
function LinhaCard({ card, detalhe }) {
  return (
    <div style={{ padding:'6px 8px', borderBottom:`1px solid ${T.border}`, fontFamily:FONT, fontSize:10, color:T.textSec }}>
      <strong>{card.id}</strong> · {card.client || '—'} · {fmt(card.startDate)}
      {detalhe && <div style={{ color:T.textMuted, marginTop:2 }}>{detalhe}</div>}
    </div>
  )
}

// Linha editável pra corrigir origem/destino de um card que não tem nenhum
// dos dois cadastrado — depois de salvo, o card passa a ser "recuperável"
// pela migração de km (que já existe acima).
function LinhaSemOrigemDestino({ card, addToast }) {
  const [origemCidade, setOrigemCidade] = useState('')
  const [origemUF, setOrigemUF] = useState('')
  const [destinoCidade, setDestinoCidade] = useState('')
  const [destinoUF, setDestinoUF] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const podeSalvar = origemCidade.trim() && origemUF.trim() && destinoCidade.trim() && destinoUF.trim()

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'cards', card.id), {
        originCity: origemCidade.trim(), origin: origemUF.trim().toUpperCase(),
        destCity: destinoCidade.trim(), destination: destinoUF.trim().toUpperCase(),
      })
      setSalvo(true)
    } catch (err) {
      console.error('Erro ao salvar origem/destino:', err)
      addToast?.('Erro ao salvar. Tente novamente.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (salvo) {
    return (
      <div style={{ padding:'6px 8px', borderBottom:`1px solid ${T.border}`, fontFamily:FONT, fontSize:10, color:T.sucesso }}>
        ✅ {card.id} · {card.client || '—'} — salvo. Roda a migração de km acima pra recuperar este serviço.
      </div>
    )
  }

  return (
    <div style={{ padding:'8px', borderBottom:`1px solid ${T.border}` }}>
      <div style={{ fontFamily:FONT, fontSize:10, color:T.textSec, marginBottom:6 }}>
        <strong>{card.id}</strong> · {card.client || '—'} · {fmt(card.startDate)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 44px', gap:4, marginBottom:4 }}>
        <input placeholder="Cidade origem" value={origemCidade} onChange={e=>setOrigemCidade(e.target.value)}
          style={{ ...IS, padding:'5px 8px', fontSize:11 }}/>
        <input placeholder="UF" maxLength={2} value={origemUF} onChange={e=>setOrigemUF(e.target.value)}
          style={{ ...IS, padding:'5px 8px', fontSize:11, textTransform:'uppercase' }}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 44px', gap:4, marginBottom:6 }}>
        <input placeholder="Cidade destino" value={destinoCidade} onChange={e=>setDestinoCidade(e.target.value)}
          style={{ ...IS, padding:'5px 8px', fontSize:11 }}/>
        <input placeholder="UF" maxLength={2} value={destinoUF} onChange={e=>setDestinoUF(e.target.value)}
          style={{ ...IS, padding:'5px 8px', fontSize:11, textTransform:'uppercase' }}/>
      </div>
      <button onClick={handleSalvar} disabled={!podeSalvar || salvando}
        style={{ ...BS, width:'100%', padding:'6px', fontSize:10, background:podeSalvar?T.verde:T.textMuted, color:'white', cursor:podeSalvar?'pointer':'not-allowed' }}>
        {salvando ? 'Salvando...' : 'Salvar origem/destino'}
      </button>
    </div>
  )
}

// Lista colapsável de cards de uma categoria de lacuna.
function ListaLacuna({ titulo, cards, render }) {
  const [aberto, setAberto] = useState(false)
  if (cards.length === 0) return null
  return (
    <div style={{ marginTop:4 }}>
      <button onClick={()=>setAberto(a=>!a)}
        style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:FONT, fontSize:10, color:T.info, fontWeight:700 }}>
        {aberto ? '▾' : '▸'} {titulo}
      </button>
      {aberto && (
        <div style={{ maxHeight:180, overflowY:'auto', marginTop:4, background:T.surface, borderRadius:T.rSm, border:`1px solid ${T.border}` }}>
          {cards.map(c => <div key={c.id}>{render(c)}</div>)}
        </div>
      )}
    </div>
  )
}

// Exportação em Excel do relatório de emissão de carbono — enviado ao time
// de Meio Ambiente da Mills para divulgação externa ao mercado. Colunas no
// mesmo formato do modelo já usado hoje pelo time (ver conversa 2026-07).
export function EmissoesExportModal({ cards, simClients, onClose, onRunMigration, migrating, migrateLog, migrateProgress, addToast }) {
  const today = todayStr()
  const [dateFrom, setDateFrom] = useState(getWeekDays(today)[0])
  const [dateTo,   setDateTo]   = useState(getWeekDays(today)[6])
  const [done, setDone] = useState(false)
  const [erro, setErro] = useState('')

  const concluidos = cards.filter(c =>
    c.status === 'concluido' && c.startDate && c.startDate >= dateFrom && c.startDate <= dateTo
  )
  const linhas = concluidos.map(c => montarLinhaRelatorio(c, simClients))
  const diagnostico = diagnosticarLacunasEmissao(concluidos, simClients)
  const semDado = diagnostico.total

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
        style={{ background:T.surface, borderRadius:T.rLg, padding:24, width:420, maxWidth:'90vw', maxHeight:'85vh', overflowY:'auto', boxShadow:T.shadowLg }}>
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
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ color:T.perigo, fontWeight:700 }}>
                ⚠️ {semDado} sem dado suficiente — aparecem no arquivo com "—", não são inventados:
              </div>
              {diagnostico.recuperavelPorMigracao.length > 0 && (
                <div style={{ paddingLeft:14 }}>
                  • {diagnostico.recuperavelPorMigracao.length} sem km, mas com origem/destino — <strong>recuperável</strong> pela migração abaixo
                  <ListaLacuna titulo="ver serviços" cards={diagnostico.recuperavelPorMigracao}
                    render={c => <LinhaCard card={c} detalhe={`${c.originCity||'—'} → ${c.destCity||'—'}`}/>}/>
                </div>
              )}
              {diagnostico.semOrigemDestino.length > 0 && (
                <div style={{ paddingLeft:14 }}>
                  • {diagnostico.semOrigemDestino.length} sem km e sem origem/destino — corrija abaixo
                  <ListaLacuna titulo="corrigir serviços" cards={diagnostico.semOrigemDestino}
                    render={c => <LinhaSemOrigemDestino card={c} addToast={addToast}/>}/>
                </div>
              )}
              {diagnostico.semConsumoModelo.length > 0 && (
                <div style={{ paddingLeft:14 }}>
                  • {diagnostico.semConsumoModelo.length} com km, mas sem consumo médio cadastrado pro veículo/modelo — não é sobre km, precisa cadastrar o consumo desse veículo
                  <ListaLacuna titulo="ver serviços" cards={diagnostico.semConsumoModelo}
                    render={c => <LinhaCard card={c} detalhe={`Veículo: ${c.veiculoLabel||c.veiculoId||'—'} · N° interno: ${c.nInterno||'—'}`}/>}/>
                </div>
              )}
            </div>
          )}
        </div>

        {diagnostico.recuperavelPorMigracao.length > 0 && onRunMigration && (
          <div style={{ marginTop:10, padding:'10px 12px', background:T.amareloLight, borderRadius:T.rSm }}>
            <div style={{ fontFamily:FONT, fontSize:10, color:'#8A6D00', marginBottom:6 }}>
              {diagnostico.recuperavelPorMigracao.length} serviço(s) têm origem/destino salvos mas não têm km — a migração recalcula usando esses dados. É seguro rodar mais de uma vez.
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
