# Nive Mail — infraestrutura Mailcow

Repositório de deploy e operação do **Nive Mail** (Mailcow self-hosted) no VPS Hostinger.

- Repositório: https://github.com/murillobeltrame/mailcow-infra
- Painel: https://mail.nivesistemas.com.br/admin
- Actions: https://github.com/murillobeltrame/mailcow-infra/actions

## Produção

| Item | Valor |
|------|--------|
| Hostname SMTP/IMAP | `mail.nivesistemas.com.br` |
| Domínio principal | `nivesistemas.com.br` |
| Domínio adicional | `corelycommerce.com.br` |
| Webmail moderno | https://mail.nivesistemas.com.br/mail/ — React + Tailwind |
| Painel admin (RAM, caixas, domínios) | https://mail.nivesistemas.com.br/admin |
| Painel usuário (conta, senha, apps) | https://mail.nivesistemas.com.br/user |
| Login Mailcow (admin + usuário) | https://mail.nivesistemas.com.br/ |
| Calendário / contactos (SOGo) | https://mail.nivesistemas.com.br/SOGo |
| Login admin | `admin` + senha em `MAILCOW_PASS` (secret GitHub) |
| Nome do painel | **Nive Mail** |
| Idioma padrão | **Português (Brasil)** — painel admin e SOGo |

**PTR/rDNS (manual no hPanel):** `2.25.181.76` → `mail.nivesistemas.com.br`

## Dois fluxos de deploy

| | SSH local (PC) | GitHub Actions |
|---|----------------|----------------|
| **Para quê** | Diagnóstico, DNS, validação | Código versionado (webmail, branding) |
| **Como** | `node deploy.mjs ssh …` | `git push` → **runner no VPS** (igual sistemaloja) |
| **Porta 22** | Do seu PC | Não precisa abrir para nuvem GitHub |

O deploy automático usa **self-hosted runner** (`vps-hostinger`) no mesmo VPS do Sistema Loja — não SSH da nuvem GitHub.

Documentação completa: **[deploy/README.md](deploy/README.md)**

### Setup inicial (uma vez)

```powershell
cd deploy
npm install
node deploy.mjs init
# edite deploy/.env.deploy
node sync-github-secrets.mjs   # copia secrets para o GitHub
```

### Operações comuns

| Objetivo | Como fazer |
|----------|------------|
| Health check, DNS, migração | `node deploy.mjs validate` / `dns` / `migrate-email` |
| Script no VPS | `node deploy.mjs ssh <script.sh>` |
| Preview logo (sem commit) | `node deploy.mjs branding-local` |
| Logo, CSS, scripts no repo | `git push` → Actions |
| Atualizar Mailcow | Actions → **Deploy Nive Mail** → `update` |
| VPS novo | Actions → comando `full` |

Ou via CLI: `gh workflow run "Deploy Nive Mail" -f command=branding`

## Clientes de e-mail

| Protocolo | Porta |
|-----------|-------|
| IMAP (SSL) | 993 |
| SMTP STARTTLS | 587 |
| SMTP SSL | 465 |

Servidor: `mail.nivesistemas.com.br`

## DNS

Registros de e-mail em **DNS only** (nuvem cinza) no Cloudflare.

## Estrutura

```
mailcow-infra/
  .github/workflows/deploy.yml   # CI/CD — release de código
  branding/                      # Logo + CSS Nive Mail (admin + SOGo)
  webmail/                       # Webmail moderno React + IMAP API
  deploy/                        # Scripts (SSH local + Actions)
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized
