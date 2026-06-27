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

## Dois fluxos de deploy

| | SSH local | GitHub Actions |
|---|-----------|----------------|
| **Para quê** | Configuração, DNS, caixas, validação, fixes | Código versionado (branding, scripts) |
| **Velocidade** | Imediato | Após commit + push |
| **Exemplo** | `node deploy.mjs validate` | `git push origin master` |

O pipeline de Actions fica **sempre preparado** — mudanças em `branding/` ou `deploy/` disparam deploy automaticamente. Para operação e desenvolvimento, prefira SSH local.

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
  branding/                      # Logo + CSS Nive Mail
  deploy/                        # Scripts (SSH local + Actions)
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized
