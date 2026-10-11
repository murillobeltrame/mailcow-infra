import { Inbox, RefreshCw, Search, SearchX, Trash2, X } from "lucide-react";
import { MessageCard } from "@/components/mail/message-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type InboxPanelProps = {
  folderName: string;
  unreadMessages: MessageSummary[];
  readMessages: MessageSummary[];
  unreadTotal: number;
  readTotal: number;
  selectedUid: number | null;
  loading: boolean;
  refreshing?: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onSelect: (uid: number) => void;
  onRefresh: () => void;
  hasMoreUnread?: boolean;
  hasMoreRead?: boolean;
  loadingMoreUnread?: boolean;
  loadingMoreRead?: boolean;
  onLoadMoreUnread?: () => void;
  onLoadMoreRead?: () => void;
  bulkMode?: boolean;
  selectedUids?: Set<number>;
  onToggleBulkMode?: () => void;
  onToggleUid?: (uid: number, checked: boolean) => void;
  onBulkDelete?: () => void;
  bulkDeleting?: boolean;
};

function MessageSection({
  title,
  count,
  messages,
  selectedUid,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
  bulkMode,
  selectedUids,
  onToggleUid,
}: {
  title: string;
  count: number;
  messages: MessageSummary[];
  selectedUid: number | null;
  onSelect: (uid: number) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  bulkMode?: boolean;
  selectedUids?: Set<number>;
  onToggleUid?: (uid: number, checked: boolean) => void;
}) {
  if (messages.length === 0 && !hasMore) return null;

  return (
    <section className="space-y-1">
      <div className="sticky top-0 z-10 bg-surface/95 px-3 py-2 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          <span className="ml-1.5 font-medium normal-case tracking-normal">{count}</span>
        </p>
      </div>
      {messages.map((msg) => (
        <MessageCard
          key={msg.uid}
          message={msg}
          selected={selectedUid === msg.uid}
          onSelect={() => onSelect(msg.uid)}
          bulkMode={bulkMode}
          checked={selectedUids?.has(msg.uid)}
          onCheck={(checked) => onToggleUid?.(msg.uid, checked)}
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
    </section>
  );
}

export function InboxPanel({
  folderName,
  unreadMessages,
  readMessages,
  unreadTotal,
  readTotal,
  selectedUid,
  loading,
  refreshing = false,
  searchInput,
  onSearchChange,
  onSearchSubmit,
  onSelect,
  onRefresh,
  hasMoreUnread,
  hasMoreRead,
  loadingMoreUnread,
  loadingMoreRead,
  onLoadMoreUnread,
  onLoadMoreRead,
  bulkMode,
  selectedUids,
  onToggleBulkMode,
  onToggleUid,
  onBulkDelete,
  bulkDeleting,
}: InboxPanelProps) {
  const total = unreadTotal + readTotal;
  const searching = !loading && searchInput.trim().length > 0 && !refreshing;
  const empty = !loading && unreadMessages.length === 0 && readMessages.length === 0;

  return (
    <section className="mail-surface min-w-0 flex-1 flex-col">
      <header className="shrink-0 space-y-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">{folderName}</h1>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {loading
                ? "Carregando…"
                : refreshing
                  ? "Atualizando…"
                  : searching
                    ? `${total} resultado${total === 1 ? "" : "s"} para "${searchInput.trim()}"`
                    : unreadTotal > 0
                      ? `${unreadTotal} não lid${unreadTotal === 1 ? "o" : "os"} · ${readTotal} lid${readTotal === 1 ? "o" : "os"}`
                      : `${total} mensagen${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Atualizar"
            title="Atualizar"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          {onToggleBulkMode && (
            <Button
              variant={bulkMode ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-xl text-xs"
              onClick={onToggleBulkMode}
              aria-pressed={bulkMode}
            >
              {bulkMode ? "Cancelar" : "Selecionar"}
            </Button>
          )}
        </div>
        {bulkMode && onBulkDelete && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selectedUids && selectedUids.size > 0
                ? `${selectedUids.size} selecionad${selectedUids.size === 1 ? "o" : "os"}`
                : "Marque os e-mails que quer excluir"}
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg"
              disabled={bulkDeleting || !selectedUids || selectedUids.size === 0}
              onClick={onBulkDelete}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
            placeholder="Buscar por assunto, remetente ou texto…"
            className="search-input pr-10"
            aria-label="Buscar e-mails"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                onSearchSubmit();
              }}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              {searchInput.trim() ? (
                <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              ) : (
                <Inbox className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <p className="text-sm font-medium">{searchInput.trim() ? "Nada encontrado" : "Caixa vazia"}</p>
            <p className="text-xs text-muted-foreground">
              {searchInput.trim()
                ? "Tente outro termo ou limpe a busca."
                : "Nenhum e-mail nesta pasta."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <MessageSection
              title="Não lidos"
              count={unreadTotal}
              messages={unreadMessages}
              selectedUid={selectedUid}
              onSelect={onSelect}
              hasMore={hasMoreUnread}
              loadingMore={loadingMoreUnread}
              onLoadMore={onLoadMoreUnread}
              bulkMode={bulkMode}
              selectedUids={selectedUids}
              onToggleUid={onToggleUid}
            />
            <MessageSection
              title="Lidos"
              count={readTotal}
              messages={readMessages}
              selectedUid={selectedUid}
              onSelect={onSelect}
              hasMore={hasMoreRead}
              loadingMore={loadingMoreRead}
              onLoadMore={onLoadMoreRead}
              bulkMode={bulkMode}
              selectedUids={selectedUids}
              onToggleUid={onToggleUid}
            />
          </div>
        )}
      </div>
    </section>
  );
}
