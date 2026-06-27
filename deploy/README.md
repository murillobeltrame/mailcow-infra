# Deploy — Nive Mail

Dois fluxos complementares:

| Fluxo | Quando usar | Como |
|-------|-------------|------|
| **SSH local** | Configuração, DNS, caixas, validação, fixes rápidos | `node deploy.mjs …` na sua máquina |
| **GitHub Actions** | Código versionado (branding, scripts, melhorias) | `git push` ou workflow manual |

O deploy via Actions fica **sempre preparado** — qualquer mudança em `branding/` ou `deploy/` dispara o pipeline. Para operação do dia a dia, use SSH local: é mais rápido e não exige commit.

---

## SSH local (desenvolvimento e configuração)

Requisitos: `deploy/.env.deploy` preenchido (veja [Setup inicial](#setup-inicial-uma-vez)).

```powershell
cd deploy

# Health check
node deploy.mjs validate

# DNS Cloudflare
node deploy.mjs dns
node deploy.mjs dns-dkim

# Migração de e-mail (domínios + caixas + DNS)
node deploy.mjs migrate-email

# Script arbitrário no VPS
node deploy.mjs ssh fix-mail-vps-standalone.sh
node deploy.mjs ssh add-domain-vps.sh

# Preview de logo/CSS sem commit (dev)
node deploy.mjs branding-local

# SSL, API, bootstrap…
node deploy.mjs ssl-fix
node deploy.mjs test-api
node deploy.mjs bootstrap
```

Comandos locais **não** exigem GitHub Actions. Usam `_ssh-run.mjs` com retry de conexão SSH.

---

## GitHub Actions (código e release)

Use quando alterar arquivos versionados no repositório:

```bash
git add branding/nive-logo.svg deploy/fix-mail-vps.sh
git commit -m "Atualiza logo e script de fix"
git push origin master
```

Acompanhe: https://github.com/murillobeltrame/mailcow-infra/actions

Push em `branding/` ou `deploy/` dispara **`branding`** automaticamente.

### Comandos bloqueados localmente

Estes publicam código do repo — o CLI orienta usar Actions:

| Comando | Motivo |
|---------|--------|
| `branding` | Logo/CSS versionados |
| `update` | Mailcow upstream + branding |
| `full` | Instalação completa |

Alternativas locais:

- **`branding-local`** — mesmo efeito do branding, sem commit (só dev/preview)
- **`ALLOW_LOCAL_DEPLOY=1`** — emergência se Actions estiver indisponível

```powershell
$env:ALLOW_LOCAL_DEPLOY="1"
node deploy.mjs branding
node deploy.mjs update
```

### Workflow manual

**Site:** Actions → **Deploy Nive Mail** → Run workflow → escolha o comando.

**CLI:**

```powershell
gh workflow run "Deploy Nive Mail" -f command=update
gh workflow run "Deploy Nive Mail" -f command=validate
gh workflow run "Deploy Nive Mail" -f command=dns-dkim
```

### Comandos no Actions

| Comando | Uso |
|---------|-----|
| `branding` | Logo + CSS *(padrão no push)* |
| `update` | Mailcow upstream + branding |
| `dns` / `dns-dkim` | Cloudflare |
| `validate` | Health check |
| `migrate-email` | Migração completa |
| `full` | Instalação VPS novo |
| `setup` / `tune` / `ssl` / … | Operações SSH |

---

## Setup inicial (uma vez)

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

## Cenários

| Objetivo | Ação recomendada |
|----------|------------------|
| Testar fix no VPS agora | `node deploy.mjs ssh fix-….sh` |
| Ajustar DNS / DKIM | `node deploy.mjs dns-dkim` |
| Validar produção | `node deploy.mjs validate` |
| Mudou logo/CSS no repo | `git push` → Actions |
| Mudou script de deploy | `git push` (ou workflow `update`) |
| Preview logo antes do commit | `node deploy.mjs branding-local` |
| Atualizar Mailcow upstream | workflow `update` |
| VPS novo | workflow `full` |

---

## Solução de problemas

**SSH local OK, Actions timeout na porta 22:** libere TCP 22 no hPanel Hostinger para runners GitHub; rode `fix-ssh-github-actions-vps.sh` no VPS.

**Workflow falhou nos secrets:** rode `node sync-github-secrets.mjs` e tente de novo.

**Branding sumiu após update:** workflow `update` ou `branding-local` / push.

**PTR/rDNS:** manual no hPanel — `2.25.181.76` → `mail.nivesistemas.com.br`

---

## Scripts

| Arquivo | Função |
|---------|--------|
| `deploy.mjs` | CLI (SSH local + gate de release) |
| `_ssh-run.mjs` | SSH local sem bloqueio CI |
| `_ssh-deploy.mjs` | Legado — preferir `_ssh-run.mjs` |
| `ci-write-env.mjs` | Monta `.env.deploy` no Actions |
| `sync-github-secrets.mjs` | Local → GitHub Secrets |
| `upload-nive-branding.mjs` | Branding no VPS |
| `configure-dns.mjs` | DNS Cloudflare |
| `setup-mailcow.sh` / `update-mailcow.sh` / … | Operações SSH |
