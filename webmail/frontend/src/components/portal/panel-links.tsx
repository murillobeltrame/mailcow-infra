import { Calendar, Mail, Server, User } from "lucide-react";
import { Link } from "react-router-dom";
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
          <p className="text-sm font-medium text-foreground">Portal Nive Mail</p>
          <p className="mt-1 text-xs text-muted-foreground">
            E-mail, conta, administração e calendário no mesmo layout.
          </p>
        </div>
      )}

      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-1")}>
        {panelLinks.map((link) => {
          const Icon = icons[link.id as keyof typeof icons] ?? Mail;
          const inner = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{link.title}</span>
                  {link.badge && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {link.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{link.description}</p>
              </div>
            </>
          );

          return link.internal ? (
            <Link
              key={link.id}
              to={link.href.replace(/^\/mail/, "") || "/"}
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-surface/80 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              {inner}
            </Link>
          ) : (
            <a
              key={link.id}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-surface/80 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
