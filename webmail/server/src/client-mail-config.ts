import { config } from "./config.js";

export type ClientMailSettings = {
  email: string;
  hostname: string;
  incoming: {
    label: string;
    server: string;
    port: number;
    security: string;
    username: string;
  };
  outgoing: {
    label: string;
    server: string;
    port: number;
    security: string;
    username: string;
    authentication: string;
  };
  outgoingAlternate: {
    label: string;
    server: string;
    port: number;
    security: string;
    username: string;
  };
};

export function buildClientMailSettings(email: string): ClientMailSettings {
  const host = config.clientMailHost;

  return {
    email,
    hostname: host,
    incoming: {
      label: "IMAP (recomendado)",
      server: host,
      port: parseInt(process.env.CLIENT_IMAP_PORT ?? "993", 10),
      security: "SSL/TLS",
      username: email,
    },
    outgoing: {
      label: "SMTP",
      server: host,
      port: parseInt(process.env.CLIENT_SMTP_PORT ?? "587", 10),
      security: "STARTTLS",
      username: email,
      authentication: "Obrigatória (mesma senha do login)",
    },
    outgoingAlternate: {
      label: "SMTP (alternativa)",
      server: host,
      port: parseInt(process.env.CLIENT_SMTP_PORT_SSL ?? "465", 10),
      security: "SSL/TLS",
      username: email,
    },
  };
}

export function formatClientMailSettingsText(settings: ClientMailSettings): string {
  const { incoming: in_, outgoing: out, outgoingAlternate: alt } = settings;

  return [
    `Configuração de e-mail — ${settings.email}`,
    "",
    "Entrada (IMAP)",
    `  Servidor: ${in_.server}`,
    `  Porta: ${in_.port}`,
    `  Segurança: ${in_.security}`,
    `  Usuário: ${in_.username}`,
    "",
    "Saída (SMTP)",
    `  Servidor: ${out.server}`,
    `  Porta: ${out.port}`,
    `  Segurança: ${out.security}`,
    `  Usuário: ${out.username}`,
    "  Autenticação: obrigatória",
    "",
    "SMTP alternativo",
    `  Porta: ${alt.port}`,
    `  Segurança: ${alt.security}`,
    "",
    "Senha: use a senha da sua conta ou uma senha de aplicativo.",
  ].join("\n");
}
