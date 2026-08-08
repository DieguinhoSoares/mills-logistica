import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth }        from '../contexts/AuthContext'
import { useCards, useRequests, useNotifications, useSimClients, useConfig, useDrivers, useAllRotogramas, notifyUser } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, BrazilMap, NotificationBell, ConfirmModal } from '../components/UI'
import { T, FONT, CARD_TYPES, MONTH_NAMES, BS, IS, NB, SUBTYPES_NF, SHADOW_CARD, BORDER_SUBTLE } from '../lib/constants'
import { fmt, todayStr, getWeekDays, detectConflicts, getSubtypeLabel, findRelatedPendingRequest, sortByUrgency, sendTeamsNotification } from '../lib/utils'
import { db } from '../lib/firebase'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { ExportModal }      from '../components/ExportModal'
import { RequestForm }       from '../components/RequestForm'
import { RotogramaModal }    from '../components/RotogramaModal'
import { SettingsModal }     from '../components/SettingsModal'
import { DriversModal }      from '../components/DriversModal'
import { AssignDriverModal } from '../components/AssignDriverModal'
import { RequestsKanban }    from '../components/RequestsKanban'
import { CsvUploadModal }    from '../components/CsvUploadModal'
import { DiagnosticoModal }  from '../components/DiagnosticoModal'
import { WeekView, MonthView, YearView } from '../components/CalendarViews'

/* ══ MAIN FROTAS VIEW ════════════════════════════════════════════════════════ */
// Modais e sub-views extraídos para src/components/ (item 11 da revisão):
// RotogramaModal · SettingsModal · DriversModal · AssignDriverModal
// RequestsKanban · CsvUploadModal · CalendarViews (Week/Month/Year)
// Modal de validação — antes era um cartãozinho apertado dentro do painel
// lateral, sem espaço pra mostrar a foto que o motorista enviou nem pra
// deixar claro qual serviço está sendo encerrado. Agora abre em destaque,
// com a foto em tamanho real, a nota completa (sem cortar em 50 caracteres),
// e trava o botão durante o salvamento (fix de um bug real: clique duplo
// aqui disparava a notificação de conclusão duas vezes pro solicitante).
function ValidacaoModal({ card, nfInput, onNfInputChange, onConfirmarNF, onValidar, onClose }) {
  const [saving, setSaving] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(false)
  const precisaNF = SUBTYPES_NF.includes(card.subtype) && !card.nfConfirmada
  // "Validar e Encerrar" só faz sentido pra card que o motorista já concluiu de
  // verdade (aguardando_validacao). Abrir esse popup pra só confirmar NF de um
  // serviço ainda em andamento (ex.: "confirmado") não pode expor esse botão —
  // clicar nele marcaria o serviço como concluído antes da hora, tirando ele
  // da agenda ativa sem o serviço ter realmente acontecido.
  const podeEncerrar = card.status === 'aguardando_validacao'

  const handleValidar = async () => {
    setSaving(true)
    await onValidar(card)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.6)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:20 }}
      onClick={e=>e.target===e.currentTarget && !saving && onClose()}>
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        style={{ background:T.surface, borderRadius:T.rLg, padding:26, width:560, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:T.shadowLg, border:`2px solid ${T.verde}` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
          <h3 style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:18, margin:0 }}>✅ Validar Serviço</h3>
          <button onClick={onClose} disabled={saving} style={{ background:'none', border:'none', color:T.textMuted, fontSize:22, cursor:saving?'default':'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Identificação clara de QUAL serviço está sendo finalizado */}
        <div style={{ background:T.surfaceAlt, borderRadius:T.r, padding:'12px 14px', margin:'14px 0' }}>
          <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:15, marginBottom:4 }}>{card.client||'—'}</div>
          <div style={{ color:T.textSec, fontFamily:FONT, fontSize:12, marginBottom:2 }}>{getSubtypeLabelSafe(card)}</div>
          <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:11 }}>
            🗺 {card.originCity||card.origin||'—'} → {card.destCity||card.destination||'—'} &nbsp;·&nbsp;
            🔧 {card.nInterno||'—'} &nbsp;·&nbsp;
            👤 {card.driver||'—'} &nbsp;·&nbsp;
            📅 {fmt(card.startDate)}
          </div>
        </div>

        {/* Foto enviada pelo motorista — antes não aparecia em lugar nenhum */}
        {card.conclusaoFoto ? (
          <div style={{ marginBottom:14 }}>
            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>📷 Foto enviada pelo motorista</div>
            <img src={card.conclusaoFoto} alt="Comprovante do serviço"
              onClick={()=>setFotoAmpliada(true)}
              style={{ width:'100%', maxHeight:320, objectFit:'contain', borderRadius:T.r, border:`1px solid ${T.border}`, cursor:'zoom-in', background:T.surfaceLow }}/>
          </div>
        ) : (
          <div style={{ marginBottom:14, padding:'10px 12px', background:T.perigoLight, borderRadius:T.rSm, color:T.perigo, fontFamily:FONT, fontSize:11, fontWeight:700 }}>
            ⚠️ Nenhuma foto foi enviada pelo motorista neste serviço.
          </div>
        )}

        {card.conclusaoNota && (
          <div style={{ marginBottom:14 }}>
            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>📝 Observação do motorista</div>
            <div style={{ color:T.textSec, fontFamily:FONT, fontSize:13, fontStyle:'italic', padding:'8px 10px', background:'rgba(0,64,66,.06)', borderRadius:T.rSm }}>"{card.conclusaoNota}"</div>
          </div>
        )}

        {precisaNF ? (
          <div style={{ marginBottom:14, padding:'12px 14px', background:T.perigoLight, borderRadius:T.r, border:`1px solid ${T.perigo}30` }}>
            <div style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:12, marginBottom:8 }}>📄 Confirme a NF antes de validar</div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={nfInput||''} onChange={e=>onNfInputChange(e.target.value)}
                placeholder="Nº da NF..." style={{ ...IS, fontSize:12 }}/>
              <button onClick={onConfirmarNF}
                style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:12, whiteSpace:'nowrap' }}>
                Confirmar NF
              </button>
            </div>
          </div>
        ) : (card.numeroNF && (
          <div style={{ marginBottom:14, color:T.verde, fontSize:12, fontFamily:FONT, fontWeight:700 }}>📄 NF {card.numeroNF} confirmada</div>
        ))}

        {!podeEncerrar && (
          <div style={{ marginBottom:14, padding:'10px 12px', background:T.infoLight, borderRadius:T.r, color:T.info, fontFamily:FONT, fontSize:11, fontWeight:600 }}>
            ℹ️ Este serviço ainda não foi concluído pelo motorista — aqui você só confirma a NF. A opção de encerrar aparece quando o serviço estiver "aguardando validação".
          </div>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} disabled={saving} style={{ ...BS, flex:1, background:T.surfaceAlt, color:T.textSec, border:`1px solid ${T.border}` }}>Fechar</button>
          {podeEncerrar && (
            <button onClick={handleValidar} disabled={precisaNF||saving}
              style={{ ...BS, flex:2, background:(precisaNF||saving)?T.textMuted:T.verde, color:'white', fontWeight:700, cursor:(precisaNF||saving)?'not-allowed':'pointer', opacity:(precisaNF||saving)?0.6:1 }}>
              {saving ? '⏳ Validando...' : '✅ Validar e Encerrar Serviço'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Foto em tela cheia, ao clicar */}
      {fotoAmpliada && card.conclusaoFoto && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}
          onClick={()=>setFotoAmpliada(false)}>
          <img src={card.conclusaoFoto} alt="Comprovante ampliado" style={{ maxWidth:'92vw', maxHeight:'92vh', objectFit:'contain' }}/>
        </div>
      )}
    </div>
  )
}

function getSubtypeLabelSafe(card) {
  try { return getSubtypeLabel(card.type, card.subtype) } catch { return '' }
}

