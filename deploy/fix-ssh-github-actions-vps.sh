#!/usr/bin/env bash
# Libera SSH para GitHub Actions e outros IPs (roda UMA VEZ no VPS).
set -euo pipefail

echo "==> fail2ban"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status sshd 2>/dev/null || true
  fail2ban-client unban --all 2>/dev/null || true
  echo "   Bans removidos"
else
  echo "   fail2ban não instalado"
fi

echo ""
echo "==> UFW"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp comment 'SSH GitHub Actions'
  ufw reload
  ufw status | head -20
else
  echo "   UFW inativo"
fi

echo ""
echo "==> sshd"
systemctl is-active ssh || systemctl is-active sshd
ss -tlnp | grep ':22 '

echo ""
echo "==> Hostinger"
echo "   hPanel -> VPS -> Security -> Firewall -> permita TCP 22 de ANY (0.0.0.0/0)"
echo "   Sem isso, runners do GitHub Actions continuam bloqueados."

echo ""
echo "==> Teste local SSH daemon"
timeout 3 bash -c 'echo | nc -w2 127.0.0.1 22' && echo "   sshd responde na porta 22" || echo "   sshd NÃO responde"

echo "Concluído."
