import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, runDailyBackup } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell } from '../components/UI'
import { KPIView } from './KPIView'
import { T, FONT, CARD_TYPES, BS } from '../lib/constants'
import { detectConflicts, parseSIMCsv } from '../lib/utils'
import Papa from 'papaparse'

// ─── MODAL DE UPLOAD DE CSV ─────────────────────────────────────────────────
function CsvUploadModal({ onLoaded }) {
  const [status, setStatus] = useState('idle')
  const [count, setCount] = useState(0)

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const clients = parseSIMCsv(ev.target.result, Papa)
        setCount(clients.length)
        setStatus('done')
        onLoaded(clients)
      } catch (err) {
        console.error(err)
        setStatus('error')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2DDD6', padding: 24, maxWidth: 500 }}>
      <div style={{ ...BS, padding: 20, background: '#FAF8F5', borderRadius: 10, border: '2px dashed #CEC8C0', textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
        <p style={{ color: '#686258', fontFamily: FONT, margin: '0 0 12px' }}>CSV exportado do SIM • separador ; • UTF-8</p>
        <label style={{ ...BS, background: '#F37021', color: 'white', cursor: 'pointer', padding: '8px 16px', borderRadius: 6, display: 'inline-block' }}>
          Escolher arquivo
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>
      {status === 'loading' && <p style={{ fontFamily: FONT, color: '#F37021' }}>Processando linhas da planilha...</p>}
      {status === 'done' && <p style={{ fontFamily: FONT, color: '#2E7D32' }}>✅ {count} registros carregados! Primeiros 500 serão salvos por segurança.</p>}
      {status === 'error' && <p style={{ fontFamily: FONT, color: '#C62828' }}>❌ Erro ao ler o arquivo. Verifique a formatação.</p>}
    </div>
  )
}

// ─── VISÃO MASTER DA LOGÍSTICA (KANBAN PRINCIPAL) ───────────────────────────
export default function MasterView() {
  const { user } = useAuth()
  const { addToast, toasts, removeToast } = useToasts()
  const { cards, saveCard, moveCard, deleteCard } = useCards()
  const { requests, respondRequest } = useRequests()
  const { uploadClients } = useSimClients()

  // Controle de Abas e Estados
  const [activeTab, setActiveTab] = useState('kanban')
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0])
  const [showCsvModal, setShowCsvModal] = useState(false)
  
  // Estados para o controle do Modal de Reprogramação / Justificativa
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [pendingMove, setPendingMove] = useState(null)
  const [reasonText, setReasonText] = useState('')

  // Executa rotina de backup diário se houver cards e requests na tela
  useEffect(() => {
    if (cards.length > 0) {
      runDailyBackup(cards, requests)
    }
  }, [cards, requests])

  // Definição rígida das 5 colunas padrão da Mills solicitadas
  const LANES = [
    { id: 'solicitacoes', title: 'Solicitações' },
    { id: 'agendado', title: 'Agendado' },
    { id: 'em_transito', title: 'Em Trânsito' },
    { id: 'no_cliente', title: 'No Cliente' },
    { id: 'retornado', title: 'Retornado' }
  ]

  // Filtra os cards para exibir apenas os do dia selecionado no menu superior
  const cardsDoDia = cards.filter(c => c.startDate === currentDate)

  // Disparado quando o usuário solta o card em alguma coluna
  const handleDragEnd = (card, targetLaneId) => {
    // Se soltou na mesma coluna, não faz nada
    if (card.laneId === targetLaneId) return

    // REGRA DE OURO: Só pede justificativa se mudar a data ou se voltar o card para a coluna 'Agendado'
    if (targetLaneId === 'agendado') {
      setPendingMove({ card, targetLaneId, targetDate: currentDate })
      setReasonText('')
      setShowReasonModal(true)
    } else {
      // Movimentações normais de fluxo (Trânsito, Cliente, Retornado) salvam direto sem travar a tela
      moveCard(card.id, targetLaneId, user?.email, 'Avanço de status na linha do tempo')
    }
  }

  // Confirmar a alteração dentro do Modal de Justificativa
  const handleConfirmReprogramacao = async () => {
    if (!reasonText.trim()) {
      alert('Por favor, insira uma justificativa válida para a alteração.')
      return
    }

    try {
      const { card, targetLaneId, targetDate } = pendingMove

      // 1. Atualiza a coluna e o histórico de auditoria no Firestore
      await moveCard(card.id, targetLaneId, user?.email, reasonText)

      // 2. CORREÇÃO CRUCIAL: Atualiza e força o card a mudar de data de verdade na tela
      await saveCard({
        ...card,
        laneId: targetLaneId,
        startDate: targetDate
      })

      addToast({ type: 'success', title: 'Sucesso', text: 'Agendamento reprogramado com sucesso!' })
      setShowReasonModal(false)
      setPendingMove(null)
    } catch (err) {
      console.error(err)
      addToast({ type: 'conflict', title: 'Erro', text: 'Não foi possível mover o card.' })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFDFD', padding: '24px 40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <MillsLogo height={36} />
          <nav style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setActiveTab('kanban')} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: activeTab === 'kanban' ? '#F37021' : 'transparent', color: activeTab === 'kanban' ? 'white' : '#686258', fontWeight: 'bold', cursor: 'pointer' }}>Quadro Kanban</button>
            <button onClick={() => setActiveTab('kpis')} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: activeTab === 'kpis' ? '#F37021' : 'transparent', color: activeTab === 'kpis' ? 'white' : '#686258', fontWeight: 'bold', cursor: 'pointer' }}>Indicadores KPI</button>
            <button onClick={() => setShowCsvModal(true)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #E2DDD6', background: 'white', color: '#686258', cursor: 'pointer' }}>⚙️ Importar Clientes SIM</button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: FONT, color: '#686258' }}>Olá, <strong>{user?.email || 'Logística Mills'}</strong></span>
          <NotificationBell />
        </div>
      </header>

      {/* Seletor de Data Superior */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: FONT, color: '#686258', fontWeight: 'bold' }}>Filtrar Data de Operação:</span>
        <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E2DDD6', fontFamily: FONT }} />
      </div>

      {activeTab === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LANES.length}, minmax(240px, 1fr))`, gap: 16, alignItems: 'start' }}>
          {LANES.map(lane => (
            <div 
              key={lane.id} 
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const cardData = JSON.parse(e.dataTransfer.getData('application/json'))
                handleDragEnd(cardData, lane.id)
              }}
              style={{ background: '#F7F5F0', borderRadius: 12, padding: 16, minHeight: '60vh', border: '1px solid #EAE6DF' }}
            >
              <h3 style={{ fontFamily: FONT, color: '#4A453F', margin: '0 0 16px 0', borderBottom: '2px solid #E2DDD6', paddingBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{lane.title}</span>
                <span style={{ background: '#E2DDD6', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>
                  {lane.id === 'solicitacoes' ? requests.filter(r => r.status === 'pendente').length : cardsDoDia.filter(c => c.laneId === lane.id).length}
                </span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Renderização Especial da Coluna de Solicitações Recebidas da Frota */}
                {lane.id === 'solicitacoes' && requests.filter(r => r.status === 'pendente').map(req => (
                  <div key={req.id} style={{ background: 'white', padding: 14, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04)', borderLeft: '4px solid #F37021' }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontFamily: FONT }}>{req.client || 'Cliente não informado'}</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#686258' }}>Equipamento: {req.machine || '—'}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => respondRequest(req.id, 'aprovado')} style={{ background: '#2E7D32', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Aprovar</button>
                      <button onClick={() => respondRequest(req.id, 'rejeitado')} style={{ background: '#C62828', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Recusar</button>
                    </div>
                  </div>
                ))}

                {/* Renderização dos Cards Kanban operacionais da Mills */}
                {lane.id !== 'solicitacoes' && cardsDoDia.filter(c => c.laneId === lane.id).map(card => (
                  <div 
                    key={card.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify(card))}
                    style={{ background: 'white', padding: 14, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'grab', border: '1px solid #E2DDD6' }}
                  >
                    <div style={{ fontSize: 11, color: '#F37021', fontWeight: 'bold', marginBottom: 4 }}>{card.type || 'INTERNO'}</div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontFamily: FONT, fontSize: 14 }}>{card.client || '—'}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#686258' }}>🛠️ {card.machine || 'Sem máquina'}</p>
                    <p style={{ margin: '0 0 0 0', fontSize: 12, color: '#686258' }}>🚚 Motorista: {card.driver || 'Não atribuído'}</p>
                    {card.lastMoveReason && (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #E2DDD6', fontSize: 11, color: '#8C857B', fontStyle: 'italic' }}>
                        Justificativa: {card.lastMoveReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <KPIView />
      )}

      {/* MODAL COLOCO EM TELA PARA CAPTURAR A REPROGRAMAÇÃO */}
      {showReasonModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 450, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontFamily: FONT, margin: '0 0 12px 0', color: '#4A453F' }}>Motivo da Reprogramação</h3>
            <p style={{ fontFamily: FONT, color: '#686258', fontSize: 13, marginBottom: 16 }}>Identificamos uma alteração de prazo ou retorno de fluxo. Por favor, registre a justificativa operacional para o histórico da auditoria da Mills:</p>
            <textarea 
              value={reasonText} 
              onChange={e => setReasonText(e.target.value)}
              placeholder="Digite aqui detalhadamente o motivo..." 
              style={{ width: '100%', height: 100, padding: 10, borderRadius: 6, border: '1px solid #E2DDD6', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16, resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => { setShowReasonModal(false); setPendingMove(null); }} style={{ background: 'transparent', border: 'none', color: '#686258', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button onClick={handleConfirmReprogramacao} style={{ background: '#F37021', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Confirmar Alteração</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO UPLOAD DO EXCEL / SIM */}
      {showCsvModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, position: 'relative' }}>
            <button onClick={() => setShowCsvModal(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            <CsvUploadModal onLoaded={async (data) => {
              await uploadClients(data)
              addToast({ type: 'success', title: 'Sucesso', text: 'Planilha integrada com a nuvem!' })
            }} />
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
