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
| Webmail SOGo | Desativado — use Thunderbird, Outlook ou app mobile |
| Login admin | `admin` + senha em `MAILCOW_PASS` (secret GitHub) |
| Nome do painel | **Nive Mail** |

**PTR/rDNS (manual no hPanel):** `2.25.181.76` → `mail.nivesistemas.com.br`

## Deploy

O deploy é feito pelo **GitHub Actions**. Documentação completa: **[deploy/README.md](deploy/README.md)**

### Início rápido

```powershell
cd deploy
npm install
node deploy.mjs init              # cria .env.deploy
# edite deploy/.env.deploy
node sync-github-secrets.mjs      # envia secrets ao GitHub (requer gh auth login)
```

Depois:

- **Push** em `branding/` ou `deploy/` → reaplica branding automaticamente
- **Manual:** Actions → **Deploy Nive Mail** → Run workflow
- **CLI:** `gh workflow run "Deploy Nive Mail" -f command=branding`

### Comandos mais usados (GitHub Actions ou local)

| Comando | Descrição |
|---------|-----------|
| `branding` | Logo + CSS Nive Mail *(padrão no push)* |
| `update` | Atualiza Mailcow + reaplica branding |
| `full` | Instalação completa (VPS novo) |
| `dns` / `dns-dkim` | DNS Cloudflare |
| `validate` | Health check |

Local: `node deploy.mjs <comando>` — veja `node deploy.mjs help`.

## Clientes de e-mail

| Protocolo | Porta |
|-----------|-------|
| IMAP (SSL) | 993 |
| SMTP STARTTLS | 587 |
| SMTP SSL | 465 |

Servidor: `mail.nivesistemas.com.br`

## DNS

Registros de e-mail em **DNS only** (nuvem cinza) no Cloudflare.  
HTTPS do painel: Let's Encrypt automático do Mailcow.

## Estrutura

```
mailcow-infra/
  .github/workflows/deploy.yml   # CI/CD
  branding/                      # Logo + CSS Nive Mail
  deploy/                        # Scripts e CLI → deploy/README.md
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized
