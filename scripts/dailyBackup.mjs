// ============================================================
// dailyBackup.mjs — backup diário do Firestore rodando fora do navegador
// (GitHub Actions, agendado) — não depende de nenhum Master abrir a tela
// do app pra disparar, diferente do backup client-side original
// (runDailyBackup em src/hooks/useFirestore.js, que só roda quando alguém
// com perfil Master está com a tela aberta e os dados já carregados — se
// ninguém logar como Master num dia inteiro, aquele dia fica sem backup).
//
// Usa o MESMO formato de documento (backups/{data}/cardsChunks|
// requestsChunks + system/backupStatus) — a checagem de atraso que já
// existe no Master (useBackupStatus/backupStale em MasterView.jsx)
// continua funcionando sem nenhuma mudança, e os dois caminhos (navegador
// e este job) se protegem mutuamente: o primeiro que rodar num dia grava
// o backup de verdade, o outro só confirma que já existe.
//
// Diferença proposital em relação ao backup client-side: aqui faz backup
// de TODOS os cards e requests, sem os limites de "últimos 180 dias" /
// "500 mais recentes" que o app usa nas telas — aqueles limites existem só
// por performance de UI (não teria sentido carregar o histórico inteiro
// pra desenhar uma agenda), não porque dado mais antigo não precise ser
// preservado num backup.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
if (!serviceAccountJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT não configurado (secret do GitHub Actions ausente).')
  process.exit(1)
}
initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
const db = getFirestore()

// Mesmo formato do app (YYYY-MM-DD) — calculado no fuso de Brasília, não em
// UTC direto, pra bater com o mesmo "dia" que o backup client-side calcula
// pra quem está no Brasil (evita os dois caminhos discordarem sobre qual é
// "o backup de hoje" perto da virada do dia).
function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// Idêntica a chunkBySize em src/hooks/useFirestore.js — precisa ficar em
// sincronia pro formato do backup não divergir entre os dois caminhos.
function chunkBySize(items, maxBytes = 700000) {
  const chunks = []
  let current = [], currentSize = 2 // "[]"
  for (const item of items) {
    const size = JSON.stringify(item).length + 1
    if (current.length > 0 && currentSize + size > maxBytes) {
      chunks.push(current); current = []; currentSize = 2
    }
    current.push(item); currentSize += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

async function run() {
  const today = todayStr()
  const ref = db.doc(`backups/${today}`)
  const existing = await ref.get()
  if (existing.exists) {
    await db.doc('system/backupStatus').set(
      { lastCheckAt: FieldValue.serverTimestamp(), lastBackupDate: today },
      { merge: true }
    )
    console.log(`Backup de ${today} já existe — nada a fazer.`)
    return
  }

  const [cardsSnap, requestsSnap] = await Promise.all([
    db.collection('cards').get(),
    db.collection('requests').get(),
  ])
  const cards    = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const requests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const cardChunks    = chunkBySize(cards)
  const requestChunks = chunkBySize(requests)

  await Promise.all([
    ...cardChunks.map((chunk, i) => db.doc(`backups/${today}/cardsChunks/${i}`).set({ items: chunk })),
    ...requestChunks.map((chunk, i) => db.doc(`backups/${today}/requestsChunks/${i}`).set({ items: chunk })),
  ])

  // Documento "índice" — pequeno, só metadados. Sempre cabe no limite.
  await ref.set({
    date: today, createdAt: FieldValue.serverTimestamp(),
    cardsCount: cards.length, requestsCount: requests.length,
    cardChunks: cardChunks.length, requestChunks: requestChunks.length,
    source: 'github-actions', // marca de onde veio — útil se um dia for preciso investigar qual caminho gravou
  })
  await db.doc('system/backupStatus').set({
    lastBackupAt: FieldValue.serverTimestamp(), lastBackupDate: today,
    lastCheckAt: FieldValue.serverTimestamp(), cardsCount: cards.length, requestsCount: requests.length,
  }, { merge: true })

  console.log(`Backup OK: ${today} (${cards.length} cards em ${cardChunks.length} chunk(s), ${requests.length} requests em ${requestChunks.length} chunk(s))`)
}

run().catch(err => {
  console.error('Falha no backup diário:', err)
  process.exit(1)
})
