# Deploy — Push (item 5), PWA (item 4), Otimização de rota (item 2)

## O que precisa de configuração manual (só o item 5)

### 1. Gerar a chave VAPID no Firebase Console
- Firebase Console → ⚙️ Configurações do projeto → aba **Cloud Messaging**
- Role até **Web Push certificates** → **Generate key pair**
- Copia a chave gerada (uma string longa)

### 2. Adicionar ao `.env` do projeto
```
VITE_FIREBASE_VAPID_KEY=cole_a_chave_aqui
```
(mesma pasta dos outros `VITE_FIREBASE_*` que você já tem)

### 3. Preencher o Service Worker com os valores reais
Abra `public/firebase-messaging-sw.js` e troque os placeholders
`'COLE_AQUI_O_MESMO_VALOR_DO_.env_VITE_FIREBASE_...'` pelos valores REAIS do
seu `.env` — são os mesmos 6 valores que já estão lá (`VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, etc.). Um Service Worker não lê `import.meta.env`,
por isso precisa copiar manualmente. **Esses valores não são segredo** — o
Firebase foi desenhado pra essa config ficar pública; a segurança de
verdade é a Firestore Rules.

### 4. Mesclar a Cloud Function
Cole o conteúdo de `functions/push-notify.js` dentro do seu `functions/index.js`
existente (junto com WhatsApp e reset de senha) — mesma regra de sempre:
não repita `admin.initializeApp()`.

### 5. Deploy
```bash
firebase deploy --only functions
```
(o resto — client, manifest, ícones, Service Worker — sobe normal pelo
GitHub, sem comando extra)

## Como testar cada item

**Push (5):** abre o sino → "🔔 Ativar notificações push" → aceita a
permissão do navegador. Peça pra alguém gerar uma notificação pra você
(ex: uma aprovação pendente) e **feche a aba** — a notificação deve aparecer
como um alerta do sistema operacional, não só no sino.

**PWA (4):** no celular, abre o site no Chrome/Safari → menu → "Adicionar à
tela inicial" (ou o navegador pode sugerir isso sozinho). Deve aparecer com
o ícone verde da Mills, não o ícone genérico do navegador. Testa também:
abre o app, espera carregar, ativa o modo avião — o app deve continuar
abrindo (mesmo que os dados não atualizem, óbvio).

**Otimização de rota (2):** no Rotograma de um motorista com 3+ paradas,
clica "🧭 Otimizar ordem" e confirma que a sequência muda pra uma ordem que
faça sentido geograficamente.

## Limitações importantes de avisar a quem for usar

- **Push no iPhone/Safari**: só funciona se o usuário instalou o app na
  tela inicial (Adicionar à tela inicial) — iOS não permite push em aba de
  navegador comum, só em "apps" instalados desse jeito. É uma limitação da
  Apple, não do código.
- **Otimização de rota** usa o servidor público do OSRM (gratuito, sem
  SLA) — mesma dependência que o cálculo de frete combinado já usa.
- **Cache offline** guarda a ÚLTIMA versão vista quando havia sinal — se o
  motorista nunca abriu o app com internet, não tem nada em cache pra usar
  offline na primeira vez.