export function FrotasView() {
  const { profile, logout }              = useAuth()
  const { cards, saveCard, deleteCard, moveCard } = useCards()
  const { requests, respondRequest }     = useRequests('frotas')
  const { simClients, uploadClients }    = useSimClients()
  const { config, saveConfig }           = useConfig()
  const { notifications, unreadCount, markAllRead, markRead, deleteNotification, enablePush, disablePush } = useNotifications()
  const { toasts, add: addToast, dismiss } = useToasts()
  const { drivers, saveDriver, deleteDriver } = useDrivers()
  const { rotogramas } = useAllRotogramas()

  const [activeTab,    setActiveTab]    = useState('agenda')
  const [view,         setView]         = useState('semana')
  // Toggle Compacto/Padrão do calendário — cards menores (mais serviços
  // visíveis de uma vez) vs. detalhados (340px/linha, mais fácil de ler
  // cada serviço sem precisar rolar dentro do dia).
  const [calCompact,   setCalCompact]   = useState(false)
  // Recolher/expandir calendário — troca a grade semanal completa por uma
  // barra compacta ("Calendário recolhido — N serviços"), pra abrir espaço
  // pra Central de Ações quando o time só quer ver a fila de pendências.
  // Estado local, não persiste entre sessões.
  const [calendarCollapsed, setCalendarCollapsed] = useState(false)
  // Painel "Central de Ações" — resume validação/NF/atribuição/solicitações
  // (hoje espalhados em badges soltos) numa lista única priorizada. "Expandir"
  // abre um overlay com a lista completa; cada item resolve reaproveitando os
  // fluxos que já existem (abas Resumo/Solicitações/Validação, modais atuais).
  const [centralExpanded, setCentralExpanded] = useState(false)
  // Índice do ticker "Em destaque agora" do card "Ao vivo" (coluna lateral) —
  // alterna a cada 3.5s. Reinicia se a lista mudar de tamanho (evita apontar
  // pra um item que não existe mais depois de uma edição).
  const [destaqueIdx, setDestaqueIdx] = useState(0)
  const [busca,        setBusca]        = useState('')
  const buscaResultados = useMemo(() => {
    if (!busca.trim()) return []
    const normQ = busca.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const normS = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    return cards.filter(c =>
      String(c.seqId||'').includes(normQ) ||
      normS(c.nInterno).includes(normQ) ||
      normS(c.client).includes(normQ) ||
      normS(c.clientName).includes(normQ) ||
      (c.nInternos||[]).some(n=>normS(n).includes(normQ))
    ).filter(c=>c.status!=='cancelado').slice(0,8)
  }, [busca, cards])
  const [baseDate,     setBaseDate]     = useState(todayStr())
  const [yr,           setYr]           = useState(new Date().getFullYear())
  const [mo,           setMo]           = useState(new Date().getMonth())
  const [modal,        setModal]        = useState(null)
  const [editCard,     setEditCard]     = useState(null)
  const [defaultDate,  setDefaultDate]  = useState(null)
  const [exportModal,  setExportModal]  = useState(false)
  const [csvModal,     setCsvModal]     = useState(false)
  const [maisOpen,     setMaisOpen]     = useState(false)
  const [painelTab,    setPainelTab]    = useState('resumo')
  const [settingsModal, setSettingsModal] = useState(false)
  const [driversModal,  setDriversModal]  = useState(false)
  const [diagnosticoModal, setDiagnosticoModal] = useState(false)
  const [assignModal,   setAssignModal]   = useState(null)
  const [rotogramaModal,setRotogramaModal]= useState(null)
  const [pendingCardForm, setPendingCardForm] = useState(null)
  const [mapModal,     setMapModal]     = useState(false)
  const [confirmarConclusao, setConfirmarConclusao] = useState(null) // card sem app aguardando confirmação
  // Número da NF, digitado pelo analista antes de confirmar a emissão —
  // hoje só existia o booleano nfConfirmada (histórico de auditoria de que
  // "alguém confirmou"), sem guardar o número em si. Necessário pro
  // relatório de emissão de carbono, que precisa citar a NF de cada serviço.
  const [nfInputs, setNfInputs] = useState({})
  const [reviewValidacao, setReviewValidacao] = useState(null)
  const handleConfirmarNF = async (card) => {
    const numero = (nfInputs[card.id] || '').trim()
    if (!numero) { addToast('Digite o número da NF antes de confirmar.', 'error'); return }
    try {
      await saveCard({ ...card, numeroNF:numero, nfConfirmada:true, nfConfirmadaPor:profile?.name||'Frotas', nfConfirmadaEm:new Date().toISOString() })
      addToast('✅ NF confirmada!', 'success')
    } catch (err) {
      console.error('Erro ao confirmar NF:', err)
      addToast('Erro ao confirmar NF. Tente novamente.', 'error')
    }
  }
  const [rodapeSlide,  setRodapeSlide]  = useState(0) // 0 = ticker "em destaque", 1 = serviços de hoje (card "Ao vivo")

  const hoje      = todayStr()
  const atrasados = cards.filter(c=>c.endDate&&c.endDate<hoje&&!['concluido','cancelado'].includes(c.status))
  const conflicts = useMemo(() => detectConflicts(cards), [cards])
  const weekDays  = getWeekDays(baseDate)
  const pending   = requests.filter(r=>r.status==='pendente').length

  const navWeek  = d => { const x=new Date(baseDate); x.setDate(x.getDate()+d*7); setBaseDate(x.toISOString().split('T')[0]) }
  const navMonth = d => { let m=mo+d,y=yr; if(m<0){m=11;y--;}if(m>11){m=0;y++;} setMo(m);setYr(y) }

  const handleSaveCard = async f => {
    // Nota: a verificação de NF pendente existe APENAS no handleValidarCard (fechamento do serviço).
    // Update de dados do card é sempre permitido independente do status da NF.
    const mapped = {
      ...f,
      id:          editCard?.id   || f.id,           // preserva ID para update
      // Reatribuição de motorista/transportadora feita no próprio formulário de edição
      driver:      f.transportadoraNome || f.driverName || f.driver || editCard?.driver || '',
      driverId:    f.transportadoraNome ? '' : (f.driverId !== undefined ? f.driverId : editCard?.driverId || ''),
      client:          f.clientName || f.client || '',
      plantaObra:      f.clientName || f.plantaObra || '',
      // Mesma correção do fluxo de solicitação (SolicitanteView): "machine" só
      // vinha de nInternosReserva (equipamento reserva), caindo num f.machine
      // que nenhum campo do formulário preenche — cards criados direto pela
      // Frotas (fora do fluxo de solicitação) ficavam sempre com "Máquina"
      // em branco na tela do motorista, mesmo tipos de serviço com máquina só.
      machine:         f.nInternosReserva?.length ? f.nInternosReserva.join(', ') : (f.nInterno || f.machine || editCard?.machine || ''),
      // Preservar estado de confirmação de NF — não apagar ao editar
      nfConfirmada:    f.nfConfirmada    ?? editCard?.nfConfirmada    ?? false,
      nfConfirmadaPor: f.nfConfirmadaPor ?? editCard?.nfConfirmadaPor ?? '',
      nfConfirmadaEm:  f.nfConfirmadaEm  ?? editCard?.nfConfirmadaEm  ?? null,
      origin:      f.originCity?.s || f.origin || editCard?.origin || '',
      destination: f.destCity?.s   || f.destination || editCard?.destination || '',
      originCity:  f.originCity?.m || f.originCity || '',
      destCity:    f.destCity?.m   || f.destCity || '',
      startDate:   f.desiredDate    || f.startDate || '',
      endDate:     f.desiredDateEnd || f.desiredDate || f.endDate || '',
      // Cards criados direto (não vindos de solicitação aprovada) nunca
      // recebiam `unit` — ficavam invisíveis no gráfico "Por filial de
      // origem" do KPIView, sem ninguém perceber, já que não dava erro
      // nenhum, só sumia da estatística.
      unit:        f.unit || editCard?.unit || profile?.unit || '',
    }
    setModal(null); setEditCard(null)
    // Antes só passava pela tela de estimativa (AssignDriverModal, que é
    // onde veiculoId/km são calculados) quando era um card NOVO. Um card
    // salvo "sem motorista" (Cancelar no modal) e editado meses depois pra
    // finalmente atribuir um motorista nunca passava por aqui de novo — o
    // veículo/km ficavam pra sempre vazios, mesmo com motorista definido.
    // Agora qualquer card SEM veículo cadastrado passa pela estimativa,
    // seja novo ou uma edição antiga — fecha o gap na origem, não só via
    // migração retroativa.
    // Antes checava `mapped.veiculoId` — mas o formulário de edição nunca
    // carrega nem devolve esse campo (RequestForm não lida com veiculoId em
    // nenhuma direção), então essa condição era SEMPRE verdadeira, forçando
    // toda edição de card a passar pela tela de estimativa de novo — mesmo
    // um card que já tinha veículo/frete calculados há meses. Risco real:
    // a reestimativa não lembra de nenhuma escolha manual anterior, podendo
    // substituir silenciosamente um valor correto por um recalculado, só
    // porque alguém editou uma observação. Agora checa o CARD que já existe
    // no banco (editCard) — só força a estimativa quando o card de verdade
    // ainda não tem veículo definido, seja ele novo ou uma edição antiga.
    if (!editCard?.veiculoId) {
      setPendingCardForm(mapped)
    } else {
      // Já tem veículo/km calculados — edição normal, sem repetir a estimativa
      try {
        await saveCard(mapped)
        addToast(`Serviço de ${mapped.client||'novo'} atualizado.`, 'success')
      } catch (err) {
        console.error('Erro ao salvar serviço:', err)
        addToast('Erro ao salvar. Tente novamente.', 'error')
      }
    }
  }

  const handleCardDriverConfirm = async ({ driverId, driverName, transportadoraNome, transportadoraCnpj, date, note, veiculoId, veiculoLabel, freteEstimado, freteSugerido, km }) => {
    const motorista = driverName || transportadoraNome || ''
    // Preserva a duração (em dias) já definida no serviço — se Frotas mudar a data de início
    // ao atribuir o motorista, a data fim acompanha mantendo o mesmo número de dias.
    const spanMs = pendingCardForm.endDate && pendingCardForm.startDate
      ? new Date(pendingCardForm.endDate) - new Date(pendingCardForm.startDate)
      : 0
    const newStart = date || pendingCardForm.startDate
    const newEnd   = date
      ? new Date(new Date(date).getTime() + spanMs).toISOString().split('T')[0]
      : pendingCardForm.endDate
    const finalCard = {
      ...pendingCardForm,
      driver:              motorista,
      driverId:            driverId || '',
      transportadoraNome:  transportadoraNome || '',
      transportadoraCnpj:  transportadoraCnpj || '',
      startDate:           newStart,
      endDate:             newEnd,
      status:              'confirmado',
      notes:               [pendingCardForm.description, note].filter(Boolean).join(' — '),
      veiculoId:veiculoId||'', veiculoLabel:veiculoLabel||'',
      freteEstimado:freteEstimado??null, freteSugerido:!!freteSugerido, km:km??null,
    }
    try {
      await saveCard(finalCard)
      setPendingCardForm(null)
      addToast(`✅ Serviço de ${finalCard.client||'novo'} criado${motorista ? ` — atribuído a ${motorista}` : ''}.`, 'accepted')
    } catch (err) {
      console.error('Erro ao criar serviço:', err)
      addToast(`Erro ao criar serviço: ${err.message || 'tente novamente.'}`, 'error')
    }
  }

  const handleCardDriverCancel = async () => {
    // Salva o card sem motorista e fecha
    try {
      await saveCard(pendingCardForm)
      setPendingCardForm(null)
      addToast(`Serviço de ${pendingCardForm.client||'novo'} salvo sem motorista.`, 'success')
    } catch (err) {
      console.error('Erro ao salvar serviço sem motorista:', err)
      addToast('Erro ao salvar. Tente novamente.', 'error')
    }
  }
  const handleDeleteCard = async id => {
    try {
      await deleteCard(id); setModal(null); setEditCard(null)
      addToast('Serviço removido.', 'info')
    } catch (err) {
      console.error('Erro ao remover serviço:', err)
      addToast('Erro ao remover. Tente novamente.', 'error')
    }
  }
  const handleMoveCard = async (id, ns, ne, reason) => {
    try {
      await moveCard(id, ns, ne, reason)
      const card = cards.find(c=>c.id===id)
      // Cards criados direto pela Frotas (sem requestId) ou cujo request não
      // tem requesterId não têm ninguém pra notificar — o toast dizia
      // "solicitante notificado" incondicionalmente, mesmo quando notifyUser
      // nunca era chamado (nenhuma notificação de verdade saiu).
      let notificado = false
      if (card?.requestId) {
        const req = requests.find(r=>r.id===card.requestId)
        if (req?.requesterId) {
          await notifyUser(req.requesterId, 'service_rescheduled', '📅 Serviço reagendado', `O serviço de ${card.client} foi reagendado para ${ns}. Motivo: ${reason}`, card.requestId)
          await addDoc(collection(db,'requests',card.requestId,'messages'),{text:`Serviço reagendado para ${ns}. Motivo: ${reason}`,authorId:profile?.uid||'',authorName:profile?.name||'Frotas',authorRole:profile?.role||'frotas',type:'status_change',statusEvent:'reagendado',createdAt:serverTimestamp()})
          notificado = true
        }
      }
      addToast(notificado ? 'Serviço reagendado — solicitante notificado.' : 'Serviço reagendado.', 'success')
    } catch (err) {
      console.error('Erro ao reagendar serviço:', err)
      addToast('Erro ao reagendar. Tente novamente.', 'error')
    }
  }
  const handleRespond = async (id, status, note, webhook) => {
    if (status==='aceito') {
      const req = requests.find(r=>r.id===id)
      setAssignModal({ req, id, note, webhook })
    } else {
      try {
        await respondRequest(id,'recusado',note,webhook)
        addToast('❌ Solicitação recusada.','info')
      } catch (err) {
        console.error('Erro ao recusar solicitação:', err)
        addToast('Erro ao recusar. Tente novamente.', 'error')
      }
    }
  }

  // Card aberto direto pelo Frotas duplicava uma solicitação formal já pendente.
  // Preserva a solicitação (tem o rastro de aprovação) — remove o card avulso
  // e segue o fluxo normal de aceite, que já cuida de criar o card vinculado.
  const handleUseOriginalRequest = async (relatedRequest, cardId) => {
    try {
      await deleteCard(cardId)
      setModal(null); setEditCard(null)
      setAssignModal({ req: relatedRequest, id: relatedRequest.id, note:'', webhook: config?.teamsWebhookUrl })
      addToast('Card avulso removido — siga a aprovação pela solicitação original.', 'info')
    } catch (err) {
      console.error('Erro ao reconciliar com a solicitação original:', err)
      addToast('Erro ao reconciliar. Tente novamente.', 'error')
    }
  }

  const validacoes   = cards.filter(c => c.status === 'aguardando_validacao')
  // Cards sem driverId (ex.: transportadora externa) nunca passam pelo app do motorista —
  // precisam de uma via manual de conclusão, senão ficam presos para sempre em 'confirmado'.
  const semExecutorApp = cards.filter(c => !c.driverId && ['confirmado','em_execucao'].includes(c.status))
  // cardsAtivos: base pra todos os contadores — exclui cancelado e concluído
  const cardsAtivos   = cards.filter(c => !['concluido','cancelado'].includes(c.status))
  const antecipados   = cardsAtivos.filter(c => c.startDate > hoje)
  const atribuidos   = cardsAtivos.filter(c => c.driverId || c.driver)
  // NF pendente de emissão — subtipos que envolvem movimentação física de ativo/peça.
  // Responsabilidade exclusiva do analista; fica visível até alguém confirmar.
  const nfPendentes  = cards.filter(c =>
    SUBTYPES_NF.includes(c.subtype) &&
    c.status !== 'cancelado' &&
    !c.nfConfirmada
  )
  const totalValidacao = validacoes.length + semExecutorApp.length
  const totalNF        = nfPendentes.length

  // Central de Ações — consolida em uma lista só o que hoje aparece espalhado
  // em badges soltos pela tela (validação, NF, atribuição, solicitações).
  // Cada item resolve reaproveitando o fluxo que já existe (troca de aba do
  // painel lateral) — não duplica nenhuma lógica de clique/modal.
  const centralAcoes = [
    { id:'validar',   title:'Validar serviços concluídos', sub:`${validacoes.length} aguardando conferência`,        count:validacoes.length,     badgeBg:T.laranja, badgeColor:'#fff',   onResolve:()=>{setActiveTab('agenda');setPainelTab('val')} },
    { id:'nf',        title:'Confirmar NF emitida',        sub:`${nfPendentes.length} movimentação(ões) pendente(s)`,count:nfPendentes.length,    badgeBg:T.perigo,  badgeColor:'#fff',   onResolve:()=>{setActiveTab('agenda');setPainelTab('val')} },
    { id:'atribuir',  title:'Atribuir motorista',          sub:`${semExecutorApp.length} serviço(s) sem executor`,   count:semExecutorApp.length, badgeBg:T.amarelo, badgeColor:T.text,   onResolve:()=>{setActiveTab('agenda');setPainelTab('val')} },
    { id:'solicitar', title:'Responder solicitações',      sub:`${pending} nova(s) do time solicitante`,             count:pending,                badgeBg:T.info,    badgeColor:'#fff',   onResolve:()=>{setActiveTab('agenda');setPainelTab('sol')} },
  ].filter(a => a.count > 0)
  const totalAcoes = centralAcoes.reduce((s,a)=>s+a.count, 0)

  const relatedRequest = editCard ? findRelatedPendingRequest(editCard, requests) : null

  const handleValidarCard = async (card) => {
    if (SUBTYPES_NF.includes(card.subtype) && !card.nfConfirmada) {
      addToast('⚠️ Confirme a emissão da NF antes de concluir este serviço (abra o card e use o botão "Confirmar NF emitida").', 'error')
      return
    }
    try {
      await saveCard({
        ...card,
        status:       'concluido',
        concluidoPor: profile?.name || 'Frotas',
        concluidoEm:  new Date().toISOString(),
      })
      // Se veio de uma solicitação → atualizar request e notificar solicitante
      if (card.requestId) {
        await updateDoc(doc(db,'requests',card.requestId), {
          status:    'concluido',
          updatedAt: serverTimestamp(),
        })
        await addDoc(collection(db,'requests',card.requestId,'messages'), {
          text:`Serviço concluído e validado por ${profile?.name||'Frotas'}.`,
          authorId:profile?.uid||'', authorName:profile?.name||'Frotas',
          authorRole:profile?.role||'frotas', type:'status_change',
          statusEvent:'concluido', createdAt:serverTimestamp(),
        })
        // Notificar solicitante via Teams webhook (mesma config usada no aceite)
        if (config?.teamsWebhookUrl && card.client) {
          sendTeamsNotification(config.teamsWebhookUrl, '✅ Serviço concluído',
            `${card.client} (${card.nInterno||'—'}) — ${card.destCity||card.destination||'—'}. Validado por ${profile?.name||'Frotas'}.`
          ).catch(()=>{})
        }
        if (card.requesterId) {
          await notifyUser(card.requesterId, 'service_completed', '✅ Serviço concluído',
            `O serviço de ${card.machine||card.client||'sua solicitação'} foi concluído com sucesso.`, card.requestId)
        }
      }
      addToast(`✅ Serviço de ${card.client||'motorista'} validado e encerrado.`, 'success')
    } catch(err) {
      console.error('Erro ao validar card:', err)
      addToast(`❌ Erro ao validar: ${err.message}`, 'error')
    }
  }

  const handleCancelRequest = async (requestId, reason, authorName) => {
    try {
      await updateDoc(doc(db,'requests',requestId),{status:'cancelado',cancelReason:reason,cancelledAt:serverTimestamp(),cancelledBy:authorName,updatedAt:serverTimestamp()})
      // O card já criado para essa solicitação (se houver) precisa ser cancelado também,
      // senão o motorista continua vendo o serviço como ativo mesmo após o cancelamento.
      const linkedCard = cards.find(c => c.requestId === requestId && !['concluido','cancelado'].includes(c.status))
      if (linkedCard) {
        await updateDoc(doc(db,'cards',linkedCard.id), { status:'cancelado', cancelReason:reason, cancelledAt:serverTimestamp(), cancelledBy:authorName, updatedAt:serverTimestamp() })
      }
      // Toast dizia "solicitante notificado" mas notifyUser nunca era chamado
      // aqui — nenhuma notificação de verdade saía, só o texto dizia que sim.
      const req = requests.find(r=>r.id===requestId)
      let notificado = false
      if (req?.requesterId) {
        await notifyUser(req.requesterId, 'service_cancelled', '🚫 Serviço cancelado',
          `O serviço de ${req.machine||req.clientName||'sua solicitação'} foi cancelado. Motivo: ${reason}`, requestId)
        notificado = true
      }
      addToast(notificado ? 'Serviço cancelado — solicitante notificado.' : 'Serviço cancelado.', 'info')
    } catch (err) {
      console.error('Erro ao cancelar solicitação:', err)
      addToast('Erro ao cancelar. Tente novamente.','error')
    }
  }

  const handleAssignConfirm = async ({ driverId, driverName, transportadoraNome, transportadoraCnpj, date, dateEnd, note, veiculoId, veiculoLabel, freteEstimado, freteSugerido, km }) => {
    const { req, id, webhook } = assignModal
    const motorista = driverName || transportadoraNome || ''
    try {
      await respondRequest(id,'aceito',note||`Motorista: ${motorista} · Data: ${date}`,webhook)
      // Reaproveita o card já existente pra essa solicitação, se houver (comum
      // quando o solicitante reabre um serviço cancelado e ele volta pra Frotas
      // aceitar de novo) — sem isso, cada aceite criava um card NOVO via addDoc,
      // deixando o antigo (às vezes ainda cancelado) órfão na agenda pro analista
      // ter que limpar manualmente toda vez. Prioriza um card cancelado (é o
      // cenário de reabertura); na ausência, reaproveita qualquer outro card já
      // ligado a essa solicitação em vez de duplicar.
      const cardExistente = cards.find(c => c.requestId === id && c.status === 'cancelado')
        || cards.find(c => c.requestId === id)
      await saveCard({
        ...(cardExistente ? { id: cardExistente.id } : {}),
        type:req.type, subtype:req.subtype||'', client:req.clientName||req.requesterName||'',
        plantaObra:req.clientName||'', nInterno:req.nInterno||'', machine:req.machine||'',
        // nInternos/nInternosReserva (arrays brutos) precisam ser copiados aqui,
        // não só nInterno/machine (strings já achatadas) — MotoristaView lê o
        // array bruto primeiro (self-heal de card.machine congelado), e a edição
        // do card (RequestForm/handleSaveCard) também depende desses arrays pra
        // não começar em branco. Sem isso, todo card criado por este fluxo (o
        // caminho principal: Frotas aceitando uma solicitação) nunca carregava
        // essa informação, mesmo com a solicitação original correta.
        nInternos:req.nInternos||[], nInternosReserva:req.nInternosReserva||[],
        urgency:req.urgency||'medio', origin:req.origin||'', destination:req.destination||'',
        originCity:req.originCityName||'', destCity:req.destCityName||'',
        // dateEnd vem do AssignDriverModal, já ajustado pra nunca ficar antes de
        // `date` (bug real: endDate travado no desiredDateEnd original da
        // solicitação fazia o card sumir da agenda quando só a data de execução
        // era alterada — nenhum dia bate num intervalo com fim < início).
        startDate:date, endDate:(dateEnd&&dateEnd>=date)?dateEnd:date, driver:motorista, driverId:driverId||'',
        transportadoraNome:transportadoraNome||'', transportadoraCnpj:transportadoraCnpj||'',
        unit:req.unit||profile?.unit||'', notes:req.description||'', description:req.description||'',
        requestId:id, requesterId:req.requesterId||'', status:'confirmado',
        // Limpa os campos de cancelamento — senão o card reaproveitado ficava
        // "confirmado" mas ainda carregando motivo/data de um cancelamento antigo.
        cancelReason:null, cancelledAt:null, cancelledBy:null,
        // Veículo/frete definidos na tela de aceite (FreteEstimativa), incluindo
        // eventual override manual do analista — antes isso nunca era salvo.
        veiculoId:veiculoId||'', veiculoLabel:veiculoLabel||'',
        freteEstimado:freteEstimado??null, freteSugerido:!!freteSugerido, km:km??null,
      })
      setAssignModal(null)
      addToast(`✅ Serviço aceito e atribuído a ${motorista||'motorista'}!`,'accepted')
    } catch (err) {
      console.error('Erro ao atribuir motorista:', err)
      addToast('Erro ao atribuir motorista. Tente novamente.', 'error')
    }
  }

  // "Ao vivo" (card na coluna lateral, Proposta D) — alterna a cada 7s entre o
  // slide de ticker (1 serviço em destaque) e o slide "serviços de hoje".
  useEffect(() => {
    const iv = setInterval(() => setRodapeSlide(s => s === 0 ? 1 : 0), 7000)
    return () => clearInterval(iv)
  }, [])

  const cardsHoje = cards.filter(c => c.startDate === todayStr() && c.status !== 'cancelado').sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''))

  // Ticker do slide "Em destaque agora" — troca de serviço a cada 3.5s, mesmo
  // timing do mockup validado (Proposta D).
  useEffect(() => {
    if (cardsHoje.length <= 1) { setDestaqueIdx(0); return }
    setDestaqueIdx(i => i >= cardsHoje.length ? 0 : i) // não aponta pra item que sumiu
    const iv = setInterval(() => setDestaqueIdx(i => (i + 1) % cardsHoje.length), 3500)
    return () => clearInterval(iv)
  }, [cardsHoje.length])

  return (
    <div style={{ background:T.bgCold, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'IBM Plex Sans,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <ToastContainer toasts={toasts} onDismiss={dismiss}/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:${T.bg}} ::-webkit-scrollbar-thumb{background:${T.borderMid};border-radius:10px}`}</style>

      {/* HEADER */}
      <div style={{ position:'relative', zIndex:100, background:'rgba(255,255,255,.9)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(26,22,18,.06)', padding:'0 22px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <MillsLogo height={18}/>
          <div style={{ width:1, height:24, background:T.border }}/>
          <div>
            <div style={{ color:T.text, fontFamily:FONT, fontWeight:800, fontSize:14, lineHeight:1.2 }}>Gestão de Frotas</div>
            <div style={{ color:T.textMuted, fontFamily:FONT, fontSize:10 }}>Operações de campo · ao vivo</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:T.verdeLight, border:`1px solid ${T.verde}30`, borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.verde, animation:'pulse 2s infinite' }}/>
            <span style={{ color:T.verde, fontSize:9, fontWeight:700, letterSpacing:'0.06em' }}>LIVE</span>
          </div>
          <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, display:'flex', padding:3, gap:2 }}>
            {[['agenda','📅 Agenda'],['requests','📥 Solicitações']].map(([v,l])=>(
              <button key={v} onClick={()=>setActiveTab(v)}
                style={{ padding:'4px 12px', borderRadius:T.rSm, border:'none', background:activeTab===v?T.laranja:'transparent', color:activeTab===v?'white':T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:11, cursor:'pointer', transition:'all .12s', display:'flex', alignItems:'center', gap:5 }}>
                {l}
                {v==='requests'&&pending>0&&<span style={{ background:activeTab==='requests'?'rgba(255,255,255,.3)':T.perigo, color:'white', borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>{pending}</span>}
                {v==='agenda'&&validacoes.length>0&&<span style={{ background:activeTab==='agenda'?'rgba(255,255,255,.3)':T.info, color:'white', borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>{validacoes.length}</span>}
              </button>
            ))}
          </div>
          {activeTab==='agenda'&&<>
            <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:T.r, display:'flex', padding:3, gap:2 }}>
              {[['semana','Semana'],['mes','Mês'],['ano','Ano']].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{ padding:'4px 11px', borderRadius:T.rSm, border:'none', background:view===v?T.laranja:'transparent', color:view===v?'white':T.textSec, fontFamily:'IBM Plex Sans,sans-serif', fontWeight:600, fontSize:11, cursor:'pointer', transition:'all .12s' }}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setExportModal(true)} style={{ ...BS, background:T.verdeLight, color:T.verde, border:`1px solid ${T.verde}40`, fontSize:11, fontWeight:700 }}>📤 Relatório</button>
            <button onClick={()=>{setEditCard(null);setDefaultDate(baseDate);setModal('card');}} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:11, boxShadow:'0 2px 8px rgba(243,112,33,.3)' }}>+ Novo Serviço</button>
          </>}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onMarkRead={markRead} onDelete={deleteNotification} onEnablePush={enablePush} onDisablePush={disablePush}/>
          {/* Menu "Mais" */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setMaisOpen(v=>!v)}
              style={{ ...BS, background:maisOpen?T.laranja:T.surfaceAlt, color:maisOpen?'white':T.textSec, border:`1px solid ${maisOpen?T.laranja:T.border}`, fontSize:11, padding:'5px 10px', fontWeight:700 }}>
              ⋯ Mais
              {simClients.length===0&&<span style={{ marginLeft:4, color:maisOpen?'white':T.perigo }}>⚠️</span>}
            </button>
            {maisOpen&&(
              <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:36, right:0, background:T.surface, border:BORDER_SUBTLE, borderRadius:16, boxShadow:SHADOW_CARD, zIndex:999, minWidth:200, padding:8 }}>
                <button onClick={()=>{setCsvModal(true);setMaisOpen(false)}}
                  style={{ width:'100%', textAlign:'left', padding:'8px 12px', borderRadius:T.rSm, border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontSize:12, color:T.text, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>⬆️ Atualizar base SIM</span>
                  {simClients.length>0
                    ? <span style={{ color:T.verde, fontSize:10, fontWeight:700 }}>({simClients.length})</span>
                    : <span style={{ color:T.perigo, fontSize:10, fontWeight:700 }}>vazia</span>}
                </button>
                <button onClick={()=>{setDriversModal(true);setMaisOpen(false)}}
                  style={{ width:'100%', textAlign:'left', padding:'8px 12px', borderRadius:T.rSm, border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontSize:12, color:T.text }}>
                  👤 Motoristas
                </button>
                <button onClick={()=>{setDiagnosticoModal(true);setMaisOpen(false)}}
                  style={{ width:'100%', textAlign:'left', padding:'8px 12px', borderRadius:T.rSm, border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontSize:12, color:T.text }}>
                  🔍 Diagnosticar Equipamento
                </button>
                <button onClick={()=>{setSettingsModal(true);setMaisOpen(false)}}
                  style={{ width:'100%', textAlign:'left', padding:'8px 12px', borderRadius:T.rSm, border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontSize:12, color:T.text }}>
                  ⚙️ Configurações
                </button>
                <div style={{ height:1, background:T.border, margin:'4px 8px' }}/>
                <button onClick={()=>{logout();setMaisOpen(false)}}
                  style={{ width:'100%', textAlign:'left', padding:'8px 12px', borderRadius:T.rSm, border:'none', background:'transparent', cursor:'pointer', fontFamily:FONT, fontSize:12, color:T.perigo }}>
                  Sair
                </button>
              </div>
            )}
            {maisOpen&&<div onClick={()=>setMaisOpen(false)} style={{ position:'fixed', inset:0, zIndex:998 }}/>}
          </div>
        </div>
      </div>

      {/* Banner SIM vazio — visível em qualquer aba */}
      {simClients.length===0&&(
        <div style={{ background:T.perigoLight, borderBottom:`2px solid ${T.perigo}`, padding:'0 20px', height:44, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ color:T.perigo, fontFamily:FONT, fontWeight:700, fontSize:12 }}>⚠️ Base do SIM não carregada — campos de cliente e frota não funcionarão</span>
          <button onClick={()=>setCsvModal(true)} style={{ ...BS, background:T.perigo, color:'white', fontSize:11, fontWeight:700, padding:'4px 12px', marginLeft:'auto' }}>Carregar SIM agora</button>
        </div>
      )}

      {/* AGENDA TAB */}
      {activeTab==='agenda'&&(
      <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'minmax(0,1fr) 310px', gap:14, padding:'12px 20px 14px', minHeight:0, overflow:'hidden' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>view==='semana'?navWeek(-1):view==='mes'?navMonth(-1):setYr(y=>y-1)} style={NB}>‹</button>
              <button onClick={()=>view==='semana'?navWeek(1):view==='mes'?navMonth(1):setYr(y=>y+1)} style={NB}>›</button>
              <h2 style={{ color:T.text, fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:17, margin:0, letterSpacing:'0.02em' }}>
                {view==='semana'&&`${fmt(weekDays[0])} — ${fmt(weekDays[6])}`}
                {view==='mes'&&`${MONTH_NAMES[mo]} ${yr}`}
                {view==='ano'&&`${yr}`}
              </h2>
              {view==='semana'&&<button onClick={()=>setBaseDate(todayStr())} style={{ ...NB, fontSize:10, padding:'3px 8px', letterSpacing:'0.04em' }}>HOJE</button>}
              {view==='semana'&&<button onClick={()=>setCalendarCollapsed(c=>!c)} style={{ ...NB, fontSize:10, padding:'3px 8px' }}>{calendarCollapsed?'▾ Expandir calendário':'▴ Recolher calendário'}</button>}
            </div>
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              {/* Campo de busca */}
              <div style={{ position:'relative' }}>
                <input
                  value={busca} onChange={e=>setBusca(e.target.value)}
                  placeholder="🔍 Nº card, frota ou cliente..."
                  style={{ ...IS, width:220, padding:'5px 28px 5px 10px', fontSize:11, borderRadius:20, height:28 }}/>
                {busca && (
                  <button onClick={()=>setBusca('')}
                    style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:13, lineHeight:1 }}>×</button>
                )}
                {busca.trim().length>=1 && (
                  <div style={{ position:'absolute', top:34, right:0, width:320, background:T.surface, borderRadius:14, boxShadow:SHADOW_CARD, border:BORDER_SUBTLE, zIndex:999, maxHeight:360, overflowY:'auto' }}>
                    {buscaResultados.length===0 ? (
                      <div style={{ padding:'14px 16px', color:T.textMuted, fontSize:12, fontFamily:FONT }}>Nenhum resultado encontrado</div>
                    ) : buscaResultados.map(card=>{
                      const ct=CARD_TYPES[card.type]
                      return (
                        <div key={card.id} onClick={()=>{setEditCard(card);setModal('card');setBusca('')}}
                          style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`, cursor:'pointer', display:'flex', gap:10, alignItems:'flex-start' }}>
                          <span style={{ background:ct?.bg, color:ct?.color, borderRadius:20, padding:'1px 6px', fontSize:9, fontWeight:700, fontFamily:FONT, flexShrink:0 }}>{ct?.icon} {ct?.short}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:T.text, fontWeight:700, fontSize:12, fontFamily:FONT, marginBottom:2 }}>
                              {card.seqId ? `#${card.seqId} · ` : ''}{card.client||card.clientName||'—'}
                            </div>
                            <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>
                              {[card.nInterno,...(card.nInternos||[])].filter(Boolean).join(', ')}{card.startDate?` · ${fmt(card.startDate)}`:''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {Object.entries(CARD_TYPES).map(([k,v])=>(
                <div key={k} style={{ display:'flex', alignItems:'center', gap:4, background:v.bg, border:`1px solid ${v.color}40`, borderRadius:20, padding:'2px 9px' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:v.color }}/><span style={{ color:v.color, fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{v.short}</span>
                </div>
              ))}
              {conflicts.length>0&&<div style={{ display:'flex', alignItems:'center', gap:4, background:T.amareloLight, border:`1px solid ${T.amarelo}50`, borderRadius:20, padding:'2px 9px' }}>
                <span style={{ color:'#B8860B', fontSize:8, fontWeight:700 }}>⚠ {conflicts.length} otimiz.</span>
              </div>}
              {view==='semana' && (
                <button onClick={()=>setCalCompact(c=>!c)}
                  style={{ ...BS, background:calCompact?T.laranjaLight:T.surface, color:calCompact?T.laranja:T.textSec, border:`1px solid ${calCompact?T.laranja:T.border}`, fontSize:9, fontWeight:700, padding:'3px 9px' }}>
                  {calCompact ? '▦ Compacto' : '▤ Padrão'}
                </button>
              )}
            </div>
          </div>

          {/* "Em destaque agora" saiu daqui — na Proposta D validada esse ticker vive
              só no card "Ao vivo" da coluna lateral (destaqueIdx é reaproveitado lá). */}
          {view==='semana' && calendarCollapsed ? (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:T.textSec, fontWeight:700, fontFamily:FONT }}>
                Calendário recolhido — {cards.filter(c=>c.startDate>=weekDays[0]&&c.startDate<=weekDays[6]&&c.status!=='cancelado').length} serviço(s) nesta semana
              </span>
              <button onClick={()=>setCalendarCollapsed(false)} style={{ background:T.laranjaLight, color:T.laranja, border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:800, fontFamily:FONT, cursor:'pointer' }}>Expandir calendário</button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-5 }} transition={{ duration:.1 }} style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {view==='semana'&&<WeekView cards={cards} baseDate={baseDate} conflicts={conflicts} onEdit={c=>{setEditCard(c);setModal('card');}} onAddCard={d=>{setDefaultDate(d);setEditCard(null);setModal('card');}} onMoveCard={handleMoveCard} compact={calCompact}/>}
                {view==='mes'&&<MonthView cards={cards} year={yr} month={mo} conflicts={conflicts} onEdit={c=>{setEditCard(c);setModal('card');}} onAddCard={d=>{setDefaultDate(d);setEditCard(null);setModal('card');}} onMoveCard={handleMoveCard}/>}
                {view==='ano'&&<div style={{ overflow:'auto', flex:1 }}><YearView cards={cards} year={yr} onMonthClick={m=>{setMo(m);setView('mes');}}/></div>}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Faixa de 4 KPIs (Proposta D validada) ──────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, flexShrink:0 }}>
            {[
              {l:'Serviços ativos',       v:cardsAtivos.length,  c:T.laranja},
              {l:'Atrasados',             v:atrasados.length,    c:T.perigo},
              {l:'Atribuídos',            v:atribuidos.length,   c:T.info},
              {l:'Rotas otimizáveis',     v:conflicts.length,    c:'#B8860B'},
            ].map(s=>(
              <div key={s.l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'10px 12px' }}>
                <div style={{ color:s.c, fontFamily:FONT, fontWeight:800, fontSize:20, lineHeight:1, marginBottom:2 }}>{s.v}</div>
                <div style={{ color:T.textSec, fontSize:10.5, fontFamily:FONT, fontWeight:700 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna lateral — altura inteira, ao lado do calendário (posição igual à Proposta D validada).
            Central de Ações e o menu de abas ficam fixos no topo; só o conteúdo de cada aba rola
            (inclusive a aba "Ao vivo", que não é mais um card solto — não invade mais nada). */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0, overflow:'hidden' }}>
          {/* Central de Ações — resume validação/NF/atribuição/solicitações num só lugar (achado #7 do diagnóstico) */}
            <div style={{ background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, padding:'12px 14px', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                <span style={{ color:T.verde, fontWeight:800, fontSize:11.5, fontFamily:FONT }}>Central de ações</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {totalAcoes>0 && <span style={{ background:T.laranja, color:'#fff', borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:800, fontFamily:FONT }}>{totalAcoes}</span>}
                  {centralAcoes.length>2 && (
                    <button onClick={()=>setCentralExpanded(true)} style={{ background:T.verdeLight, color:T.verde, border:'none', borderRadius:7, padding:'4px 9px', fontSize:10, fontWeight:800, fontFamily:FONT, cursor:'pointer' }}>Expandir</button>
                  )}
                </div>
              </div>
              <div style={{ color:T.textMuted, fontSize:9.5, fontFamily:FONT, marginBottom:9 }}>Prioriza validações, NFs e solicitações num só lugar</div>
              {centralAcoes.length===0 ? (
                <div style={{ color:T.textMuted, fontSize:11, fontFamily:FONT }}>Nenhuma ação pendente 🎉</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {centralAcoes.slice(0,2).map(a=>(
                    <div key={a.id} onClick={a.onResolve} style={{ background:T.surfaceAlt, borderRadius:10, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, cursor:'pointer' }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{a.title}</div>
                        <div style={{ color:T.textMuted, fontSize:9.5, fontFamily:FONT }}>{a.sub}</div>
                      </div>
                      <span style={{ background:a.badgeBg, color:a.badgeColor, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:800, fontFamily:FONT, flexShrink:0 }}>{a.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          {/* PAINEL ÚNICO com abas: Resumo / Solicitações / Validação — ocupa o espaço restante da coluna */}
          <div style={{ flex:1, background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
                {/* Abas */}
                <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
                  {[
                    ['resumo',  'Resumo',      null],
                    ['sol',     'Solicitações', pending||null],
                    ['val',     'Validação',    (totalValidacao+totalNF)||null],
                    ['vivo',    'Ao vivo',      null],
                  ].map(([k,l,badge])=>(
                    <button key={k} onClick={()=>setPainelTab(k)}
                      style={{ flex:1, padding:'8px 4px', border:'none', borderBottom:`2px solid ${painelTab===k?T.laranja:'transparent'}`, background:'transparent', cursor:'pointer', fontFamily:FONT, fontWeight:painelTab===k?700:500, fontSize:10, color:painelTab===k?T.laranja:T.textMuted, display:'flex', alignItems:'center', justifyContent:'center', gap:4, transition:'all .1s' }}>
                      {l}
                      {badge&&<span style={{ background:k==='val'&&totalNF>0?T.perigo:T.laranja, color:'white', borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>{badge}</span>}
                    </button>
                  ))}
                </div>

                <div style={{ flex:1, overflowY:'auto', padding:13 }}>
                  {/* Resumo */}
                  {painelTab==='resumo'&&(
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        ['Serviços', cardsAtivos.length, T.laranja, T.laranjaLight],
                        ['Atrasados', atrasados.length, T.perigo, T.perigoLight],
                        ['Atribuídos', atribuidos.length, T.verde, T.verdeLight],
                        ['Antecipados', antecipados.length, T.info, T.infoLight],
                      ].map(([l,v,color,bg])=>(
                        <div key={l} style={{ background:bg, border:BORDER_SUBTLE, borderRadius:14, padding:'10px 12px', boxShadow:SHADOW_CARD }}>
                          <div style={{ color, fontFamily:FONT, fontWeight:800, fontSize:22, lineHeight:1, letterSpacing:'-.02em' }}>{v}</div>
                          <div style={{ color:T.textSec, fontSize:9, fontFamily:FONT, fontWeight:600, letterSpacing:'-.005em', marginTop:3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Solicitações */}
                  {painelTab==='sol'&&(
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <span style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'0.07em' }}>📥 Solicitações</span>
                        <button onClick={()=>setActiveTab('requests')} style={{ color:T.laranja, background:'none', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>Ver todas →</button>
                      </div>
                      {requests.length===0&&<p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:0 }}>Nenhuma solicitação.</p>}
                      {sortByUrgency([...requests].filter(r=>!['cancelado','concluido'].includes(r.status)),'desiredDate').slice(0,6).map(r=>{
                        const sc={pendente:T.amarelo,aceito:T.verde,recusado:T.perigo}
                        const sl={pendente:'⏳',aceito:'✅',recusado:'❌'}
                        return (
                          <div key={r.id} onClick={()=>setActiveTab('requests')}
                            style={{ border:`1px solid ${T.border}`, borderRadius:T.rSm, padding:'9px 11px', marginBottom:7, cursor:'pointer', background:T.surfaceAlt }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.laranja} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                              <span style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT }}>{r.requesterName||'—'}</span>
                              <span style={{ color:sc[r.status]||T.textMuted, fontSize:11 }}>{sl[r.status]||'○'}</span>
                            </div>
                            <div style={{ color:T.textSec, fontSize:10, fontFamily:FONT }}>{r.unit} · {fmt(r.desiredDate)}</div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Validação — NF primeiro (bloqueia financeiro), depois prontos, depois sem app */}
                  {painelTab==='val'&&(
                    <>
                      {nfPendentes.length>0&&(
                        <div style={{ marginBottom:14 }}>
                          <div style={{ background:T.perigo, borderRadius:T.rSm, padding:'4px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ color:'white', fontSize:9, fontFamily:FONT, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em' }}>📄 NF pendente — bloqueia conclusão</span>
                            <span style={{ background:'rgba(255,255,255,.3)', color:'white', borderRadius:10, padding:'0 6px', fontSize:9, fontWeight:800 }}>{nfPendentes.length}</span>
                          </div>
                          {nfPendentes.map(c=>(
                            <div key={c.id} onClick={()=>setReviewValidacao(c)}
                              style={{ border:`2px solid ${T.perigo}`, borderRadius:T.rSm, padding:'9px 11px', marginBottom:7, background:T.perigoLight, cursor:'pointer' }}>
                              <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT, marginBottom:2 }}>{c.client||'—'}</div>
                              <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>{getSubtypeLabel(c.type,c.subtype)} · {fmt(c.startDate)}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {validacoes.length>0&&(
                        <div style={{ marginBottom:14 }}>
                          <div style={{ color:T.verde, fontSize:9, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>✅ Prontos para validar</div>
                          {validacoes.map(c=>{
                            const precisaNF = SUBTYPES_NF.includes(c.subtype) && !c.nfConfirmada
                            return (
                            <div key={c.id} onClick={()=>setReviewValidacao(c)}
                              style={{ border:`1px solid ${T.verde}30`, borderRadius:T.rSm, padding:'9px 11px', marginBottom:7, background:T.verdeLight, cursor:'pointer' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.client||'—'}</div>
                                  <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT }}>👤 {c.driver||'—'} · {fmt(c.startDate)}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                                  {c.conclusaoFoto && <span title="Tem foto anexada" style={{ fontSize:13 }}>📷</span>}
                                  {precisaNF && <span style={{ background:T.perigo, color:'white', borderRadius:10, padding:'1px 6px', fontSize:8, fontWeight:800 }}>NF</span>}
                                  <span style={{ color:T.verde, fontSize:11 }}>→</span>
                                </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      )}

                      {reviewValidacao && (
                        <ValidacaoModal
                          card={reviewValidacao}
                          nfInput={nfInputs[reviewValidacao.id]}
                          onNfInputChange={v=>setNfInputs(prev=>({...prev,[reviewValidacao.id]:v}))}
                          onConfirmarNF={()=>handleConfirmarNF(reviewValidacao)}
                          onValidar={async(c)=>{ await handleValidarCard(c); setReviewValidacao(null) }}
                          onClose={()=>setReviewValidacao(null)}
                        />
                      )}

                      {semExecutorApp.length>0&&(
                        <div>
                          <div style={{ color:T.textMuted, fontSize:9, fontFamily:FONT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>🚚 Sem app — conclusão manual</div>
                          {semExecutorApp.map(c=>(
                            <div key={c.id} style={{ border:`1px solid ${T.laranja}30`, borderRadius:T.rSm, padding:'9px 11px', marginBottom:7, background:T.laranjaLight }}>
                              <div style={{ color:T.text, fontWeight:700, fontSize:11, fontFamily:FONT, marginBottom:2 }}>{c.client||'—'}</div>
                              <div style={{ color:T.textMuted, fontSize:10, fontFamily:FONT, marginBottom:6 }}>🚚 {c.transportadoraNome||c.driver||'—'} · {fmt(c.startDate)}</div>
                              <button onClick={()=>setConfirmarConclusao(c)} style={{ ...BS, background:T.laranja, color:'white', fontWeight:700, fontSize:10, width:'100%' }}>✅ Marcar como concluído</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {validacoes.length===0&&semExecutorApp.length===0&&nfPendentes.length===0&&(
                        <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:0 }}>Nenhum serviço aguardando.</p>
                      )}
                    </>
                  )}

                  {/* Ao vivo — ticker "em destaque" (troca a cada 3.5s) alternando com a lista de
                      hoje (troca a cada 7s). Vive dentro da mesma área de rolagem das outras abas,
                      então nunca invade o espaço fixo da Central de Ações/menu de abas. */}
                  {painelTab==='vivo'&&(
                    <>
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center', marginBottom:9 }}>
                        <button onClick={()=>setMapModal(true)} title="Ver mapa" style={{ background:'none', border:'none', color:T.textMuted, fontSize:14, cursor:'pointer', padding:0 }}>🗺</button>
                        <div style={{ display:'flex', gap:4 }}>
                          {[0,1].map(i=>(
                            <div key={i} onClick={()=>setRodapeSlide(i)} style={{ width:6, height:6, borderRadius:'50%', cursor:'pointer', background:rodapeSlide===i?T.laranja:T.border }}/>
                          ))}
                        </div>
                      </div>
                      {rodapeSlide===0 ? (
                        cardsHoje.length===0 ? (
                          <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:0 }}>Nenhum serviço para hoje.</p>
                        ) : (() => {
                          const destaque = cardsHoje[destaqueIdx] || cardsHoje[0]
                          const ct = CARD_TYPES[destaque.type]
                          return (
                            <div onClick={()=>{setEditCard(destaque);setModal('card')}}
                              style={{ background:T.laranjaXLight, border:`1px solid ${T.laranja}30`, borderRadius:10, padding:'9px 11px', cursor:'pointer' }}>
                              <div style={{ color:T.laranja, fontFamily:FONT, fontWeight:800, fontSize:9, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>🔶 Em destaque agora</div>
                              <div style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:11.5 }}>{ct?.icon} {destaque.client||'—'}</div>
                              <div style={{ color:T.textSec, fontFamily:FONT, fontSize:10, marginTop:1 }}>👤 {destaque.driver||'Sem motorista'} · {destaque.nInterno||'—'}</div>
                            </div>
                          )
                        })()
                      ) : (
                        cardsHoje.length===0 ? (
                          <p style={{ color:T.textMuted, fontSize:11, fontFamily:FONT, margin:0 }}>Nenhum serviço para hoje.</p>
                        ) : cardsHoje.map(c=>{
                          const atrasado = atrasados.some(a=>a.id===c.id)
                          const statusColor = atrasado ? T.perigo : c.status==='aguardando_validacao' ? T.laranja : c.status==='em_execucao' ? T.info : T.textMuted
                          const statusLabel = atrasado ? 'Atrasado' : c.status==='aguardando_validacao' ? 'Aguard. validação' : c.status==='em_execucao' ? 'Em execução' : c.status==='confirmado' ? 'Confirmado' : (c.status||'—')
                          return (
                            <div key={c.id} onClick={()=>{setEditCard(c);setModal('card')}}
                              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 9px', marginBottom:6, borderRadius:8, cursor:'pointer', background:T.surfaceAlt }}>
                              <div style={{ minWidth:0 }}>
                                <div style={{ color:T.text, fontWeight:700, fontSize:10.5, fontFamily:FONT }}>{c.client||'—'}</div>
                                <div style={{ color:T.textMuted, fontSize:9.5, fontFamily:FONT }}>{c.driver||c.transportadoraNome||'Sem motorista'}</div>
                              </div>
                              <span style={{ color:statusColor, fontWeight:700, fontSize:9.5, fontFamily:FONT, flexShrink:0, whiteSpace:'nowrap' }}>{statusLabel}</span>
                            </div>
                          )
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
          </div>
        </div>

        {/* Overlay "Central de ações" expandida — lista completa priorizada, cada item resolve reaproveitando o fluxo já existente */}
        {centralExpanded && (
          <div style={{ position:'absolute', top:8, right:20, bottom:14, width:'56%', minWidth:360, background:T.surface, borderRadius:16, boxShadow:'0 24px 60px rgba(26,22,18,.28)', border:`1px solid ${T.border}`, zIndex:30, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ background:T.verde, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <div style={{ color:'#fff', fontWeight:800, fontSize:14, fontFamily:FONT }}>Central de ações</div>
                <div style={{ color:'rgba(255,255,255,.6)', fontSize:10.5, fontFamily:FONT }}>Validações, NFs, atribuição e solicitações — priorizado</div>
              </div>
              <button onClick={()=>setCentralExpanded(false)} style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11.5, fontWeight:800, fontFamily:FONT, cursor:'pointer' }}>✕ Recolher</button>
            </div>
            <div style={{ padding:'16px 20px', overflow:'auto', flex:1 }}>
              {centralAcoes.length===0 ? (
                <p style={{ color:T.textMuted, fontSize:12, fontFamily:FONT }}>Nenhuma ação pendente 🎉</p>
              ) : centralAcoes.map(a=>(
                <div key={a.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'12px 15px', marginBottom:9, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ color:T.text, fontWeight:700, fontSize:12.5, fontFamily:FONT }}>{a.title}</div>
                    <div style={{ color:T.textMuted, fontSize:10.5, fontFamily:FONT }}>{a.sub}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                    <span style={{ background:a.badgeBg, color:a.badgeColor, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:800, fontFamily:FONT }}>{a.count}</span>
                    <button onClick={()=>{a.onResolve();setCentralExpanded(false)}} style={{ background:T.laranja, color:'#fff', border:'none', borderRadius:8, padding:'6px 13px', fontSize:11, fontWeight:800, fontFamily:FONT, cursor:'pointer', whiteSpace:'nowrap' }}>Resolver</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab==='requests'&&(
        <div style={{ flex:1, overflow:'hidden', padding:'14px 20px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexShrink:0 }}>
            <div>
              <h2 style={{ fontFamily:'Barlow Condensed,IBM Plex Sans,sans-serif', fontWeight:700, fontSize:22, color:T.text, margin:0 }}>Solicitações de Serviço</h2>
              <p style={{ color:T.textMuted, fontFamily:'IBM Plex Sans,sans-serif', fontSize:12, margin:'2px 0 0' }}>Demandas recebidas em tempo real · {requests.filter(r=>['pendente','aceito'].includes(r.status)).length} em aberto · {requests.filter(r=>!['cancelado'].includes(r.status)).length} histórico</p>
            </div>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <RequestsKanban requests={requests} teamsWebhookUrl={config?.teamsWebhookUrl} onRespond={handleRespond} onCancel={handleCancelRequest} profile={profile} simClients={simClients}/>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {modal==='card'&&<RequestForm
          simClients={simClients}
          drivers={drivers}
          profile={profile}
          initialData={editCard || (defaultDate ? { startDate: defaultDate } : null)}
          relatedRequest={relatedRequest}
          onUseOriginalRequest={handleUseOriginalRequest}
          title={editCard ? '✏️ Editar Serviço' : '➕ Novo Serviço'}
          submitLabel={editCard ? '💾 Salvar' : '➕ Criar Serviço'}
          onSubmit={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={()=>{setModal(null);setEditCard(null);}}
        />}
        {exportModal&&<ExportModal cards={cards} onClose={()=>setExportModal(false)}/>}
        {driversModal&&<DriversModal drivers={drivers} onSave={saveDriver} onDelete={deleteDriver} onClose={()=>setDriversModal(false)} onRotograma={d=>{setDriversModal(false);setRotogramaModal(d)}} addToast={addToast}/>}
        {diagnosticoModal&&<DiagnosticoModal simClients={simClients} onClose={()=>setDiagnosticoModal(false)}/>}
        {assignModal&&<AssignDriverModal req={assignModal.req} drivers={drivers} simClients={simClients} cards={cards} onConfirm={handleAssignConfirm} onCancel={()=>setAssignModal(null)}/>}
        {pendingCardForm&&<AssignDriverModal
          req={{
            ...pendingCardForm,
            clientName:    pendingCardForm.client,
            requesterName: pendingCardForm.client,
            originCityName:pendingCardForm.originCity,
            destCityName:  pendingCardForm.destCity,
            desiredDate:   pendingCardForm.startDate,
            description:   pendingCardForm.notes,
            type:          pendingCardForm.type,
            machine:       pendingCardForm.machine,
            nInterno:      pendingCardForm.nInterno,
            // pendingCardForm.nInternos (array real, já espalhado via ...pendingCardForm
            // acima) NÃO pode ser sobrescrito aqui envolvendo o nInterno já unido
            // (string "PCP01234, PCP05678") num array de 1 item só — isso quebra o
            // reconhecimento de cada máquina individualmente na estimativa de frete
            // quando o serviço tem 2+ N° internos.
            nInternos:     pendingCardForm.nInternos?.length ? pendingCardForm.nInternos : (pendingCardForm.nInterno ? [pendingCardForm.nInterno] : []),
          }}
          drivers={drivers}
          simClients={simClients}
          cards={cards}
          onConfirm={handleCardDriverConfirm}
          onCancel={handleCardDriverCancel}
        />}
        {rotogramaModal&&<RotogramaModal driver={rotogramaModal} cards={cards} profile={profile} rotogramaAtivo={rotogramas.find(r=>r.driverId===rotogramaModal.id)||null} onClose={()=>setRotogramaModal(null)} addToast={addToast}/>}
        {csvModal&&<CsvUploadModal onLoaded={async clients=>{await uploadClients(clients);setCsvModal(false);addToast(`${clients.length} registros sincronizados para todos os usuários.`,'success');}} onClose={()=>setCsvModal(false)}/>}
        {settingsModal&&<SettingsModal config={config} onSave={saveConfig} onClose={()=>setSettingsModal(false)}/>}
        <ConfirmModal open={!!confirmarConclusao} title="Concluir serviço"
          message={`Confirmar conclusão de ${confirmarConclusao?.client||'—'}?${confirmarConclusao?.requesterId ? ' O solicitante será notificado.' : ''}`}
          confirmLabel="✅ Concluir" onConfirm={()=>{handleValidarCard(confirmarConclusao);setConfirmarConclusao(null)}} onCancel={()=>setConfirmarConclusao(null)}/>
        {mapModal&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(26,22,18,.35)', zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={e=>e.target===e.currentTarget&&setMapModal(false)}>
            <motion.div initial={{ scale:.96, opacity:0 }} animate={{ scale:1, opacity:1 }}
              style={{ background:T.surface, borderRadius:18, width:320, maxWidth:'92vw', maxHeight:'85vh', overflow:'hidden', boxShadow:SHADOW_CARD, border:BORDER_SUBTLE }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.text, fontFamily:FONT, fontWeight:700, fontSize:12 }}>🗺 Mapa de rotas</span>
                <button onClick={()=>setMapModal(false)} style={{ background:'none', border:'none', color:T.textMuted, fontSize:20, cursor:'pointer' }}>×</button>
              </div>
              <div style={{ padding:10 }}>
                <BrazilMap cards={cards}/>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
