// ============================================================
// DiagnosticoModal — diagnóstico de N° interno (Grupo de Modelo/Fabricante+
// Modelo x tabelas de referência). Autoatendimento pra Frotas/Master
// investigarem por que uma máquina caiu como "não reconhecida" (ou pegou
// dimensão errada) sem precisar levantar CSV/código toda vez. Usa os
// simClients já carregados em memória (mesma base usada no cálculo real).
// ============================================================
import { useState } from 'react'
import { motion } from 'framer-motion'
import { T, FONT, BS, IS, LS } from '../lib/constants'
import { diagnosticarNInterno, auditarUFsSimClients } from '../lib/freteCalc'
import { buildFrotaIndex } from '../lib/utils'

function Linha({ label, children }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'6px 0', borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontFamily:FONT, fontSize:11, color:T.textMuted }}>{label}</span>
      <span style={{ fontFamily:FONT, fontSize:12, color:T.text, fontWeight:600, textAlign:'right' }}>{children}</span>
    </div>
  )
}

function Selo({ ok, textoOk, textoFalha }) {
  return ok
    ? <span style={{ color:T.verde }}>✅ {textoOk}</span>
    : <span style={{ color:T.perigo }}>❌ {textoFalha}</span>
}

export function DiagnosticoModal({ simClients, onClose }) {
  const [busca, setBusca] = useState('')
  const [diag, setDiag] = useState(null)
  // Varredura em lote de Estado x cidade (IBGE) pra toda a base SIM — caso
  // real (2026-08): Planta/Obra "CMAA - Canápolis" cadastrada com Estado=BA
  // (Canápolis é MG) mandou motorista pra rota errada. Os avisos pontuais
  // (RequestForm/RequestReviewModal/AssignDriverModal) só pegam esse erro
  // quando alguém abre justamente aquela solicitação — isto aqui varre TODA
  // a base de uma vez, pra achar toda Planta/Obra com Estado errado antes
  // que vire um card.
  const [auditoria, setAuditoria] = useState(null)
  const [auditando, setAuditando] = useState(false)

  const handleBuscar = () => {
    if (!busca.trim()) { setDiag(null); return }
    setDiag(diagnosticarNInterno(busca, simClients))
  }

  const handleAuditar = async () => {
    setAuditando(true)
    setAuditoria(await auditarUFsSimClients(simClients))
    setAuditando(false)
  }

  const r = diag?.resultado
  // Horímetro/Valor/Série — mesmo índice (buildFrotaIndex) que o painel de
  // Solicitação de NF usa pra autopreencher o formulário. Mostrar aqui
  // ajuda a responder "por que não autopreencheu": ou o CSV não tem essas
  // colunas pra essa frota, ou o N° interno não bate exato com o índice.
  const frotaInfo = diag?.encontrado ? buildFrotaIndex(simClients).get(diag.nInterno) : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:28, width:520, maxHeight:'88vh', overflowY:'auto', boxShadow:T.shadowLg, border:`1px solid ${T.border}` }}>
        <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:16, margin:'0 0 4px' }}>🔍 Diagnosticar Equipamento</h3>
        <p style={{ color:T.textMuted, fontFamily:FONT, fontSize:11, margin:'0 0 16px' }}>
          Digite o N° interno pra ver exatamente o que o sistema capturou da base SIM ({simClients?.length||0} clientes carregados) e por que bateu (ou não) com as tabelas de dimensão/peso.
        </p>

        <div style={{ marginBottom:18, padding:'12px 14px', background:T.surfaceAlt, borderRadius:T.r, border:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text }}>🗺️ Auditar Estado x Cidade de todos os clientes</div>
              <div style={{ fontFamily:FONT, fontSize:10, color:T.textMuted, marginTop:2 }}>Confere a base inteira contra o IBGE de uma vez — acha Planta/Obra com Estado errado no CSV antes que vire um card com rota errada.</div>
            </div>
            <button onClick={handleAuditar} disabled={auditando}
              style={{ ...BS, background:auditando?T.borderMid:T.laranja, color:'white', fontWeight:700, fontSize:11, padding:'7px 14px', whiteSpace:'nowrap' }}>
              {auditando ? '⏳ Auditando...' : '🔍 Auditar agora'}
            </button>
          </div>
          {auditoria && !auditoria.ok && (
            <div style={{ marginTop:10, color:T.perigo, fontFamily:FONT, fontSize:11 }}>❌ Não foi possível consultar o IBGE agora. Tente de novo em instantes.</div>
          )}
          {auditoria?.ok && auditoria.divergencias.length === 0 && (
            <div style={{ marginTop:10, color:T.verde, fontFamily:FONT, fontSize:11, fontWeight:700 }}>✅ Nenhuma divergência encontrada — Estado de todas as Plantas/Obras bate com a cidade cadastrada.</div>
          )}
          {auditoria?.ok && auditoria.divergencias.length > 0 && (
            <div style={{ marginTop:10 }}>
              <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:11, marginBottom:6 }}>⚠️ {auditoria.divergencias.length} Planta(s)/Obra(s) com Estado divergente:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:180, overflowY:'auto' }}>
                {auditoria.divergencias.map((d,i) => (
                  <div key={i} style={{ padding:'6px 9px', background:T.perigoLight, borderRadius:T.rSm, fontFamily:FONT, fontSize:11 }}>
                    <strong style={{ color:T.text }}>{d.cliente}</strong>
                    <span style={{ color:T.perigo }}> — {d.cidade} cadastrada como {d.ufCadastrada}, correto é {d.ufReal}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, color:T.textMuted, fontFamily:FONT, fontSize:10, lineHeight:1.5 }}>
                Corrija a coluna "Estado (Planta/Obra)" pra essas linhas no CSV do SIM e suba a base atualizada — o app só repete o que a base diz.
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input value={busca} onChange={e=>setBusca(e.target.value)}
            onKeyDown={e=>e.key==='Enter' && handleBuscar()}
            style={{ ...IS, flex:1 }} placeholder="Ex: PCP01168" autoFocus/>
          <button onClick={handleBuscar} disabled={!busca.trim()}
            style={{ ...BS, background:busca.trim()?T.laranja:T.borderMid, color:'white', fontWeight:700, fontSize:11, padding:'8px 16px' }}>Buscar</button>
        </div>

        {diag && !diag.encontrado && (
          <div style={{ background:T.perigoLight, border:`1px solid ${T.perigo}30`, borderRadius:T.r, padding:12, color:T.perigo, fontFamily:FONT, fontSize:12 }}>
            ❌ N° interno <b>{diag.nInterno}</b> não foi encontrado em nenhum cliente da base SIM carregada. Confira se o CSV foi atualizado recentemente ou se o número foi digitado corretamente.
          </div>
        )}

        {diag && diag.encontrado && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text, marginBottom:6 }}>📋 Captura do CSV</div>
              <Linha label="Cliente/Planta">{diag.cliente}</Linha>
              <Linha label="Tipo de match">{diag.tipoMatch==='exato' ? 'Exato' : 'Numérico (fallback)'}</Linha>
              {diag.semDadosDeModelo ? (
                <Linha label="Fabricante/Modelo/Grupo"><Selo ok={false} textoFalha="ausentes no CSV pra esse N° interno"/></Linha>
              ) : (
                <>
                  <Linha label="Fabricante (raw)">{diag.fabricanteRaw || '—'}</Linha>
                  <Linha label="Modelo (raw)">{diag.modeloRaw || '—'}</Linha>
                  <Linha label="Grupo de Modelo (raw)">{diag.grupoModeloRaw || '—'}</Linha>
                </>
              )}
            </div>

            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text, marginBottom:6 }}>📄 Dados pro autopreenchimento da Solicitação de NF</div>
              {diag.tipoMatch!=='exato' ? (
                <div style={{ color:T.perigo, fontFamily:FONT, fontSize:11, padding:'6px 0' }}>
                  ⚠️ Match só numérico (fallback) — o autopreenchimento da NF exige N° interno idêntico ao do CSV, então não funciona nesse caso.
                </div>
              ) : (
                <>
                  <Linha label="Horímetro"><Selo ok={!!frotaInfo?.horimetro} textoOk={frotaInfo?.horimetro} textoFalha="não veio no CSV pra essa frota"/></Linha>
                  <Linha label="Valor de aquisição"><Selo ok={!!frotaInfo?.valor} textoOk={frotaInfo?.valor} textoFalha="não veio no CSV pra essa frota"/></Linha>
                  <Linha label="Nº de série"><Selo ok={!!frotaInfo?.serie} textoOk={frotaInfo?.serie} textoFalha="não veio no CSV pra essa frota"/></Linha>
                  {!frotaInfo?.horimetro && !frotaInfo?.valor && (
                    <div style={{ marginTop:8, color:T.textMuted, fontFamily:FONT, fontSize:10, lineHeight:1.5 }}>
                      Se nenhuma frota tem esses dados, o export atual do SIM provavelmente não inclui as colunas "Horímetro"/"Valor de aquisição" — precisa confirmar com quem gera o CSV se dá pra incluí-las.
                    </div>
                  )}
                </>
              )}
            </div>

            {!diag.semDadosDeModelo && (
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text, marginBottom:6 }}>🎯 Match Fabricante+Modelo (dimensão exata)</div>
                <Linha label="Chave normalizada">{diag.chaveFabricanteModelo || '—'}</Linha>
                <Linha label="Em DIMENSOES_MODELO">
                  <Selo ok={!!diag.dimensaoModeloExata} textoOk="catalogado" textoFalha="não catalogado"/>
                </Linha>
                {diag.dimensaoModeloExata && (
                  <Linha label="Peso/Larg/Comp">{diag.dimensaoModeloExata.peso}t · {diag.dimensaoModeloExata.largura}m · {diag.dimensaoModeloExata.comprimento}m</Linha>
                )}
                {!diag.dimensaoModeloExata && diag.dimensaoPorModeloApenas && (
                  <Linha label="Match só por Modelo">{diag.dimensaoPorModeloApenas.chave}</Linha>
                )}

                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text, margin:'12px 0 6px' }}>⚖️ Match Grupo de Modelo (faixa de peso)</div>
                <Linha label="Em PESO_GRUPO">
                  {diag.grupoModeloRaw
                    ? <Selo ok={diag.grupoModeloExisteEmPesoGrupo} textoOk="catalogado" textoFalha="não catalogado"/>
                    : '— (Grupo de Modelo vazio no CSV)'}
                </Linha>
              </div>
            )}

            <div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:T.text, marginBottom:6 }}>✅ Resultado final da cascata</div>
              <Linha label="Fonte usada">
                {{ modelo:'Modelo exato', grupo:'Grupo de Modelo', empilhadeira:'Empilhadeira (parse direto)', fallback:'⚠️ Fallback conservador (não reconhecida)' }[r?.fonte] || r?.fonte}
              </Linha>
              <Linha label="Peso / Largura / Comprimento">{r?.peso}t · {r?.largura}m · {r?.comprimento}m</Linha>
              {r?.fonte === 'fallback' && (
                <div style={{ marginTop:8, background:T.perigoLight, border:`1px solid ${T.perigo}30`, borderRadius:T.r, padding:10, color:T.perigo, fontFamily:FONT, fontSize:11 }}>
                  Essa é a origem do aviso "máquina não reconhecida" — o sistema não achou nem o Fabricante+Modelo nem o Grupo de Modelo catalogados, e usou um peso conservador (10,5t) só pra não travar a tela. Pra corrigir, é preciso catalogar essa chave/grupo no código (freteCalc.js).
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop:20 }}><button onClick={onClose} style={{ ...BS, width:'100%', background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button></div>
      </motion.div>
    </div>
  )
}
