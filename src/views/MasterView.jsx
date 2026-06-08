import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useCards, useNotifications } from '../hooks/useFirestore'
import { MillsLogo, ToastContainer, useToasts, ServiceCard, NotificationBell, MoveModal } from '../components/UI'
import { T, FONT, CARD_TYPES, WD_SHORT, BS } from '../lib/constants'
import { todayStr, getWeekDays, cardsForDay } from '../lib/utils'

function WeekView({ cards, baseDate, onEdit, onMoveCard }) {
  const days = getWeekDays(baseDate)
  const [dragCard, setDragCard] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [pending, setPending] = useState(null)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {pending && (
        <MoveModal 
          card={pending.card} 
          targetDate={pending.tgt}
          onConfirm={reason => { 
            const diff = (new Date(pending.tgt) - new Date(pending.card.startDate)) / 86400000; 
            const ne = new Date(pending.card.endDate); 
            ne.setDate(ne.getDate() + diff); 
            onMoveCard(pending.card.id, pending.tgt, ne.toISOString().split('T')[0], reason); 
            setPending(null) 
          }}
          onCancel={() => setPending(null)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7, flex: 1 }}>
        {days.map((day, idx) => {
          const dc = cardsForDay(cards, day).filter(c => c.calendarStatus !== 'cancelado')
          return (
            <div 
              key={day} 
              onDragOver={e => { e.preventDefault(); setDragOver(day); }} 
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { 
                e.preventDefault(); 
                if (dragCard && day !== dragCard.startDate) setPending({ card: dragCard, tgt: day }); 
                setDragCard(null); 
                setDragOver(null); 
              }}
              style={{ 
                background: dragOver === day ? '#FFF3E8' : day === todayStr() ? '#FFFAF5' : T.surface, 
                border: `1.5px solid ${T.border}`, 
                borderRadius: T.r, 
                padding: 9, 
                display: 'flex', 
                flexDirection: 'column', 
                overflowY: 'auto' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><strong>{WD_SHORT[idx]}</strong> <div style={{ fontSize: 20 }}>{day.split('-')[2]}</div></div>
              </div>
              {dc.map(c => (
                <ServiceCard 
                  key={c.id} 
                  card={c} 
                  conflicts={[]} 
                  onEdit={onEdit} 
                  onDragStart={(e, c2) => { setDragCard(c2); e.dataTransfer.effectAllowed = 'move'; }}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FrotasView() {
  const { user, logout } = useAuth()
  const { addToast, toasts, removeToast } = useToasts()
  const { cards, saveCard, moveCard } = useCards()
  
  const [baseDate, setBaseDate] = useState(todayStr())
  const weekDays = getWeekDays(baseDate)

  const changeDate = days => {
    const d = new Date(baseDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setBaseDate(d.toISOString().split('T')[0])
  }

  // Lógica de movimentação por arrastar corrigida para o perfil Frotas
  const handleMoveCard = async (id, newStart, newEnd, reason) => {
    try {
      const cardOriginal = cards.find(c => c.id === id)
      if (!cardOriginal) return
      
      // Salva o log do remanejamento e atualiza as datas do documento
      await moveCard(id, cardOriginal.laneId || 'agendado', user?.email, reason)
      await saveCard({ ...cardOriginal, startDate: newStart, endDate: newEnd })
      
      addToast({ type: 'success', title: 'Sucesso', text: 'Serviço remanejado com sucesso pelo Frotas!' })
    } catch (e) {
      addToast({ type: 'conflict', title: 'Erro', text: 'Não foi possível salvar o remanejamento.' })
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: T.bg, padding: '16px 24px', boxSizing: 'border-box' }}>
      
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <MillsLogo height={28}/>
          <span style={{ fontFamily: FONT, fontWeight: 700, color: T.textSec }}>🚚 Painel Frota / Logística</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <NotificationBell/>
          <div style={{ width: 1, height: 20, background: T.border }}/>
          <span style={{ fontFamily: FONT, fontSize: 12 }}><strong>{user?.email}</strong></span>
          <button onClick={() => logout()} style={{ ...BS, background: T.perigoLight, color: T.perigo, border: 'none', fontWeight: 700 }}>Sair 🚪</button>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexShrink: 0 }}>
        <button onClick={() => changeDate(-7)} style={{ ...BS, background: T.surface, border: `1px solid ${T.border}` }}>◀</button>
        <span style={{ fontFamily: FONT, fontWeight: 700 }}>{weekDays[0]} — {weekDays[6]}</span>
        <button onClick={() => changeDate(7)} style={{ ...BS, background: T.surface, border: `1px solid ${T.border}` }}>▶</button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <WeekView 
          cards={cards} 
          baseDate={baseDate} 
          onEdit={() => {}} // Frotas apenas visualiza/arrasta nesta view
          onMoveCard={handleMoveCard}
        />
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast}/>
    </div>
  )
}
