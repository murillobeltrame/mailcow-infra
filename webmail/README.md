# Nive Mail Web

Webmail moderno para o **Nive Mail** (Mailcow), com interface estilo Gmail/Outlook.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query |
| Backend | Node.js, Fastify, ImapFlow, Mailparser, Nodemailer |
| Deploy | Docker, nginx reverse proxy em `/mail/` |

## Desenvolvimento local

```powershell
cd webmail
npm install
cd server && npm install && cd ..
cd frontend && npm install && cd ..

# Terminal 1 — API (precisa IMAP/SMTP acessível)
cd server
$env:IMAP_HOST="mail.nivesistemas.com.br"
$env:SMTP_HOST="mail.nivesistemas.com.br"
npm run dev

# Terminal 2 — UI
cd frontend
npm run dev
```

Acesse http://localhost:5176

## Deploy no VPS

```powershell
cd deploy
node deploy.mjs webmail
```

Isso faz upload do código, build da imagem Docker, configura proxy nginx e redireciona o login Mailcow para `/mail/`.

## URLs em produção

| Serviço | URL |
|---------|-----|
| Webmail moderno | https://mail.nivesistemas.com.br/mail/ |
| SOGo (calendário/contatos) | https://mail.nivesistemas.com.br/SOGo/ |
| Painel admin | https://mail.nivesistemas.com.br/admin |

## Funcionalidades

- Login com e-mail e senha da caixa postal
- Pastas (Inbox, Enviados, Rascunhos, Lixeira, etc.)
- Lista e leitura de mensagens
- Busca por assunto/remetente/conteúdo
- Compor e enviar e-mails
- Excluir mensagens
- Tema claro/escuro
- Layout responsivo (mobile + desktop)
