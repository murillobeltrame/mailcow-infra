import { PenLine, RefreshCw, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { getFolderIcon } from "@/lib/folder-icons";
import type { Folder } from "@/lib/api";
import { cn } from "@/lib/utils";

type FolderRailProps = {
  folders: Folder[];
  activeFolder: string;
  /** Página de escrita aberta: destaca o botão Nova mensagem. */
  composing?: boolean;
  loading: boolean;
  error?: Error | null;
  onSelectFolder: (path: string) => void;
  onCompose: () => void;
  onRetry?: () => void;
  className?: string;
};

export function FolderRail({
  folders,
  activeFolder,
  composing,
  loading,
  error,
  onSelectFolder,
  onCompose,
  onRetry,
  className,
}: FolderRailProps) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <nav
        className={cn(
          "mail-surface flex w-16 shrink-0 flex-col items-center px-1 pb-3 pt-5 sm:w-[4.5rem]",
          className,
        )}
        aria-label="Pastas"
      >
        <BrandMark
          size="md"
          variant="soft"
          className="mb-4 hidden shrink-0 md:flex"
        />

        <Tooltip label="Nova mensagem">
          <button
            type="button"
            onClick={onCompose}
            className={cn(
              "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft transition hover:scale-105 hover:bg-primary/90 active:scale-95",
              composing &&
                "ring-2 ring-primary/40 ring-offset-2 ring-offset-surface",
            )}
            aria-label="Nova mensagem"
            aria-current={composing ? "page" : undefined}
          >
            <PenLine className="block h-5 w-5" />
          </button>
        </Tooltip>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto scrollbar-thin px-1">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-11 shrink-0 rounded-xl" />
            ))}

          {!loading &&
            folders.map((folder) => {
              const Icon = getFolderIcon(folder.specialUse);
              const active = folder.path === activeFolder;
              const unseen = folder.unseen ?? 0;

              return (
                <Tooltip
                  key={folder.path}
                  label={
                    unseen
                      ? `${folder.name} · ${unseen} não lida${unseen === 1 ? "" : "s"}`
                      : folder.name
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelectFolder(folder.path)}
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                    aria-label={`${folder.name}${unseen ? `, ${unseen} não lidas` : ""}`}
                  >
                    <Icon className="block h-5 w-5" />
                    {unseen > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {unseen > 9 ? "9+" : unseen}
                      </span>
                    )}
                  </button>
                </Tooltip>
              );
            })}

          {!loading && folders.length === 0 && (
            <div className="px-1 py-2 text-center">
              <p className="text-[10px] leading-snug text-muted-foreground">
                {error ? "Pastas indisponíveis" : "Nenhuma pasta"}
              </p>
              {error && onRetry && (
                <Tooltip label="Recarregar pastas">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Recarregar pastas"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-col items-center gap-1 border-t border-border/60 pt-3">
          <Tooltip label="Minha conta">
            <Link
              to="/account"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Minha conta"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </Tooltip>
          <Tooltip label="Tema claro/escuro">
            <span className="flex">
              <ThemeToggle variant="ghost" className="h-10 w-10 rounded-xl" />
            </span>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
