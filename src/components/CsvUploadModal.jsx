// ============================================================
// CsvUploadModal — extraído de FrotasView.jsx (item 11 da revisão)
// Upload e diagnóstico da base SIM (CSV).
// ============================================================
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Papa from 'papaparse'
import { T, FONT, BS, IS } from '../lib/constants'
import { parseSIMCsv } from '../lib/utils'

export function CsvUploadModal({ onLoaded, onClose }) {
  const [status,  setStatus]  = useState('idle')
  const [count,   setCount]   = useState(0)
  const [preview, setPreview] = useState([])
  const [clients, setClients] = useState([])
  const [diagQ,   setDiagQ]   = useState('')
  const inputRef = useRef()

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        // CORRIGIDO: usa import ESM do Papa (não require/window._Papa)
        const clients = parseSIMCsv(ev.target.result, Papa)
        setCount(clients.length)
        setPreview(clients.slice(0,4))
        setClients(clients)
        // Antes chamava onLoaded (setDoc SEM merge, substitui a base SIM
        // inteira pra todos os usuários) direto aqui, assim que o parse
        // terminava — um arquivo errado (export antigo, aba errada, CSV
        // truncado) sobrescrevia a base de produção sem chance de conferir
        // antes. Agora só mostra a prévia/diagnóstico e espera confirmação
        // explícita (botão abaixo) antes de aplicar de verdade.
        setStatus('preview')
      } catch(err) {
        setStatus('error')
        console.error('CSV parse error:', err)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleConfirmar = () => {
    onLoaded(clients)
    setStatus('done')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:32, width:500, maxHeight:'85vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>📂 Atualizar Base SIM</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        {/* Colunas esperadas */}
        <div style={{ padding:'10px 13px', background:T.infoLight, borderRadius:T.rSm, border:`1px solid ${T.info}20`, marginBottom:16 }}>
          <div style={{ color:T.info, fontSize:11, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:4 }}>📋 Colunas lidas do CSV:</div>
          <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', lineHeight:1.6 }}>
            <strong>Cliente:</strong> "Planta/Obra"<br/>
            <strong>Frota:</strong> "N° Interno"<br/>
            <strong>Estado:</strong> "Estado (Planta/Obra)"<br/>
            <strong>Cidade:</strong> "Município (Planta/Obra)"<br/>
            Separador: ponto-e-vírgula (;) · Encoding: UTF-8
          </div>
        </div>


        <div style={{ padding:20, background:T.surfaceAlt, borderRadius:T.r, border:`2px dashed ${T.borderMid}`, textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📊</div>
          <p style={{ color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13, margin:'0 0 12px' }}>CSV exportado do SIM</p>
          <button onClick={()=>inputRef.current?.click()} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>Escolher arquivo</button>
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
        </div>

        {status==='loading' && <div style={{ textAlign:'center', color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13 }}>⏳ Processando...</div>}

        {status==='preview' && <>
          <div style={{ padding:'10px 14px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}40`, marginBottom:12 }}>
            <div style={{ color:'#B8860B', fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>📋 {count} registros lidos — ainda NÃO aplicado</div>
            <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Confira a prévia e a busca abaixo. Confirmar substitui a base SIM inteira pra todos os usuários — sem volta fácil.</div>
          </div>
          {preview.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Prévia (primeiros registros):</div>
              {preview.map(c => (
                <div key={c.name} style={{ padding:'6px 10px', background:T.surfaceAlt, borderRadius:T.rSm, marginBottom:4, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11 }}>
                  <span style={{ fontWeight:700, color:T.text }}>{c.name}</span>
                  <span style={{ color:T.textMuted }}> · {c.city||'—'}/{c.state||'—'}</span>
                  {c.nInternos?.length > 0 && <span style={{ color:T.info }}> · N°: {c.nInternos.slice(0,3).join(', ')}</span>}
                </div>
              ))}
            </div>
          )}
        </>}

        {status==='done' && (
          <div style={{ padding:'10px 14px', background:T.verdeLight, borderRadius:T.r, border:`1px solid ${T.verde}30`, marginBottom:12 }}>
            <div style={{ color:T.verde, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>✅ {count} registros aplicados!</div>
            <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Base sincronizada para todos os usuários.</div>
          </div>
        )}

        {status==='error' && <div style={{ padding:'10px 14px', background:T.perigoLight, borderRadius:T.r, marginBottom:12 }}>
          <div style={{ color:T.perigo, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>❌ Erro ao processar. Verifique o formato do arquivo.</div>
          <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:4 }}>Certifique-se que o arquivo usa ; como separador e encoding UTF-8.</div>
        </div>}

        {/* Busca de diagnóstico — verificar se cliente específico foi importado */}
        {(status==='preview' || status==='done') && clients.length>0 && (
          <div style={{ marginBottom:16 }}>
            <input value={diagQ} onChange={e=>setDiagQ(e.target.value)} placeholder="🔍 Verificar se cliente foi importado..."
              style={{ ...IS, fontSize:11 }}/>
            {diagQ.length>=2 && (
              <div style={{ marginTop:6 }}>
                {clients.filter(c=>c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(diagQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))).length===0
                  ? <div style={{ color:T.perigo, fontSize:11, fontFamily:FONT }}>❌ "{diagQ}" não encontrado na base importada</div>
                  : clients.filter(c=>c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(diagQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))).slice(0,5).map(m=><div key={m.name} style={{ color:T.sucesso, fontSize:11, fontFamily:FONT }}>✅ {m.name} · {m.nInternos?.length||0} frota(s)</div>)
                }
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ ...BS, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>
            {status==='preview' ? 'Cancelar' : 'Fechar'}
          </button>
          {status==='preview' && (
            <button onClick={handleConfirmar} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>
              ✅ Confirmar e aplicar
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
