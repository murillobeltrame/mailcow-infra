#!/usr/bin/env bash
# Valida autenticação SMTP/IMAP das caixas principais.
set -euo pipefail

PASS="${MAILCOW_PASS:?}"

python3 - <<'PY'
import imaplib, smtplib, ssl, os, sys

pw = os.environ["MAILCOW_PASS"]
accounts = [
    "contato@nivesistemas.com.br",
    "contato@corelycommerce.com.br",
    "noreply@nivesistemas.com.br",
    "noreply@corelycommerce.com.br",
]
ok = True
for user in accounts:
    try:
        m = imaplib.IMAP4_SSL("127.0.0.1", 993)
        m.login(user, pw)
        m.logout()
        print(f"IMAP OK: {user}")
    except Exception as e:
        ok = False
        print(f"IMAP FAIL: {user} — {e}")

user = accounts[0]
try:
    s = smtplib.SMTP_SSL("127.0.0.1", 465, timeout=15)
    s.login(user, pw)
    s.quit()
    print(f"SMTP OK: {user} (465)")
except Exception as e:
    ok = False
    print(f"SMTP FAIL: {user} — {e}")

sys.exit(0 if ok else 1)
PY
