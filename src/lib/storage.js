// ============================================================
// storage.js — upload/download de arquivos no Firebase Storage.
// Primeiro uso de Storage no projeto (até aqui, imagens pequenas — foto de
// conclusão de serviço — ficavam salvas comprimidas direto no Firestore,
// já que nenhuma outra tela precisava de arquivo de verdade). Documento de
// veículo (CRLV, apólice de seguro etc.) costuma ser PDF ou foto grande
// demais pra caber no limite de 1MB por documento do Firestore, por isso
// usa Storage de verdade aqui.
//
// ⚠️ Precisa da regra correspondente publicada no Firebase Console
// (Storage → Rules) — não é gerenciada por este repositório (igual
// firestore.rules, que também vive só no Console). Regra sugerida:
//
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     match /veiculos/{veiculoId}/documentos/{arquivo} {
//       allow read, write: if request.auth != null &&
//         firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.status == 'ativo' &&
//         firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['frotas', 'master'];
//     }
//   }
// }
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// Limite de tamanho — generoso o bastante pra um PDF de poucas páginas ou
// foto de celular, mas evita alguém subir um arquivo gigante por engano
// (o Storage não tem limite próprio como o Firestore, então sem isso um
// upload errado passaria batido).
export const TAMANHO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024 // 10MB

export async function uploadDocumentoVeiculo(veiculoId, file) {
  if (file.size > TAMANHO_MAXIMO_DOCUMENTO) {
    throw new Error('Arquivo maior que 10MB — comprima ou reduza antes de anexar.')
  }
  // Nome com timestamp — evita colisão se dois documentos do mesmo veículo
  // usarem arquivos com o mesmo nome original (ex: dois "digitalizacao.pdf").
  const caminho = `veiculos/${veiculoId}/documentos/${Date.now()}_${file.name}`
  const storageRef = ref(storage, caminho)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, caminho, nome: file.name }
}

export async function excluirDocumentoVeiculo(caminho) {
  if (!caminho) return
  await deleteObject(ref(storage, caminho)).catch(() => {
    // Arquivo já pode não existir mais (ex: exclusão duplicada) — não é um
    // erro que precise travar a remoção do registro do documento em si.
  })
}
