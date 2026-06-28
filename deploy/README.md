# Deploy — Nive Mail

Dois fluxos complementares:

| Fluxo | Quando usar | Como |
|-------|-------------|------|
| **GitHub Actions** | Código versionado (webmail, branding, scripts de deploy) | `git commit` + `git push` |
| **SSH local** | Diagnóstico, DNS, validação, fixes pontuais no VPS | `node deploy.mjs ssh …` |

**Regra:** alterações em `webmail/`, `branding/` ou `deploy/` → **commit e push**. O Actions detecta o que mudou e roda `webmail` e/ou `branding`. SSH local fica para investigar problemas difíceis (`ssh`, `validate`), não para publicar código.

---

## GitHub Actions (produção)

```bash
git add webmail/ branding/ deploy/
git commit -m "Descrição da mudança"
git push origin master
```

O workflow **Deploy Nive Mail** dispara automaticamente:

| Pastas alteradas | Comando no VPS |
|------------------|----------------|
| `webmail/**` | `webmail` (build Docker + nginx + redirects) |
| `branding/**` ou `deploy/**` | `branding` (logo, CSS, SOGo) |
| Ambas | os dois, em sequência |

Acompanhe: https://github.com/murillobeltrame/mailcow-infra/actions

### Workflow manual

```powershell
gh workflow run "Deploy Nive Mail" -f command=webmail
gh workflow run "Deploy Nive Mail" -f command=branding
gh workflow run "Deploy Nive Mail" -f command=validate
```

### Comandos bloqueados localmente

| Comando | Use em vez disso |
|---------|------------------|
| `branding` | `git push` |
| `webmail` | `git push` |
| `update` / `full` | workflow manual |

Emergência: `ALLOW_LOCAL_DEPLOY=1 node deploy.mjs webmail`

---

## SSH local (diagnóstico e operação)

Requisitos: `deploy/.env.deploy` preenchido.

```powershell
cd deploy

# Diagnóstico / investigação no VPS
node deploy.mjs ssh verify-webmail.sh
node deploy.mjs ssh fix-sogo-all.sh

# Health check, DNS, migração
node deploy.mjs validate
node deploy.mjs dns-dkim
node deploy.mjs migrate-email

# Preview de logo/CSS antes do commit (dev)
node deploy.mjs branding-local
```

**Não use** `node deploy.mjs webmail` ou `branding` localmente para produção — faça push.

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
| Mudou webmail / branding / deploy | `git push` → Actions |
| Investigar problema no VPS | `node deploy.mjs ssh <script.sh>` |
| Validar produção | `node deploy.mjs validate` ou workflow `validate` |
| Ajustar DNS / DKIM | `node deploy.mjs dns-dkim` |
| Preview logo antes do commit | `node deploy.mjs branding-local` |
| Atualizar Mailcow upstream | workflow `update` |
| VPS novo | workflow `full` |

---

## Solução de problemas

**SSH local OK, Actions timeout na porta 22:** libere TCP 22 no hPanel Hostinger para runners GitHub; rode `fix-ssh-github-actions-vps.sh` no VPS.

**Workflow falhou nos secrets:** rode `node sync-github-secrets.mjs` e tente de novo.

**Branding sumiu após update:** workflow `update` ou `branding-local` / push.

**PTR/rDNS:** manual no hPanel — `2.25.181.76` → `mail.nivesistemas.com.br`

**SMTP/IMAP com proxy no `mail.*`:** use `smtp.nivesistemas.com.br` (DNS only). O host `mail.nivesistemas.com.br` está proxied no Cloudflare — portas 465/587 **não funcionam** nele. Rode `node ensure-smtp-dns.mjs` se o registro ainda não existir.

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
