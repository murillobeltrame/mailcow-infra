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

## Deploy (GitHub only)

**Não faça deploy direto no VPS.** O fluxo é sempre:

```bash
git add .
git commit -m "sua alteração"
git push origin master
```

O **GitHub Actions** aplica no servidor automaticamente quando há push em `branding/` ou `deploy/`.

Documentação completa: **[deploy/README.md](deploy/README.md)**

### Setup inicial (uma vez)

```powershell
cd deploy
npm install
node deploy.mjs init
# edite deploy/.env.deploy
node sync-github-secrets.mjs   # copia secrets para o GitHub
```

### Operações no VPS

| Objetivo | Como fazer |
|----------|------------|
| Logo, CSS, scripts | `git push` (automático) |
| Atualizar Mailcow | Actions → **Deploy Nive Mail** → `update` |
| DNS / DKIM | Actions → comando `dns` ou `dns-dkim` |
| VPS novo | Actions → comando `full` |
| Health check | Actions → comando `validate` |

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
  .github/workflows/deploy.yml   # CI/CD — único caminho para o VPS
  branding/                      # Logo + CSS Nive Mail
  deploy/                        # Scripts (executados pelo Actions)
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized
