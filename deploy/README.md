# Deploy — Nive Mail

Deploy **somente via GitHub Actions**. Scripts locais que tocam o VPS estão bloqueados de propósito.

## Fluxo padrão

```
editar arquivos → git commit → git push → GitHub Actions → VPS
```

```bash
git add branding/nive-logo.svg
git commit -m "Atualiza logo Nive Mail"
git push origin master
```

Acompanhe: https://github.com/murillobeltrame/mailcow-infra/actions

Push em `branding/` ou `deploy/` dispara **`branding`** automaticamente.

---

## O que NÃO fazer

```powershell
# ❌ bloqueado localmente
node deploy.mjs branding
node upload-nive-branding.mjs
```

Use **commit + push** ou o workflow manual no GitHub.

Emergência (só se Actions estiver fora):

```powershell
$env:ALLOW_LOCAL_DEPLOY="1"
node deploy.mjs branding
```

---

## Setup inicial (uma vez, local)

Só estes comandos rodam na sua máquina:

```powershell
cd deploy
npm install
node deploy.mjs init              # cria .env.deploy
# edite deploy/.env.deploy
node sync-github-secrets.mjs      # envia secrets ao GitHub (gh auth login)
```

> **Nunca commite** `deploy/.env.deploy`.

### Secrets obrigatórios no GitHub

| Secret | Descrição |
|--------|-----------|
| `VPS_SSH_PASS` | Senha SSH *(ou `VPS_SSH_KEY`)* |
| `MAILCOW_PASS` | Senha admin Mailcow |
| `MAILCOW_API_KEY` | API key Mailcow |
| `CLOUDFLARE_API_TOKEN` | Token DNS Cloudflare |
| `CLOUDFLARE_ZONE_ID` | Zona `nivesistemas.com.br` |

Opcionais com padrão: `VPS_IP`, `MAILCOW_HOSTNAME`, `MAIL_DOMAIN`, etc. — veja `.env.deploy.example`.

---

## GitHub Actions

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

### Manual

**Site:** Actions → **Deploy Nive Mail** → Run workflow → escolha o comando.

**CLI:**

```powershell
gh workflow run "Deploy Nive Mail" -f command=update
gh workflow run "Deploy Nive Mail" -f command=validate
gh workflow run "Deploy Nive Mail" -f command=dns-dkim
```

### Comandos

| Comando | Uso |
|---------|-----|
| `branding` | Logo + CSS *(padrão no push)* |
| `update` | Mailcow upstream + branding |
| `dns` | A, MX, SPF, DMARC |
| `dns-dkim` | + DKIM |
| `validate` | Health check |
| `full` | Instalação VPS novo |
| `setup` | Instala Mailcow |
| `tune` | Performance + swap |
| `ssl` / `ssl-fix` | HTTPS |
| `reset-admin` | Reset senha admin |

---

## Cenários

| Objetivo | Ação |
|----------|------|
| Mudou logo/CSS | `git push` |
| Mudou script de deploy | `git push` (ou workflow `branding`/`update`) |
| Atualizar Mailcow | workflow `update` |
| Só DNS | workflow `dns` / `dns-dkim` |
| VPS novo | workflow `full` |

---

## Solução de problemas

**Workflow falhou nos secrets:** rode `node sync-github-secrets.mjs` e tente de novo.

**Branding sumiu após update:** workflow `update` ou `branding`.

**PTR/rDNS:** manual no hPanel — `2.25.181.76` → `mail.nivesistemas.com.br`

---

## Scripts (executados pelo Actions)

| Arquivo | Função |
|---------|--------|
| `deploy.mjs` | CLI (só no CI) |
| `ci-write-env.mjs` | Monta `.env.deploy` no Actions |
| `sync-github-secrets.mjs` | Local → GitHub Secrets |
| `upload-nive-branding.mjs` | Branding no VPS |
| `configure-dns.mjs` | DNS Cloudflare |
| `setup-mailcow.sh` / `update-mailcow.sh` / … | Operações SSH |
