# Deploy — Nive Mail

Guia de deploy e operação do Mailcow via **GitHub Actions** (recomendado) ou CLI local.

## Visão geral

```
┌─────────────────┐     push / manual      ┌──────────────────┐     SSH      ┌─────────────┐
│  GitHub repo    │ ─────────────────────► │  GitHub Actions  │ ───────────► │  VPS        │
│  mailcow-infra  │                      │  deploy.yml      │              │  Mailcow    │
└─────────────────┘                      └──────────────────┘              └─────────────┘
                                                    │
                                                    ▼
                                           Cloudflare API (DNS)
```

| Ambiente | O que dispara | Comando padrão |
|----------|---------------|----------------|
| GitHub (push) | Alteração em `branding/` ou `deploy/` | `branding` |
| GitHub (manual) | Actions → Run workflow | você escolhe |
| Local | `node deploy.mjs <cmd>` | conforme comando |

---

## Configuração inicial (uma vez)

### 1. Dependências locais

```powershell
cd deploy
npm install
```

### 2. Arquivo de configuração local

```powershell
node deploy.mjs init
```

Edite `deploy/.env.deploy` com senha SSH, tokens Cloudflare etc.  
Use `node generate-secrets.mjs` se precisar gerar `MAILCOW_PASS` e `MAILCOW_API_KEY`.

> **Nunca commite** `deploy/.env.deploy`.

### 3. Enviar secrets para o GitHub

