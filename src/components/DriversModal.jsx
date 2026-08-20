// ============================================================
// DriversModal — extraído de FrotasView.jsx (item 11 da revisão)
// Cadastro e gestão de motoristas.
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS, FILIAIS, TIPO_VEICULO_OPTIONS } from '../lib/constants'
import { ConfirmModal } from './UI'

const TIPO_VEICULO_LABEL = Object.fromEntries(TIPO_VEICULO_OPTIONS.map(o=>[o.value,o.label]))

// ── DriversModal ──────────────────────────────────────────────────────────────
export function DriversModal({ drivers, veiculos=[], onSave, onDelete, onClose, onRotograma, addToast }) {
  const blank={name:'',cnh:'',category:'',phone:'',unit:'',active:true}
  const [form,setForm]=useState(blank)
  const [editing,setEdit]=useState(null)
  const [saving,setSaving]=useState(false)
  // Único botão de exclusão do app sem confirmação — um clique errado numa
  // lista longa apagava o motorista na hora, sem "tem certeza?" nenhum,
  // diferente de toda outra ação destrutiva já protegida por ConfirmModal.
  const [deleting,setDeleting]=useState(null)
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  // Cartão do motorista em PDF — reúne dados de contato + veículo(s) vinculado(s)
  // num 1-pager pra mandar pra quem emite NF ou precisa desses dados (pedido
  // recorrente do time: hoje isso é feito catando informação espalhada).
  // Mesmo padrão de import dinâmico do jsPDF/jspdf-autotable já usado em
  // ExportModal.jsx — não carrega a lib pro bundle inicial à toa.
  const handleGerarCartao = async d => {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const veiculosDoMotorista = veiculos.filter(v=>v.motoristaId===d.id)

    doc.setFillColor(0, 64, 66)
    doc.rect(0, 0, 210, 22, 'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(14)
    doc.text('Mills Pesados · Cartão do Motorista', 105, 13, { align:'center' })
    doc.setFontSize(9)
    doc.text('Dados para emissão de NF / identificação', 105, 19, { align:'center' })

    doc.setTextColor(74,63,53)
    doc.setFontSize(10)
    doc.text('DADOS DO MOTORISTA', 14, 32)
    autoTable(doc, {
      startY: 35,
      body: [
        ['Nome', d.name||'—'],
        ['CNH', d.cnh||'—'],
        ['Categoria CNH', d.category||'—'],
        ['Telefone', d.phone||'—'],
        ['Filial', d.unit||'—'],
        ['Situação', d.active===false?'Inativo':'Ativo'],
      ],
      theme: 'grid',
      styles: { fontSize:10 },
      columnStyles: { 0:{ fontStyle:'bold', fillColor:[224,238,238], textColor:[0,64,66], cellWidth:45 } },
      margin: { left:14, right:14 },
    })

    const afterDados = doc.lastAutoTable.finalY + 10
    doc.text('VEÍCULO(S) VINCULADO(S)', 14, afterDados)
    if (veiculosDoMotorista.length === 0) {
      doc.setFontSize(9)
      doc.setTextColor(158,149,144)
      doc.text('Nenhum veículo vinculado a este motorista.', 14, afterDados + 7)
    } else {
      autoTable(doc, {
        startY: afterDados + 3,
        head: [['Tipo','Placa','Modelo']],
        body: veiculosDoMotorista.map(v=>[
          (TIPO_VEICULO_LABEL[v.tipo]||v.tipo||'—').replace(/^[^\s]+\s/,''),
          v.placa||'—',
          v.modelo||'—',
        ]),
        theme: 'striped',
        headStyles: { fillColor:[243,112,33], textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
        bodyStyles: { fontSize:9 },
        margin: { left:14, right:14 },
      })
    }

    doc.setFontSize(8)
    doc.setTextColor(158,149,144)
    doc.text('Mills Pesados, Locação Serviços e Logística S.A. · Segurança para sonhar mais alto', 105, 287, { align:'center' })

    doc.save(`cartao_motorista_${(d.name||'motorista').replace(/\s+/g,'_').toLowerCase()}.pdf`)
  }
  const handleSave=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    try {
      await onSave(editing?{...form,id:editing}:form)
      setForm(blank);setEdit(null)
      addToast(editing?'Motorista atualizado!':'Motorista adicionado!','success')
    } catch (err) {
      console.error('Erro ao salvar motorista:', err)
      addToast('Erro ao salvar motorista. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }
  const handleEdit=d=>{setEdit(d.id);setForm({name:d.name,cnh:d.cnh||'',category:d.category||'',phone:d.phone||'',unit:d.unit||'',active:d.active!==false})}
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:680, maxHeight:'88vh', display:'flex', gap:20, boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 12px' }}>👤 Motoristas Cadastrados</h3>
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
            {drivers.length===0&&<div style={{ color:T.textMuted, fontFamily:FONT, fontSize:12, textAlign:'center', padding:'20px 0' }}>Nenhum motorista cadastrado.</div>}
            {drivers.map(d=>{
              const veiculosDoMotorista = veiculos.filter(v=>v.motoristaId===d.id)
              return (
              <div key={d.id} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, padding:'10px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:T.text }}>{d.name}</div>
                  <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{d.cnh&&`CNH: ${d.cnh} · `}{d.category&&`Cat. ${d.category} · `}{d.phone&&`📱 ${d.phone}`}</div>
                  <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted }}>{d.unit||'—'} {d.active===false?'· 🔴 Inativo':''}</div>
                  {veiculosDoMotorista.length>0&&(
                    <div style={{ fontFamily:FONT, fontSize:10, color:T.laranja, marginTop:2 }}>
                      {veiculosDoMotorista.map(v=>`${(TIPO_VEICULO_LABEL[v.tipo]||'📋').split(' ')[0]} ${v.placa}`).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>handleGerarCartao(d)} style={{ ...BS, background:T.verdeLight, color:T.verde, border:`1px solid ${T.verde}30`, fontSize:10, padding:'4px 10px' }}>🪪 Cartão</button>
                  {onRotograma&&<button onClick={()=>onRotograma(d)} style={{ ...BS, background:T.infoLight, color:T.info, border:`1px solid ${T.info}30`, fontSize:10, padding:'4px 10px' }}>🗺 Rotograma</button>}
                  <button onClick={()=>handleEdit(d)} style={{ ...BS, background:T.laranjaLight, color:T.laranja, border:`1px solid ${T.laranja}30`, fontSize:10, padding:'4px 10px' }}>✏️ Editar</button>
                  <button onClick={()=>setDeleting(d)} style={{ ...BS, background:T.perigoLight, color:T.perigo, border:`1px solid ${T.perigo}30`, fontSize:10, padding:'4px 10px' }}>🗑</button>
                </div>
              </div>
            )})}
          </div>
        </div>
        <div style={{ width:240, flexShrink:0 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 12px' }}>{editing?'✏️ Editar':'➕ Novo'} Motorista</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div><label style={LS}>Nome completo *</label><input value={form.name} onChange={e=>set('name',e.target.value)} style={IS} placeholder="Nome do motorista"/></div>
            <div><label style={LS}>CNH</label><input value={form.cnh} onChange={e=>set('cnh',e.target.value)} style={IS} placeholder="00000000000"/></div>
            <div><label style={LS}>Categoria CNH</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)} style={IS}>
                <option value="">—</option>
                {['A','B','C','D','E','AB','AC','AD','AE'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={LS}>Telefone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} style={IS} placeholder="(11) 99999-9999"/></div>
            <div><label style={LS}>Filial</label>
              <select value={form.unit} onChange={e=>set('unit',e.target.value)} style={IS}>
                <option value="">— selecione —</option>
                {FILIAIS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {editing&&(
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.rSm, padding:'6px 9px' }}>
                🚚 Veículo vinculado? Ajuste em "⋯ Mais → Veículos" — o vínculo fica no cadastro do veículo, não aqui.
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {editing&&<button onClick={()=>{setEdit(null);setForm(blank)}} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}`, fontSize:11 }}>Cancelar</button>}
              <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{ ...BS, flex:1, background:form.name.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, fontSize:11 }}>{saving?'⏳...':editing?'💾 Salvar':'➕ Adicionar'}</button>
            </div>
          </div>
          <div style={{ marginTop:16 }}><button onClick={onClose} style={{ ...BS, width:'100%', background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button></div>
        </div>
      </motion.div>
      {/* Achado de auditoria: onDelete(deleting.id) nem era esperado nem tinha
          catch — o toast "removido" aparecia mesmo quando a exclusão falhava
          de verdade (offline, permissão negada), deixando o motorista intacto
          no Firestore enquanto a tela dizia o contrário. Mesmo padrão de
          try/catch já usado em handleSave acima. */}
      <ConfirmModal open={!!deleting} danger title="Remover motorista"
        message={`Remover "${deleting?.name}"? Rotogramas já montados pra esse motorista ficam órfãos.`}
        confirmLabel="🗑 Remover"
        onConfirm={async()=>{
          try {
            await onDelete(deleting.id)
            addToast('Motorista removido.','success')
          } catch (err) {
            console.error('Erro ao remover motorista:', err)
            addToast('Erro ao remover motorista. Tente novamente.', 'error')
          } finally {
            setDeleting(null)
          }
        }}
        onCancel={()=>setDeleting(null)}/>
    </div>
  )
}
