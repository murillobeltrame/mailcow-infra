/** URLs do portal Nive Mail e legado Mailcow (FIDO2 / reset senha) */
export const panelUrls = {
  /** Login Mailcow PHP — FIDO2 e reset senha */
  login: "/",
  resetPassword: "/reset-password",
  /** Portal React (preferir estes) */
  webmail: "/mail/",
  account: "/mail/account",
  admin: "/mail/admin",
  domain: "/mail/domain",
  calendar: "/mail/calendar",
  contacts: "/mail/contacts",
  /** Legado (nginx redireciona para portal) */
  user: "/user",
  domainAdmin: "/domainadmin",
  sogo: "/SOGo/",
} as const;

export type PanelLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  internal?: boolean;
  badge?: string;
};

export const panelLinks: PanelLink[] = [
  {
    id: "admin",
    title: "Administração",
    description: "Caixas, domínios, filas, RAM, disco e configuração do servidor.",
    href: panelUrls.admin,
    internal: true,
    badge: "Admin",
  },
  {
    id: "user",
    title: "Minha conta",
    description: "Senha, app passwords, filtros Sieve e preferências.",
    href: panelUrls.account,
    internal: true,
    badge: "Usuário",
  },
  {
    id: "sogo",
    title: "Calendário e contactos",
    description: "Agenda e livro de endereços no portal Nive.",
    href: panelUrls.calendar,
    internal: true,
  },
];
