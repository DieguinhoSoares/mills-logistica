// ============================================================
// localBackup.mjs — backup COMPLETO do Firestore pra arquivos JSON no seu
// computador (fora do Google inteiramente). Diferente do backup diário
// (scripts/dailyBackup.mjs), que grava de volta DENTRO do próprio Firestore
// (útil contra exclusão acidental de um documento, mas inútil se a conta/
// projeto Firebase inteiro ficar inacessível) — este aqui é a cópia offline
// de verdade, pensada como rede de segurança antes de qualquer mudança de
// infraestrutura (troca de hospedagem, migração de servidor etc.).
//
// Como rodar:
//   1. Baixe a chave de conta de serviço do Firebase:
//      Console do Firebase → Configurações do projeto → Contas de serviço
//      → "Gerar nova chave privada" → baixa um .json
//      (é a MESMA credencial já usada no secret FIREBASE_SERVICE_ACCOUNT do
//      GitHub Actions — dá pra gerar uma nova sem afetar a existente)
//   2. NUNCA coloque esse arquivo dentro do repositório git. Salve fora,
//      ex: ~/mills-backup-key.json
//   3. Rode (na raiz do projeto, com as dependências já instaladas):
//        FIREBASE_SERVICE_ACCOUNT_PATH=~/mills-backup-key.json node scripts/localBackup.mjs
//
// Cada execução cria uma pasta nova em backups-local/<data-hora>/ com um
// arquivo .json por coleção — nunca sobrescreve um backup anterior.
// ============================================================
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFile, mkdir } from 'fs/promises'
import { readFileSync } from 'fs'
import path from 'path'
import os from 'os'

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  }
  const caminho = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (!caminho) {
    console.error('Faltou apontar a credencial. Use:\n  FIREBASE_SERVICE_ACCOUNT_PATH=/caminho/pra/chave.json node scripts/localBackup.mjs')
    process.exit(1)
  }
  // Expande "~" manualmente — o shell só expande automático se não tiver aspas,
  // e é fácil esquecer disso na hora de colar o comando.
  const expandido = caminho.startsWith('~') ? path.join(os.homedir(), caminho.slice(1)) : caminho
  return JSON.parse(readFileSync(expandido, 'utf-8'))
}

initializeApp({ credential: cert(carregarCredencial()) })
const db = getFirestore()

// Coleções de topo conhecidas do app (ver firestore.rules) — 'backups' fica
// de fora de propósito: já é dado de backup, replicar backup de backup só
// infla o arquivo sem agregar segurança nenhuma.
const COLECOES = [
  'users', 'requests', 'cards', 'drivers', 'rotogramas',
  'notifications', 'falhasSilenciosas', 'nfRequests', 'config', 'system',
]

async function exportarColecao(nome) {
  const snap = await db.collection(nome).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// requests/{id}/messages é a única subcoleção do app — precisa de uma
// passada por solicitação, não vem junto no get() da coleção pai.
async function exportarMensagensDeRequests(requests) {
  const porRequest = {}
  for (const r of requests) {
    const snap = await db.collection('requests').doc(r.id).collection('messages').get()
    if (!snap.empty) porRequest[r.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  return porRequest
}

async function run() {
  const agora = new Date()
  const pasta = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = path.join('backups-local', pasta)
  await mkdir(dir, { recursive: true })

  console.log(`Iniciando backup local em ${dir}/ ...`)
  const resumo = {}

  for (const nome of COLECOES) {
    const dados = await exportarColecao(nome)
    await writeFile(path.join(dir, `${nome}.json`), JSON.stringify(dados, null, 2), 'utf-8')
    resumo[nome] = dados.length
    console.log(`  ✓ ${nome}: ${dados.length} documento(s)`)

    if (nome === 'requests') {
      const mensagens = await exportarMensagensDeRequests(dados)
      await writeFile(path.join(dir, 'requests-messages.json'), JSON.stringify(mensagens, null, 2), 'utf-8')
      const totalMsgs = Object.values(mensagens).reduce((s, arr) => s + arr.length, 0)
      console.log(`  ✓ requests-messages: ${totalMsgs} mensagem(ns) em ${Object.keys(mensagens).length} solicitação(ões)`)
    }
  }

  await writeFile(path.join(dir, '_resumo.json'), JSON.stringify({ criadoEm: agora.toISOString(), contagens: resumo }, null, 2), 'utf-8')
  console.log(`\nBackup concluído: ${dir}/`)
}

run().catch(err => {
  console.error('Falha no backup local:', err)
  process.exit(1)
})
