import { Inbox, RefreshCw, Search } from "lucide-react";
import { MessageCard } from "@/components/mail/message-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type InboxPanelProps = {
  folderName: string;
  messages: MessageSummary[];
  selectedUid: number | null;
  loading: boolean;
  refreshing?: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onSelect: (uid: number) => void;
  onRefresh: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export function InboxPanel({
  folderName,
  messages,
  selectedUid,
  loading,
  refreshing = false,
  searchInput,
  onSearchChange,
  onSearchSubmit,
  onSelect,
  onRefresh,
  hasMore,
  loadingMore,
  onLoadMore,
}: InboxPanelProps) {
  return (
    <section className="mail-surface flex w-full shrink-0 flex-col md:w-[340px] lg:w-[380px]">
      <header className="shrink-0 space-y-3 border-b border-border/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{folderName}</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Carregando…" : refreshing ? "Atualizando…" : `${messages.length} mensagen${messages.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
            placeholder="Buscar e-mails…"
            className="search-input"
            aria-label="Buscar e-mails"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl p-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Inbox className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium">Caixa vazia</p>
            <p className="text-xs text-muted-foreground">Nenhum e-mail nesta pasta.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => (
              <MessageCard
                key={msg.uid}
                message={msg}
                selected={selectedUid === msg.uid}
                onSelect={() => onSelect(msg.uid)}
              />
            ))}
            {hasMore && onLoadMore && (
              <div className="p-2">
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore ? "Carregando…" : "Carregar mais"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