Com [GitHub CLI](https://cli.github.com/) autenticado (`gh auth login`):

```powershell
node sync-github-secrets.mjs
```

Isso copia os valores de `.env.deploy` para **Settings → Secrets and variables → Actions** do repositório.

Alternativa manual: cadastre cada secret listado abaixo no GitHub.

### 4. Secrets obrigatórios

| Secret | Descrição |
|--------|-----------|
| `VPS_SSH_PASS` | Senha SSH do root *(ou use `VPS_SSH_KEY`)* |
| `MAILCOW_PASS` | Senha do usuário `admin` no Mailcow |
| `MAILCOW_API_KEY` | API key do Mailcow |
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare com permissão DNS |
| `CLOUDFLARE_ZONE_ID` | Zona `nivesistemas.com.br` |

Use **`VPS_SSH_PASS` ou `VPS_SSH_KEY`** — não os dois ao mesmo tempo (chave privada completa, incluindo `-----BEGIN...`).

### 5. Secrets opcionais (têm padrão no código)

| Secret | Padrão |
|--------|--------|
| `VPS_IP` | `2.25.181.76` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `MAILCOW_DIR` | `/opt/mailcow-dockerized` |
| `MAILCOW_HOSTNAME` | `mail.nivesistemas.com.br` |
| `MAILCOW_TZ` | `America/Sao_Paulo` |
| `MAIL_DOMAIN` | `nivesistemas.com.br` |
| `MAILCOW_IPV4_NETWORK` | `172.23.1` |
| `EXTRA_MAIL_DOMAIN` | `corelycommerce.com.br` |
| `EXTRA_CLOUDFLARE_ZONE_ID` | zona Corely |
| `CLOUDFLARE_ACCOUNT_ID` | conta Cloudflare |

Referência completa: `.env.deploy.example`.

---

## Deploy pelo GitHub

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

### Automático (push)

Qualquer push em `master`/`main` que altere `branding/` ou `deploy/` executa **`branding`** (logo + CSS Nive Mail).

```bash
git add branding/
git commit -m "Atualiza identidade Nive Mail"
git push origin master
```

Acompanhe em: https://github.com/murillobeltrame/mailcow-infra/actions

### Manual (Actions ou CLI)

**Pelo site:** Actions → **Deploy Nive Mail** → **Run workflow** → escolha o comando.

**Pelo terminal:**

```powershell
gh workflow run "Deploy Nive Mail" -f command=branding
gh workflow run "Deploy Nive Mail" -f command=update
gh workflow run "Deploy Nive Mail" -f command=validate
```

### Comandos disponíveis no workflow

| Comando | Quando usar |
|---------|-------------|
| `branding` | Reaplica logo, textos e CSS Nive Mail |
| `update` | Atualiza Mailcow upstream + reaplica branding |
| `dns` | Cloudflare: A, MX, SPF, DMARC |
| `dns-dkim` | Cloudflare: + DKIM (Mailcow já rodando) |
| `validate` | Health check (portas, HTTPS, DKIM) |
| `setup` | Instala Mailcow no VPS |
| `full` | Instalação completa em VPS novo |
| `tune` | Swap + otimizações de performance |
| `ssl` | Renova Let's Encrypt |
| `ssl-fix` | Corrige problemas de HTTPS |
| `reset-admin` | Reset senha admin (`MAILCOW_PASS`) |
| `bootstrap` | Bootstrap domínio no MySQL |
| `disable-sogo` | Desativa SOGo |
| `test-api` | Testa API Mailcow |

### Variável opcional (GitHub Variables)

| Variable | Padrão | Uso |
|----------|--------|-----|
| `DEPLOY_DKIM_WAIT_SEC` | `120` | Segundos de espera antes do DKIM no comando `full` |

---

## Cenários comuns

### VPS novo (instalação completa)

1. Configure secrets (`sync-github-secrets.mjs`)
2. Execute no GitHub Actions: comando **`full`**

Fluxo interno: `setup` → `dns` → aguarda → `dns-dkim` → `branding` → `tune` → `validate`.

### Servidor já em produção

| Objetivo | Ação |
|----------|------|
| Mudou logo/CSS | Push em `branding/` ou workflow `branding` |
| Atualizar Mailcow | Workflow `update` |
| Só DNS | Workflow `dns` ou `dns-dkim` |
| Verificar saúde | Workflow `validate` |

### Deploy local (fallback)

Mesmos comandos, usando `.env.deploy` local:

```powershell
cd deploy
node deploy.mjs branding
node deploy.mjs update
node deploy.mjs validate
node deploy.mjs help
```

Atalhos npm:

```powershell
npm run branding
npm run update
npm run validate
npm run dns
npm run dns:dkim
```

---

## Solução de problemas

### Workflow falhou em "Create deploy/.env.deploy from secrets"

Os secrets ainda não estavam configurados. Rode `node sync-github-secrets.mjs` e dispare o workflow de novo.

### Branding sumiu após update do Mailcow

Execute workflow **`update`** (já reaplica branding) ou só **`branding`**.

### DKIM não publicado

1. Confirme Mailcow rodando (`validate`)
2. Execute `dns-dkim`
3. Aguarde 2–5 min após primeiro boot antes do DKIM

### PTR/rDNS

Configuração **manual** no hPanel Hostinger:

`2.25.181.76` → `mail.nivesistemas.com.br`

---

## Scripts do repositório

| Arquivo | Função |
|---------|--------|
| `deploy.mjs` | CLI principal |
| `ci-write-env.mjs` | Monta `.env.deploy` no GitHub Actions |
| `sync-github-secrets.mjs` | Envia `.env.deploy` → GitHub Secrets |
| `configure-dns.mjs` | DNS Cloudflare |
| `upload-nive-branding.mjs` | Envia assets + aplica branding |
| `apply-nive-branding.sh` | Branding no VPS (via SSH) |
| `setup-mailcow.sh` | Instalação Mailcow |
| `update-mailcow.sh` | Atualização upstream |
| `validate-mailcow.sh` | Health checks |
| `reset-admin-password.sh` | Reset senha admin |
| `fix-ssl.sh` / `renew-ssl.sh` | Certificados HTTPS |
| `tune-performance.sh` | Swap + performance |
| `disable-sogo.sh` | Desativa SOGo |
| `migrate-hostname.sh` | Troca hostname |
| `bootstrap-domain-db.sh` | Domínio inicial no banco |
| `_ssh-deploy.mjs` / `_ssh-run.mjs` | SSH helpers |
| `lib/env.mjs` | Loader de config (local + CI) |
