# Nive Mail Web — build multi-stage
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV COOKIE_PATH=/mail/
ENV IMAP_HOST=dovecot-mailcow
ENV IMAP_PORT=993
ENV SMTP_HOST=postfix-mailcow
ENV SMTP_PORT=587
ENV FRONTEND_DIST=/app/public

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=server-build /app/server/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "dist/index.js"]
