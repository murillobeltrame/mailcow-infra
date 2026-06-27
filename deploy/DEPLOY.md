# Deploy Mailcow — passo a passo

## 1. Secrets locais

```powershell
cd deploy
copy .env.deploy.example .env.deploy
node generate-secrets.mjs
# preencha VPS_SSH_PASS e CLOUDFLARE_API_TOKEN
```

## 2. Instalar no VPS

```powershell
npm install
node _ssh-deploy.mjs "<senha-ssh>" setup-mailcow.sh .env.deploy
```

O script:
- clona `mailcow-dockerized` em `/opt/mailcow-dockerized`
- desabilita ClamAV/Solr (economia de RAM)
- sobe ~15 containers Docker

Tempo estimado: **10–20 minutos** (download de imagens).

## 3. DNS Cloudflare

```powershell
node configure-dns.mjs
# aguarde Mailcow gerar DKIM
node configure-dns.mjs --dkim
```

Registros criados em `corelycommerce.com.br`:

| Tipo | Nome | Valor |
|------|------|-------|
| A | mail | 2.25.181.76 (DNS only) |
| MX | @ | mail.corelycommerce.com.br (prio 10) |
| TXT | @ | SPF |
| TXT | _dmarc | DMARC |
| TXT | dkim._domainkey | DKIM (com --dkim) |

## 4. PTR/rDNS (manual — Hostinger hPanel)

Em **VPS → Configurações → Reverse DNS**:

```
2.25.181.76 → mail.corelycommerce.com.br
```

Sem PTR, Gmail/Outlook tendem a rejeitar ou marcar como spam.

## 5. Primeiro login

1. Acesse https://mail.corelycommerce.com.br/admin
2. Login: `admin` / senha de `MAILCOW_PASS`
3. **Configuration → Mail setup → Domains** → adicionar `corelycommerce.com.br`
4. **Configuration → Mail setup → Mailboxes** → criar caixas

## 6. Validar

```powershell
node _ssh-deploy.mjs "<senha-ssh>" validate-mailcow.sh .env.deploy
```

Teste externo:

```bash
dig MX corelycommerce.com.br +short
openssl s_client -connect mail.corelycommerce.com.br:993 -brief
```

## Domínio adicional (stepgosistemas.com.br)

1. Adicionar domínio no painel Mailcow
2. Criar zona/registros na Cloudflare de `stepgosistemas.com.br`
3. Repetir A/MX/SPF/DKIM/DMARC para esse domínio
