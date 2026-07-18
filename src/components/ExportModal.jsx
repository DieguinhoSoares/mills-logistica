import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS } from '../lib/constants'
import { fmt, todayStr, getWeekDays, diasAtras } from '../lib/utils'

export function ExportModal({ cards, onClose }) {
  const today=todayStr()
  const [dateFrom,setDateFrom]=useState(getWeekDays(today)[0])
  const [dateTo,  setDateTo  ]=useState(getWeekDays(today)[6])
  const [driver,  setDriver  ]=useState('todos')
  const [serviceTypes, setServiceTypes] = useState(['todos'])
  const [urgencies, setUrgencies] = useState(['todas'])
  const [unit, setUnit] = useState('todas')
  const [done,    setDone    ]=useState(false)
  const allDrivers=['todos',...Array.from(new Set(cards.map(c=>c.driver||'Sem motorista'))).sort()]
  const allUnits=['todas',...Array.from(new Set(cards.map(c=>c.unit).filter(Boolean))).sort()]

  // Multi-seleção com "Todos"/"Todas": clicar na opção coringa limpa o resto;
  // clicar numa opção específica remove o coringa. Nunca deixa a lista vazia
  // (se remover a última específica, volta pro coringa) — sem isso o filtro
  // combinado com AND ficaria impossível de satisfazer, escondendo tudo.
  const toggleChip = (list, setList, value, allValue) => {
    if (value === allValue) { setList([allValue]); return }
    const next = list.filter(v => v !== allValue)
    const result = next.includes(value) ? next.filter(v => v !== value) : [...next, value]
    setList(result.length ? result : [allValue])
  }

  const filtered=cards.filter(c=>{
    if(!c.startDate) return false
    const inRange = c.startDate>=dateFrom&&c.startDate<=dateTo
    const driverMatch = driver==='todos'||(c.driver||'Sem motorista')===driver
    const unitMatch = unit==='todas' || c.unit===unit
    const typeMatch = serviceTypes.includes('todos') || serviceTypes.includes(c.type)
    const urgencyMatch = urgencies.includes('todas') || urgencies.includes(c.urgency)
    return inRange && driverMatch && unitMatch && typeMatch && urgencyMatch
  })
  const unitSlug = unit === 'todas' ? '' : '_' + unit.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'')

  const handleExport=async()=>{
    const XLSX=await import('xlsx')
    const wb=XLSX.utils.book_new()
    const hGreen ={font:{bold:true,color:{rgb:'FFFFFF'},name:'Arial',sz:13},fill:{fgColor:{rgb:'004042'}},alignment:{horizontal:'center',vertical:'center'}}
    const hOrange={font:{bold:true,color:{rgb:'FFFFFF'},name:'Arial',sz:10},fill:{fgColor:{rgb:'F37021'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{bottom:{style:'thin',color:{rgb:'C24003'}}}}
    const subHdr ={font:{bold:true,color:{rgb:'004042'},name:'Arial',sz:10},fill:{fgColor:{rgb:'E0EEEE'}},alignment:{horizontal:'center',vertical:'center'}}
    const kpiVal ={font:{bold:true,color:{rgb:'F37021'},name:'Arial',sz:22},alignment:{horizontal:'center',vertical:'center'}}
    const kpiLbl ={font:{color:{rgb:'4A3F35'},name:'Arial',sz:9},alignment:{horizontal:'center',vertical:'center'}}
    const subInfo={font:{color:{rgb:'4A3F35'},name:'Arial',sz:10},fill:{fgColor:{rgb:'FEF0E6'}},alignment:{horizontal:'center'}}
    const footSt ={font:{italic:true,color:{rgb:'9E9590'},name:'Arial',sz:8},alignment:{horizontal:'center'}}
    const rowEven=(bold=false)=>({font:{name:'Arial',sz:10,bold},fill:{fgColor:{rgb:'FAF8F5'}},alignment:{vertical:'center'},border:{bottom:{style:'hair',color:{rgb:'E2DDD6'}}}})
    const rowOdd =(bold=false)=>({font:{name:'Arial',sz:10,bold},fill:{fgColor:{rgb:'FFFFFF'}},alignment:{vertical:'center'},border:{bottom:{style:'hair',color:{rgb:'E2DDD6'}}}})
    const setCell=(ws,ref,v,s)=>{ws[ref]={v,t:typeof v==='number'?'n':'s',s}}
    // ── Aba Resumo ─────────────────────────────────────────────────────────
    const wsR=XLSX.utils.aoa_to_sheet([])
    wsR['!merges']=[]
    wsR['!merges'].push({s:{r:0,c:0},e:{r:0,c:5}});setCell(wsR,'A1','Mills Pesados · Gestão de Frotas — Logística',hGreen)
    wsR['!merges'].push({s:{r:1,c:0},e:{r:1,c:5}});setCell(wsR,'A2',`Relatório de Operações · ${fmt(dateFrom)} a ${fmt(dateTo)}`,subInfo)
    wsR['!merges'].push({s:{r:2,c:0},e:{r:2,c:5}});setCell(wsR,'A3',`Emitido em: ${new Date().toLocaleString('pt-BR')} · Filtro: ${driver==='todos'?'Todos os motoristas':driver}`,{font:{color:{rgb:'9E9590'},name:'Arial',sz:9},alignment:{horizontal:'center'}})
    wsR['!merges'].push({s:{r:4,c:0},e:{r:4,c:5}});setCell(wsR,'A5','KPIs DO PERÍODO',subHdr)
    const kpis=[['Total de Serviços',filtered.length],['Dias no Período',Math.round((new Date(dateTo)-new Date(dateFrom))/86400000)+1],['Motoristas',new Set(filtered.map(c=>c.driver||'—')).size],['Estados Atendidos',new Set(filtered.map(c=>c.destination||c.origin).filter(Boolean)).size],['Críticos / Altos',filtered.filter(c=>c.urgency==='critico'||c.urgency==='alto').length],['Guindauto',filtered.filter(c=>c.type==='guindauto').length]]
    kpis.forEach(([lbl,val],i)=>{const col=String.fromCharCode(65+i);setCell(wsR,`${col}6`,String(val),kpiVal);setCell(wsR,`${col}7`,lbl,kpiLbl)})
    wsR['!merges'].push({s:{r:8,c:0},e:{r:8,c:5}});setCell(wsR,'A9','DISTRIBUIÇÃO POR TIPO DE SERVIÇO',subHdr)
    const tipos=Object.entries(filtered.reduce((acc,c)=>{acc[c.type]=(acc[c.type]||0)+1;return acc},{}))
    ;['A10','B10','C10','D10'].forEach((ref,i)=>setCell(wsR,ref,['Tipo de Serviço','Qtd','% do Total','Motoristas'][i],hOrange))
    tipos.forEach(([tipo,count],i)=>{
      const label={guindauto:'Guindauto',freteMillsInterno:'Frete Mills',freteCliente:'Frete Cliente'}[tipo]||tipo
      const pct=filtered.length?(count/filtered.length*100).toFixed(1)+'%':'0%'
      const mots=new Set(filtered.filter(c=>c.type===tipo).map(c=>c.driver||'—')).size
      const st=i%2===0?rowEven():rowOdd()
      setCell(wsR,`A${11+i}`,label,{...st,alignment:{horizontal:'left',vertical:'center'}})
      setCell(wsR,`B${11+i}`,count,{...st,font:{...st.font,bold:true},alignment:{horizontal:'center',vertical:'center'}})
      setCell(wsR,`C${11+i}`,pct,{...st,font:{...st.font,color:{rgb:'F37021'},bold:true},alignment:{horizontal:'center'}})
      setCell(wsR,`D${11+i}`,mots,{...st,alignment:{horizontal:'center',vertical:'center'}})
    })
    const footRow=11+tipos.length+1
    wsR['!merges'].push({s:{r:footRow,c:0},e:{r:footRow,c:5}});setCell(wsR,`A${footRow+1}`,'Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto',footSt)
    wsR['!ref']=`A1:F${footRow+1}`;wsR['!cols']=[20,14,14,20,14,14].map(w=>({wch:w}));wsR['!rows']=[{hpt:30},{hpt:18},{hpt:14},,{hpt:6},{hpt:30},{hpt:16}]
    XLSX.utils.book_append_sheet(wb,wsR,'Resumo')
    // ── Aba Detalhamento ───────────────────────────────────────────────────
    const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    const TL={guindauto:'Guindauto',freteMillsInterno:'Frete Mills',freteCliente:'Frete Cliente'}
    const UL={critico:'Crítico',alto:'Alto',medio:'Médio',baixo:'Baixo'}
    const colH=['Data','Dia','Tipo','Subtipo','Cliente / Planta','OM','N° Interno','Máquina','Origem','Destino','Motorista','Unidade','Urgência','Observações']
    const dRows=filtered.sort((a,b)=>a.startDate.localeCompare(b.startDate)).map(c=>[fmt(c.startDate),WD[new Date(c.startDate+'T12:00:00').getDay()],TL[c.type]||c.type,c.subtype?c.subtype.replace(/_/g,' '):'—',c.client||c.plantaObra||'—',c.om||'—',c.nInterno||'—',c.machine||'—',c.originCity||c.origin||'—',c.destCity||c.destination||'—',c.driver||'—',c.unit||'—',UL[c.urgency]||'—',c.notes||''])
    const wsD=XLSX.utils.aoa_to_sheet([['Mills Pesados · Relatório Detalhado',...Array(13).fill('')],[`Período: ${fmt(dateFrom)} a ${fmt(dateTo)} · ${filtered.length} serviço(s)`,...Array(13).fill('')],Array(14).fill(''),colH,...dRows])
    wsD['!merges']=[{s:{r:0,c:0},e:{r:0,c:13}},{s:{r:1,c:0},e:{r:1,c:13}}];wsD['A1'].s=hGreen;wsD['A2'].s=subInfo
    colH.forEach((_,i)=>{const ref=XLSX.utils.encode_cell({r:3,c:i});if(wsD[ref])wsD[ref].s=hOrange})
    dRows.forEach((_,i)=>{const st=i%2===0?rowEven:rowOdd;colH.forEach((__,j)=>{const ref=XLSX.utils.encode_cell({r:4+i,c:j});if(wsD[ref])wsD[ref].s={...st(j===0),alignment:{vertical:'center',horizontal:j===0?'left':'center',wrapText:j===13}}})})
    wsD['!cols']=[10,5,14,14,28,8,12,18,12,12,16,14,10,28].map(w=>({wch:w}));wsD['!rows']=[{hpt:28},{hpt:16},,{hpt:20}]
    XLSX.utils.book_append_sheet(wb,wsD,'Detalhamento')
    // ── Aba Por Motorista ──────────────────────────────────────────────────
    const byDrv={};filtered.forEach(c=>{const d=c.driver||'Sem motorista';if(!byDrv[d])byDrv[d]=[];byDrv[d].push(c)})
    const mH=['Motorista','Total','Guindauto','Frete Mills','Frete Cliente','Estados','Críticos/Altos']
    const mR=Object.entries(byDrv).sort((a,b)=>b[1].length-a[1].length).map(([name,cs])=>[name,cs.length,cs.filter(c=>c.type==='guindauto').length,cs.filter(c=>c.type==='freteMillsInterno').length,cs.filter(c=>c.type==='freteCliente').length,new Set(cs.map(c=>c.destination||c.origin).filter(Boolean)).size,cs.filter(c=>c.urgency==='critico'||c.urgency==='alto').length])
    const wsM=XLSX.utils.aoa_to_sheet([['Mills Pesados · Consolidado por Motorista',...Array(6).fill('')],[`Período: ${fmt(dateFrom)} a ${fmt(dateTo)}`,...Array(6).fill('')],Array(7).fill(''),mH,...mR])
    wsM['!merges']=[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}}];wsM['A1'].s=hGreen;wsM['A2'].s=subInfo
    mH.forEach((_,i)=>{const ref=XLSX.utils.encode_cell({r:3,c:i});if(wsM[ref])wsM[ref].s=hOrange})
    mR.forEach((_,i)=>{const st=i%2===0?rowEven:rowOdd;mH.forEach((__,j)=>{const ref=XLSX.utils.encode_cell({r:4+i,c:j});if(wsM[ref])wsM[ref].s={...st(j===0),alignment:{vertical:'center',horizontal:j===0?'left':'center'}}})})
    wsM['!cols']=[24,8,12,12,12,10,12].map(w=>({wch:w}));wsM['!rows']=[{hpt:28},{hpt:16},,{hpt:20}]
    XLSX.utils.book_append_sheet(wb,wsM,'Por Motorista')
    // Nome do arquivo inclui a unidade filtrada (normalizada, sem acento/espaço)
    // pra facilitar organizar relatórios de filiais diferentes lado a lado.
    XLSX.writeFile(wb,`mills_frotas${unitSlug}_${dateFrom}_a_${dateTo}${driver!=='todos'?'_'+driver.split(' ')[0]:''}.xlsx`)
    setDone(true)
  }

  // PDF de 1 página com o resumo executivo (mesmos KPIs/distribuição da aba
  // "Resumo" do Excel) — pensado pra quem só quer mandar um panorama rápido
  // por e-mail/WhatsApp, sem abrir uma planilha inteira.
  const [donePdf, setDonePdf] = useState(false)
  const handleExportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    // Cabeçalho com a identidade Mills
    doc.setFillColor(0, 64, 66) // T.verde
    doc.rect(0, 0, 210, 22, 'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(14)
    doc.text('Mills Pesados · Gestão de Frotas — Logística', 105, 13, { align:'center' })
    doc.setFontSize(9)
    doc.text(`Relatório de Operações · ${fmt(dateFrom)} a ${fmt(dateTo)}`, 105, 19, { align:'center' })

    // KPIs — mesmos já calculados pra aba Resumo do Excel, não recalcula do zero
    const kpis = [
      ['Total de Serviços', filtered.length],
      ['Dias no Período', Math.round((new Date(dateTo)-new Date(dateFrom))/86400000)+1],
      ['Motoristas', new Set(filtered.map(c=>c.driver||'—')).size],
      ['Estados Atendidos', new Set(filtered.map(c=>c.destination||c.origin).filter(Boolean)).size],
      ['Críticos / Altos', filtered.filter(c=>c.urgency==='critico'||c.urgency==='alto').length],
      ['Guindauto', filtered.filter(c=>c.type==='guindauto').length],
    ]
    doc.setTextColor(74,63,53) // T.text (aprox)
    doc.setFontSize(10)
    doc.text('KPIs DO PERÍODO', 14, 32)
    autoTable(doc, {
      startY: 35,
      head: [kpis.map(k=>k[0])],
      body: [kpis.map(k=>String(k[1]))],
      theme: 'grid',
      headStyles: { fillColor:[224,238,238], textColor:[0,64,66], fontStyle:'bold', halign:'center', fontSize:8 },
      bodyStyles: { halign:'center', fontStyle:'bold', textColor:[243,112,33], fontSize:12 },
      margin: { left:14, right:14 },
    })

    // Distribuição por tipo — mesma tabela `tipos` já usada na aba Resumo
    const tipos = Object.entries(filtered.reduce((acc,c)=>{acc[c.type]=(acc[c.type]||0)+1;return acc},{}))
    const tipoLabel = {guindauto:'Guindauto', freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente'}
    const tiposRows = tipos.map(([tipo,count]) => {
      const pct = filtered.length ? (count/filtered.length*100).toFixed(1)+'%' : '0%'
      const mots = new Set(filtered.filter(c=>c.type===tipo).map(c=>c.driver||'—')).size
      return [tipoLabel[tipo]||tipo, String(count), pct, String(mots)]
    })
    const afterKpis = doc.lastAutoTable.finalY + 10
    doc.text('DISTRIBUIÇÃO POR TIPO DE SERVIÇO', 14, afterKpis)
    autoTable(doc, {
      startY: afterKpis + 3,
      head: [['Tipo de Serviço','Qtd','% do Total','Motoristas']],
      body: tiposRows,
      theme: 'striped',
      headStyles: { fillColor:[243,112,33], textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      margin: { left:14, right:14 },
    })

    // Rodapé com o slogan da marca
    doc.setFontSize(8)
    doc.setTextColor(158,149,144)
    doc.text('Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto', 105, 287, { align:'center' })

    doc.save(`mills_frotas${unitSlug}_resumo_${dateFrom}_a_${dateTo}.pdf`)
    setDonePdf(true)
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:520, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:0 }}>📊 Exportar Relatório Excel</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}`, padding:'14px 16px', marginBottom:14 }}>
          <label style={LS}>📅 Período</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center', marginTop:6 }}>
            <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDone(false)}} style={IS}/>
            <span style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center' }}>até</span>
            <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDone(false)}} style={IS}/>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
            {(() => {
              const lastMonthStart = new Date(Number(today.slice(0,4)), Number(today.slice(5,7))-2, 1)
              const lastMonthEnd   = new Date(Number(today.slice(0,4)), Number(today.slice(5,7))-1, 0)
              const quarterStart   = new Date(Number(today.slice(0,4)), Math.floor(Number(today.slice(5,7))/3)*3, 1)
              return [
                ['Esta semana',getWeekDays(today)[0],getWeekDays(today)[6]],
                ['Este mês',`${today.slice(0,7)}-01`,`${today.slice(0,7)}-${new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate().toString().padStart(2,'0')}`],
                ['Mês passado', lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]],
                ['Trimestre',   quarterStart.toISOString().split('T')[0], today],
                ['Últimos 30 dias',diasAtras(30),today],
                ['Últimos 90 dias',diasAtras(90),today],
              ]
            })().map(([lbl,f,t])=>(
              <button key={lbl} onClick={()=>{setDateFrom(f);setDateTo(t);setDone(false)}}
                style={{ ...BS, background:dateFrom===f&&dateTo===t?T.laranja:T.surface, color:dateFrom===f&&dateTo===t?'white':T.textSec, border:`1px solid ${dateFrom===f&&dateTo===t?T.laranja:T.border}`, fontSize:10, padding:'4px 10px' }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={LS}>👤 Motorista</label>
          <select value={driver} onChange={e=>{setDriver(e.target.value);setDone(false)}} style={{ ...IS, marginTop:5 }}>
            {allDrivers.map(d=><option key={d} value={d}>{d==='todos'?'Todos os motoristas':d}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={LS}>🏢 Unidade</label>
          <select value={unit} onChange={e=>{setUnit(e.target.value);setDone(false)}} style={{ ...IS, marginTop:5 }}>
            {allUnits.map(u=><option key={u} value={u}>{u==='todas'?'Todas as unidades':u}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={LS}>🚚 Tipo de serviço</label>
          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
            {[['todos','Todos'],['guindauto','Guindauto'],['freteMillsInterno','Frete Mills'],['freteCliente','Frete Cliente']].map(([val,lbl])=>(
              <button key={val} onClick={()=>{toggleChip(serviceTypes,setServiceTypes,val,'todos');setDone(false)}}
                style={{ ...BS, background:serviceTypes.includes(val)?T.laranja:T.surface, color:serviceTypes.includes(val)?'white':T.textSec, border:`1px solid ${serviceTypes.includes(val)?T.laranja:T.border}`, fontSize:10, padding:'4px 10px' }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={LS}>⚡ Urgência</label>
          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
            {[['todas','Todas'],['critico','Crítico'],['alto','Alto'],['medio','Médio'],['baixo','Baixo']].map(([val,lbl])=>(
              <button key={val} onClick={()=>{toggleChip(urgencies,setUrgencies,val,'todas');setDone(false)}}
                style={{ ...BS, background:urgencies.includes(val)?T.laranja:T.surface, color:urgencies.includes(val)?'white':T.textSec, border:`1px solid ${urgencies.includes(val)?T.laranja:T.border}`, fontSize:10, padding:'4px 10px' }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{ background:T.laranjaLight, border:`1px solid ${T.laranja}30`, borderRadius:T.r, padding:'10px 14px', marginBottom:18 }}>
          <div style={{ color:T.laranja, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:6 }}>📋 Prévia da exportação</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[['Serviços',filtered.length],['Período',`${Math.round((new Date(dateTo)-new Date(dateFrom))/86400000)+1} dias`],['Abas Excel','Resumo · Detalhes · Motoristas']].map(([l,v])=>(
              <div key={l}><div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.07em' }}>{l}</div><div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{v}</div></div>
            ))}
          </div>
          {filtered.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.laranja}20` }}>
              <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Amostra (3 primeiras linhas)</div>
              {filtered.slice(0,3).map(c => {
                const tipoLabel = {guindauto:'Guindauto', freteMillsInterno:'Frete Mills', freteCliente:'Frete Cliente'}[c.type] || c.type
                return (
                  <div key={c.id} style={{ display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr', gap:6, padding:'3px 0', fontFamily:FONT, fontSize:10, color:T.textSec }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.client || c.plantaObra || '—'}</span>
                    <span>{tipoLabel}</span>
                    <span>{fmt(c.startDate)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
          <button onClick={handleExportPdf} disabled={filtered.length===0}
            style={{ ...BS, background:filtered.length===0?T.borderMid:donePdf?T.verde:T.surface, color:filtered.length===0?'white':donePdf?'white':T.textSec, border:`1px solid ${T.border}`, fontWeight:700, minWidth:120, opacity:filtered.length===0?0.6:1 }}>
            {donePdf?'✅ Baixado!':'📄 Resumo PDF'}
          </button>
          <button onClick={handleExport} disabled={filtered.length===0}
            style={{ ...BS, background:filtered.length===0?T.borderMid:done?T.verde:T.laranja, color:'white', fontWeight:700, minWidth:170, opacity:filtered.length===0?0.6:1 }}>
            {done?'✅ Baixado!':filtered.length===0?'Sem dados no período':'⬇ Exportar .xlsx'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
