# Hospedagem própria (paralela ao GitHub Pages)

Guia pra rodar o mills-logística num computador próprio (Windows), servindo
os usuários que não conseguem acessar `github.io` por bloqueio de rede da
Mills. **Solução temporária** — o plano de longo prazo é migrar pro servidor
da Mills. Feito pra rodar **em paralelo** ao GitHub Pages, sem interromper
quem já usa o link atual: nenhum passo aqui toca no `vite.config.ts` nem no
script `build`/workflow `.github/workflows/deploy.yml` usados pelo GitHub
Actions.

Os dados (Firestore) são os mesmos dos dois lados — é o mesmo projeto
Firebase, só muda onde os arquivos do site ficam hospedados. Ver
`scripts/localBackup.mjs` pra tirar uma cópia local completa do banco antes
de qualquer mudança grande, se ainda não tiver feito.

## 1. Preparar o código

```
git clone https://github.com/DieguinhoSoares/mills-logistica.git
cd mills-logistica
npm install
```

## 2. Configurar as variáveis de ambiente

Copie `.env.local.example` para `.env.local` (mesma pasta, nunca vai pro
git) e preencha os valores — instruções de onde achar cada um estão nos
comentários do próprio arquivo.

## 3. Build separado pra hospedagem própria

```
npm run build:local
```

Gera a pasta `dist-local/` (build com `base: '/'`, pensado pra servir na
raiz de um domínio/IP próprio — diferente do `npm run build` normal, que
usa `base: '/mills-logistica/'` pro GitHub Pages). Os dois scripts são
independentes; rodar um não afeta o outro.

## 4. Hostname grátis (DuckDNS) — recomendado

Mesmo com IP "fixo" da operadora, um hostname evita dor de cabeça se o IP
mudar e é pré-requisito pra ter HTTPS de verdade sem comprar domínio.

1. Crie uma conta grátis em duckdns.org
2. Registre um subdomínio (ex: `mills-frotas.duckdns.org`) apontado pro seu
   IP público atual
3. Instale o cliente de atualização automática deles, pra manter o
   hostname certo mesmo se o IP mudar

Sem isso, dá pra usar o IP puro direto — só fica sem HTTPS (ver
`Caddyfile.example`, bloco comentado).

## 5. Instalar e configurar o Caddy

Servidor web de um arquivo só, que já resolve HTTPS automático (Let's
Encrypt) sem configuração manual de certificado.

1. Baixe em caddyserver.com/download (build Windows)
2. Copie `Caddyfile.example` (na raiz deste repositório) pra `Caddyfile`
   (sem extensão), na mesma pasta do `caddy.exe`
3. Ajuste o hostname e o caminho completo pra `dist-local` dentro do arquivo

## 6. Rodar o Caddy como serviço do Windows

Pra não cair se alguém deslogar ou reiniciar o PC:

```
caddy.exe windows-service /install
net start caddy
```

## 7. Firewall do Windows

Painel de Controle → Firewall do Windows Defender → Configurações
Avançadas → Regras de Entrada → Nova Regra → Porta → TCP → **80 e 443** →
Permitir.

## 8. Roteador

- **Reserve um IP local fixo** pro PC que vai servir o site (DHCP
  Reservation, na configuração do roteador) — sem isso, o encaminhamento de
  porta quebra toda vez que o PC pegar outro IP local na rede.
- **Encaminhamento de porta** (Port Forwarding/Virtual Server): porta
  externa **80 e 443** → IP local do PC, mesma porta.

## 9. Testar

Acesse `https://<seu-hostname>.duckdns.org` de **fora da sua rede** (ex: 4G
do celular, sem Wi-Fi) — testar de dentro da mesma rede pode "funcionar"
mesmo com o encaminhamento de porta errado, por causa de como o roteador
resolve o próprio hostname internamente.

## 10. (Opcional, preventivo) Firebase Auth

Console do Firebase → Authentication → Settings → Authorized domains →
adicione o novo hostname. O login deste app é email/senha (não OAuth), que
normalmente não depende dessa lista — mas não custa adicionar preventivamente.

## Se precisar atualizar depois de uma mudança no código

Sempre que o código mudar (novo commit em `main`), repita a partir do passo 1
(`git pull`, `npm install` se mudou dependência, `npm run build:local`) —
o Caddy não precisa reiniciar, ele serve os arquivos de `dist-local/`
diretamente e reflete a atualização assim que o build novo terminar.
