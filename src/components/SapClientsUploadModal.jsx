// ============================================================
// SapClientsUploadModal — upload manual do cadastro de Clientes SAP
// (Código SAP, CNPJ, Cliente, UF), usado pelo painel de Solicitação de NF.
// Mesmo padrão de preview-antes-de-aplicar do CsvUploadModal (base SIM).
// ============================================================
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Papa from 'papaparse'
import { T, FONT, BS, IS } from '../lib/constants'
import { parseSapClientsCsv } from '../lib/utils'

export function SapClientsUploadModal({ onLoaded, onClose }) {
  const [status,  setStatus]  = useState('idle')
  const [count,   setCount]   = useState(0)
  const [preview, setPreview] = useState([])
  const [clients, setClients] = useState([])
  const inputRef = useRef()

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseSapClientsCsv(ev.target.result, Papa)
        setCount(parsed.length)
        setPreview(parsed.slice(0,4))
        setClients(parsed)
        setStatus('preview')
      } catch(err) {
        setStatus('error')
        console.error('CSV parse error (Clientes SAP):', err)
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
          <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:20, margin:0 }}>🏢 Atualizar Clientes SAP</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:'10px 13px', background:T.infoLight, borderRadius:T.rSm, border:`1px solid ${T.info}20`, marginBottom:16 }}>
          <div style={{ color:T.info, fontSize:11, fontWeight:700, fontFamily:'IBM Plex Sans,sans-serif', marginBottom:4 }}>📋 Colunas lidas do CSV:</div>
          <div style={{ color:T.textSec, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', lineHeight:1.6 }}>
            <strong>Código SAP:</strong> "Código SAP"<br/>
            <strong>CNPJ:</strong> "CNPJ"<br/>
            <strong>Cliente:</strong> "Cliente"<br/>
            <strong>UF:</strong> "UF" (ou "Regio")<br/>
            Separador: ponto-e-vírgula (;) · Encoding: UTF-8
          </div>
        </div>

        <div style={{ padding:20, background:T.surfaceAlt, borderRadius:T.r, border:`2px dashed ${T.borderMid}`, textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🏢</div>
          <p style={{ color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13, margin:'0 0 12px' }}>CSV exportado do SAP</p>
          <button onClick={()=>inputRef.current?.click()} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700 }}>Escolher arquivo</button>
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
        </div>

        {status==='loading' && <div style={{ textAlign:'center', color:T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontSize:13 }}>⏳ Processando...</div>}

        {status==='preview' && <>
          <div style={{ padding:'10px 14px', background:T.amareloLight, borderRadius:T.r, border:`1px solid ${T.amarelo}40`, marginBottom:12 }}>
            <div style={{ color:'#B8860B', fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>📋 {count} clientes lidos — ainda NÃO aplicado</div>
            <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Confirmar substitui o cadastro inteiro pra todos os usuários — sem volta fácil.</div>
          </div>
          {preview.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:T.textMuted, fontSize:10, fontFamily:'IBM Plex Sans,sans-serif', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Prévia (primeiros registros):</div>
              {preview.map((c,i) => (
                <div key={i} style={{ padding:'6px 10px', background:T.surfaceAlt, borderRadius:T.rSm, marginBottom:4, fontFamily:'IBM Plex Sans,sans-serif', fontSize:11 }}>
                  <span style={{ fontWeight:700, color:T.text }}>{c.nome||'—'}</span>
                  <span style={{ color:T.textMuted }}> · {c.uf||'—'} · CNPJ {c.cnpj||'—'}</span>
                  {c.codigoSap && <span style={{ color:T.info }}> · SAP {c.codigoSap}</span>}
                </div>
              ))}
            </div>
          )}
        </>}

        {status==='done' && (
          <div style={{ padding:'10px 14px', background:T.verdeLight, borderRadius:T.r, border:`1px solid ${T.verde}30`, marginBottom:12 }}>
            <div style={{ color:T.verde, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>✅ {count} clientes aplicados!</div>
            <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:3 }}>Cadastro sincronizado para todos os usuários.</div>
          </div>
        )}

        {status==='error' && <div style={{ padding:'10px 14px', background:T.perigoLight, borderRadius:T.r, marginBottom:12 }}>
          <div style={{ color:T.perigo, fontWeight:700, fontSize:13, fontFamily:'IBM Plex Sans,sans-serif' }}>❌ Erro ao processar. Verifique o formato do arquivo.</div>
          <div style={{ color:T.textSec, fontSize:11, fontFamily:'IBM Plex Sans,sans-serif', marginTop:4 }}>Certifique-se que o arquivo usa ; como separador e encoding UTF-8.</div>
        </div>}

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
