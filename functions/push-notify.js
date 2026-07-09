/**
 * Mills Logística — Cloud Function: envia push de verdade (FCM) sempre que
 * um documento é criado em 'notifications' (item 5 da revisão).
 * ─────────────────────────────────────────────────────────────────────────
 * O sino no app só atualiza com a aba aberta. Esta function reage à MESMA
 * escrita no Firestore que já alimenta o sino (notifyUser/notifyRoles em
 * useFirestore.js não mudam nada) e manda um push de sistema operacional
 * de verdade — funciona com o navegador fechado.
 *
 * IMPORTANTE: cole este conteúdo dentro do seu functions/index.js existente
 * (junto com as functions do WhatsApp e do reset de senha) — não crie um
 * segundo arquivo de entrada. Só o admin.initializeApp() não pode repetir.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')

// admin.initializeApp() — não chamar de novo se já existir no arquivo.

exports.sendPushOnNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const notif = event.data?.data()
  if (!notif?.userId) return

  const userSnap = await admin.firestore().doc(`users/${notif.userId}`).get()
  const tokens = userSnap.exists() ? (userSnap.data().fcmTokens || []) : []
  if (!tokens.length) return // usuário nunca ativou push neste ou em nenhum dispositivo

  const message = {
    notification: {
      title: notif.title || 'Mills Logística',
      body:  notif.message || '',
    },
    data: {
      notificationId: event.params.notificationId,
      requestId: notif.requestId || '',
    },
    tokens,
  }

  const res = await admin.messaging().sendEachForMulticast(message)

  // Limpa tokens inválidos/expirados (usuário desinstalou, trocou de
  // navegador, etc.) — sem isso a lista só cresce e cada envio fica mais
  // lento à toa tentando tokens mortos pra sempre.
  const tokensInvalidos = []
  res.responses.forEach((r, i) => {
    if (!r.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)) {
      tokensInvalidos.push(tokens[i])
    }
  })
  if (tokensInvalidos.length) {
    await admin.firestore().doc(`users/${notif.userId}`).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensInvalidos),
    })
  }
})
