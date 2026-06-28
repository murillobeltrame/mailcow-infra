#!/usr/bin/env bash
curl -sk -o /dev/null -w "GET /mail/ -> %{http_code}\n" -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/mail/
curl -sk -o /dev/null -w "GET /mail/health -> %{http_code}\n" -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/mail/health
docker ps --format '{{.Names}}: {{.Status}}' | grep nive-mail-web
grep 'Location' /opt/mailcow-dockerized/data/web/index.php | head -3
