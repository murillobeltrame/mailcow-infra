import { Calendar, ExternalLink, Mail, Server, User } from "lucide-react";
import { panelLinks } from "@/lib/panel-urls";
import { cn } from "@/lib/utils";

const icons = {
  admin: Server,
  user: User,
  sogo: Calendar,
} as const;

type PanelLinksProps = {
  className?: string;
  compact?: boolean;
};

export function PanelLinks({ className, compact }: PanelLinksProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {!compact && (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Painel Mailcow</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gerenciar contas, recursos do servidor e preferências — login separado do webmail.
          </p>
        </div>
      )}

      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-1")}>
        {panelLinks.map((link) => {
          const Icon = icons[link.id as keyof typeof icons] ?? Mail;
          return (
            <a
              key={link.id}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-surface/80 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{link.title}</span>
                  {link.badge && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {link.badge}
                    </span>
                  )}
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{link.description}</p>
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        No login Mailcow use o mesmo endereço{" "}
        <a href="/" className="font-medium text-primary hover:underline">
          mail.nivesistemas.com.br
        </a>
        . Administradores vão para o painel completo; usuários de caixa, para minha conta.
      </p>
    </div>
  );
}
