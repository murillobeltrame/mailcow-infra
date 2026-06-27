# Nive Mail — infraestrutura Mailcow

Repositório de deploy e operação do **Nive Mail** (Mailcow self-hosted) no VPS Hostinger.

Repositório: https://github.com/murillobeltrame/mailcow-infra

## Produção

| Item | Valor |
|------|--------|
| Painel | https://mail.nivesistemas.com.br/admin |
| Hostname SMTP/IMAP | `mail.nivesistemas.com.br` |
| Domínio principal | `nivesistemas.com.br` |
| Domínio adicional | `corelycommerce.com.br` (mesmo servidor) |
| Webmail SOGo | Desativado — use Thunderbird, Outlook ou app mobile (IMAP) |
| Login admin | usuário `admin` + senha no secret `MAILCOW_PASS` |

**PTR/rDNS (manual no hPanel Hostinger):** `2.25.181.76` → `mail.nivesistemas.com.br`

---

## Deploy pelo GitHub (recomendado)

O deploy roda via **GitHub Actions**. Ao fazer push em `branding/` ou `deploy/`, o workflow reaplica o **branding Nive Mail** automaticamente.

### 1. Configurar Secrets

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `VPS_SSH_PASS` | sim* | Senha SSH do root no VPS |
| `VPS_SSH_KEY` | sim* | Chave SSH privada (alternativa à senha) |
| `MAILCOW_PASS` | sim | Senha admin Mailcow |
| `MAILCOW_API_KEY` | sim | API key Mailcow |
| `CLOUDFLARE_API_TOKEN` | sim | Token Cloudflare (DNS) |
| `CLOUDFLARE_ZONE_ID` | sim | Zona `nivesistemas.com.br` |
| `VPS_IP` | não | Padrão: `2.25.181.76` |
| `VPS_USER` | não | Padrão: `root` |
| `MAILCOW_HOSTNAME` | não | Padrão: `mail.nivesistemas.com.br` |
| `MAIL_DOMAIN` | não | Padrão: `nivesistemas.com.br` |
| `EXTRA_MAIL_DOMAIN` | não | Ex.: `corelycommerce.com.br` |
| `EXTRA_CLOUDFLARE_ZONE_ID` | não | Zona do domínio extra |
| `CLOUDFLARE_ACCOUNT_ID` | não | Conta Cloudflare |
| `MAILCOW_IPV4_NETWORK` | não | Padrão: `172.23.1` |
| `MAILCOW_TZ` | não | Padrão: `America/Sao_Paulo` |

\* Use `VPS_SSH_PASS` **ou** `VPS_SSH_KEY` (chave privada completa, incluindo `-----BEGIN...`).

Valores de referência estão em `deploy/.env.deploy.example`.

### 2. Executar deploy

**Automático** — push na branch `master`/`main` alterando `branding/` ou `deploy/`:

```bash
git push origin master
```

**Manual** — GitHub → **Actions** → **Deploy Nive Mail** → **Run workflow** → escolha o comando:

| Comando | Uso |
|---------|-----|
| `branding` | Reaplica logo e CSS Nive Mail (padrão no push) |
| `update` | Atualiza Mailcow upstream + branding |
| `dns` | Cloudflare: A, MX, SPF, DMARC |
| `dns-dkim` | Cloudflare: + DKIM |
| `validate` | Health check |
| `setup` | Instala Mailcow no VPS |
| `full` | Instalação completa (VPS novo) |
| `tune` | Swap + performance |
| `ssl` / `ssl-fix` | Certificado HTTPS |
| `reset-admin` | Reset senha admin |

### 3. Variável opcional

Em **Settings → Secrets and variables → Actions → Variables**:

| Variable | Padrão | Descrição |
|----------|--------|-----------|
| `DEPLOY_DKIM_WAIT_SEC` | `120` | Espera antes do DKIM no comando `full` |

---

## Deploy local (alternativo)

Para testes na sua máquina:

```powershell
cd deploy
npm install
node deploy.mjs init
# edite deploy/.env.deploy
node deploy.mjs branding
```

> **Nunca commite** `deploy/.env.deploy`.

---

## Clientes de e-mail

| Protocolo | Servidor | Porta |
|-----------|----------|-------|
| IMAP (SSL) | `mail.nivesistemas.com.br` | 993 |
| SMTP (STARTTLS) | `mail.nivesistemas.com.br` | 587 |
| SMTP (SSL) | `mail.nivesistemas.com.br` | 465 |

## DNS e Cloudflare

- Registros de **e-mail** (`A`, `MX`, `SPF`, `DKIM`, `DMARC`) em **DNS only** (nuvem cinza).
- Painel admin: HTTPS direto no VPS (Let's Encrypt via Mailcow).

## Estrutura do repositório

```
mailcow-infra/
  .github/workflows/deploy.yml   # CI/CD GitHub Actions
  branding/                    # Logo SVG + CSS Nive Mail
  deploy/
    deploy.mjs                   # CLI de deploy
    ci-write-env.mjs             # monta .env.deploy a partir dos secrets
    lib/env.mjs                  # loader de config (local + CI)
    .env.deploy.example
    setup-mailcow.sh
    update-mailcow.sh
    validate-mailcow.sh
    configure-dns.mjs
    apply-nive-branding.sh
    upload-nive-branding.mjs
    ...
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized

## Identidade visual

O painel exibe **Nive Mail**. Após updates do Mailcow, faça push em `branding/` ou rode o workflow com comando `branding`.
