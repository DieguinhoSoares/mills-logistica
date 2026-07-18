// ============================================================
// AssignDriverModal — extraído de FrotasView.jsx (item 11 da revisão)
// Atribuição de motorista/transportadora ao aceitar solicitação.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS } from '../lib/constants'
import { fmt, todayStr } from '../lib/utils'
import { FreteEstimativa } from './FreteEstimativa'

// ── AssignDriverModal ─────────────────────────────────────────────────────────
export function AssignDriverModal({ req, drivers, simClients, cards, onConfirm, onCancel }) {
  const [execType,setExecType]=useState('motorista')
  const [driverId,setDriverId]=useState('')
  const [transpNome,setTranspNome]=useState('')
  // Trava contra duplo clique — bug real encontrado: sem isso, um clique
  // duplo no botão "Confirmar" (comum em conexão lenta) disparava onConfirm
  // duas vezes antes da primeira terminar, criando 2 cards idênticos pro
  // mesmo motorista/solicitação, já que é uma criação nova (addDoc) sem ID.
  const [saving,setSaving]=useState(false)
  const [transpCnpj,setTranspCnpj]=useState('')
  const [date,setDate]=useState(req?.desiredDate||todayStr())
  const [note,setNote]=useState('')
  // Captura o que o FreteEstimativa está mostrando de fato — inclusive quando
  // o analista troca o veículo manualmente. Sem isso, a escolha feita ali
  // nunca chegava a este componente e era descartada ao confirmar.
  const [frete,setFrete]=useState(null)
  const selectedDriver=drivers.find(d=>d.id===driverId)
  const dateEnd = req?.desiredDateEnd || date
  // Verifica se o motorista selecionado já tem outro serviço ativo em data sobreposta
  const conflitos = (cards||[]).filter(c =>
    c.driverId === driverId &&
    c.id !== req?.id &&
    !['concluido','cancelado'].includes(c.status) &&
    c.startDate && c.endDate &&
    date <= c.endDate && dateEnd >= c.startDate
  )
  const handleConfirm=async()=>{
    if (saving) return // trava extra — ignora cliques repetidos mesmo se o disabled do botão não pegar a tempo
    setSaving(true)
    const freteInfo = { veiculoId:frete?.veiculoId||'', veiculoLabel:frete?.veiculoLabel||'', freteEstimado:frete?.valorEstimado??null, freteSugerido:!!frete?.sugerido, km:frete?.km??null }
    try {
      if(execType==='transportadora'){await onConfirm({driverId:'',driverName:'',transportadoraNome:transpNome,transportadoraCnpj:transpCnpj,date,note,...freteInfo})}
      else{await onConfirm({driverId,driverName:selectedDriver?.name||'',transportadoraNome:'',transportadoraCnpj:'',date,note,...freteInfo})}
    } finally {
      setSaving(false) // se o modal já fechou (sucesso), isso é inofensivo — só importa quando dá erro e o modal continua aberto
    }
  }
  const canConfirm=(execType==='transportadora'?transpNome.trim():driverId) && !saving
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:540, maxHeight:'92vh', overflowY:'auto', boxShadow:T.shadowLg, border:`2px solid ${T.verde}` }}>
        <h2 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:20, margin:'0 0 6px' }}>✅ Aceitar Solicitação</h2>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, margin:'0 0 4px' }}>Defina a execução para <strong style={{ color:T.laranja }}>{req?.clientName||req?.requesterName}</strong>.</p>
        <FreteEstimativa request={req} simClients={simClients} onChange={setFrete}/>
        <div style={{ display:'flex', gap:8, marginBottom:16, marginTop:16 }}>
          {[['motorista','👤 Motorista Mills'],['transportadora','🚚 Transportadora Externa']].map(([v,l])=>(
            <div key={v} onClick={()=>setExecType(v)} style={{ flex:1, border:`2px solid ${execType===v?T.laranja:T.border}`, borderRadius:T.r, padding:'9px 12px', cursor:'pointer', textAlign:'center', background:execType===v?T.laranjaLight:T.surfaceAlt }}>
              <div style={{ color:T.text, fontFamily:FONT, fontSize:12, fontWeight:execType===v?800:500 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {execType==='motorista'&&(
            <div>
              <label style={LS}>Motorista responsável</label>
              <select value={driverId} onChange={e=>setDriverId(e.target.value)} style={IS}>
                <option value="">— selecione o motorista —</option>
                {drivers.filter(d=>d.active!==false).map(d=>(<option key={d.id} value={d.id}>{d.name}{d.unit?` · ${d.unit.replace(/ \(.*\)/,'')}`:''}{d.category?` (CNH ${d.category})`:''}</option>))}
              </select>
              {drivers.length===0&&<div style={{ marginTop:5, color:T.amarelo, fontSize:11, fontFamily:FONT }}>⚠️ Cadastre motoristas em 👤 Motoristas.</div>}
              {selectedDriver&&(<div style={{ marginTop:8, padding:'10px 13px', background:T.verdeLight, borderRadius:T.r, border:`1px solid ${T.verde}30` }}>
                <div style={{ color:T.verde, fontFamily:FONT, fontWeight:700, fontSize:12 }}>👤 {selectedDriver.name}</div>
                <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10, marginTop:2 }}>{selectedDriver.cnh&&`CNH: ${selectedDriver.cnh} · `}Cat. {selectedDriver.category||'—'} · {selectedDriver.phone||'—'}</div>
              </div>)}
              {conflitos.length>0&&(<div style={{ marginTop:8, padding:'10px 13px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}40` }}>
                <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:12, marginBottom:4 }}>⚠️ Choque de agenda</div>
                {conflitos.map(cf=>(
                  <div key={cf.id} style={{ color:T.textSec, fontFamily:FONT, fontSize:11, marginBottom:2 }}>
                    • {cf.client||'—'} · {fmt(cf.startDate)}{cf.endDate!==cf.startDate?` a ${fmt(cf.endDate)}`:''}
                  </div>
                ))}
                <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10, marginTop:4 }}>Este motorista já está alocado nesse período. Você pode confirmar mesmo assim.</div>
              </div>)}
            </div>
          )}
          {execType==='transportadora'&&(<>
            <div><label style={LS}>Nome da Transportadora <span style={{ color:T.perigo }}>*</span></label><input value={transpNome} onChange={e=>setTranspNome(e.target.value)} placeholder="Ex: Hengel Transportes" style={IS}/></div>
            <div><label style={LS}>CNPJ</label><input value={transpCnpj} onChange={e=>setTranspCnpj(e.target.value)} placeholder="00.000.000/0001-00" style={IS}/></div>
          </>)}
          <div><label style={LS}>Data de execução</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={IS}/></div>
          <div><label style={LS}>Observação para o solicitante</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex: Motorista confirmado, saída às 07h..." style={{ ...IS, height:68, resize:'vertical' }}/></div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={onCancel} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!canConfirm} style={{ ...BS, background:canConfirm?T.verde:T.borderMid, color:'white', fontWeight:700, opacity:canConfirm?1:0.5, cursor:canConfirm?'pointer':'not-allowed' }}>
            {saving ? '⏳ Salvando...' : '✅ Confirmar e criar no calendário'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
