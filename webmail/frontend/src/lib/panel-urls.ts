/** URLs do painel Mailcow (sessão PHP — login em /) */
export const panelUrls = {
  /** Login Mailcow — detecta admin, domainadmin ou usuário */
  login: "/",
  admin: "/admin",
  user: "/user",
  domainAdmin: "/domainadmin",
  sogo: "/SOGo/",
  webmail: "/mail/",
} as const;

export type PanelLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
};

export const panelLinks: PanelLink[] = [
  {
    id: "admin",
    title: "Administração",
    description: "Caixas, domínios, filas, RAM, disco e configuração do servidor.",
    href: panelUrls.login,
    badge: "Admin",
  },
  {
    id: "user",
    title: "Minha conta",
    description: "Senha, app passwords, filtros, calendário e atalho para o webmail.",
    href: panelUrls.login,
    badge: "Usuário",
  },
  {
    id: "sogo",
    title: "Calendário e contactos",
    description: "Agenda e livro de endereços (SOGo).",
    href: panelUrls.sogo,
  },
];
