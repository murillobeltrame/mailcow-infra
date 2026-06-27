# Deploy Mailcow — passo a passo

> Preferir `node deploy.mjs …` (SSH local). Use GitHub Actions (`full`) para instalação versionada em VPS novo.

## 1. Secrets locais

```powershell
cd deploy
node deploy.mjs init
node generate-secrets.mjs
# preencha VPS_SSH_PASS e CLOUDFLARE_API_TOKEN em .env.deploy
```

## 2. Instalar no VPS

```powershell
npm install
node deploy.mjs setup
# ou, via Actions: gh workflow run "Deploy Nive Mail" -f command=full
```

O script:
- clona `mailcow-dockerized` em `/opt/mailcow-dockerized`
- desabilita ClamAV/Solr (economia de RAM)
- sobe ~15 containers Docker

Tempo estimado: **10–20 minutos** (download de imagens).

## 3. DNS Cloudflare

```powershell
node deploy.mjs dns
# aguarde Mailcow gerar DKIM
node deploy.mjs dns-dkim
```

## 4. PTR/rDNS (manual — Hostinger hPanel)

Em **VPS → Configurações → Reverse DNS**:

```
2.25.181.76 → mail.nivesistemas.com.br
```

Sem PTR, Gmail/Outlook tendem a rejeitar ou marcar como spam.

## 5. Primeiro login

1. Acesse https://mail.nivesistemas.com.br/admin
2. Login: `admin` / senha de `MAILCOW_PASS`
3. **Configuration → Mail setup → Domains** → adicionar domínios
4. **Configuration → Mail setup → Mailboxes** → criar caixas

## 6. Validar

```powershell
node deploy.mjs validate
```

Teste externo:

```bash
dig MX nivesistemas.com.br +short
openssl s_client -connect mail.nivesistemas.com.br:993 -brief
```

## Domínio adicional

```powershell
node deploy.mjs ssh add-domain-vps.sh
node deploy.mjs dns-dkim
```
