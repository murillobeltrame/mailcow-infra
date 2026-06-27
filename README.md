# Mailcow — deploy produção

Infraestrutura para **Mailcow** self-hosted no VPS Hostinger (`2.25.181.76`).

## URLs

| Serviço | URL |
|---------|-----|
| Painel admin | https://mail.corelycommerce.com.br/admin |
| Webmail (SOGo) | https://mail.corelycommerce.com.br/SOGo |
| Hostname SMTP/IMAP | `mail.corelycommerce.com.br` |

Login admin: usuário `admin` + senha definida em `deploy/.env.deploy` (`MAILCOW_PASS`).

## Pré-requisitos

- VPS com **≥ 6 GB RAM** (ClamAV desabilitado neste setup)
- Porta **25** liberada (outbound confirmado na Hostinger)
- Domínio no Cloudflare com API token
- **PTR/rDNS** no hPanel: `mail.corelycommerce.com.br` → `2.25.181.76`

## Deploy inicial

```powershell
cd deploy
npm install
node _ssh-deploy.mjs "<senha-ssh>" setup-mailcow.sh .env.deploy
node configure-dns.mjs
# aguarde 2-5 min
node configure-dns.mjs --dkim
node _ssh-deploy.mjs "<senha-ssh>" validate-mailcow.sh .env.deploy
```

## Atualizar Mailcow

```powershell
node _ssh-deploy.mjs "<senha-ssh>" update-mailcow.sh .env.deploy
```

## Multi-domínio

No painel **Configuration → Mail setup → Domains**, adicione domínios extras (ex.: `stepgosistemas.com.br`) e repita MX/SPF/DKIM/DMARC na zona DNS de cada domínio.

## Importante

- **E-mail (SMTP/IMAP)** não passa pelo Cloudflare Tunnel — registros `A`/`MX` devem estar em **DNS only** (nuvem cinza).
- **Painel e webmail** usam HTTPS direto no VPS (Let's Encrypt automático do Mailcow).
- Nunca commite `deploy/.env.deploy`.

## Estrutura

```
mailcow-infra/
  deploy/
    setup-mailcow.sh      # instalação inicial
    update-mailcow.sh     # git pull + docker compose
    validate-mailcow.sh   # health checks
    configure-dns.mjs     # Cloudflare A/MX/SPF/DMARC/DKIM
    _ssh-deploy.mjs       # executa script no VPS via SSH
```

Mailcow upstream: https://github.com/mailcow/mailcow-dockerized
