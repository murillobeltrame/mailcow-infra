import {
  Archive,
  Inbox,
  LogOut,
  Mail,
  Menu,
  Moon,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { ComposeDialog } from "@/components/compose-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { ApiError, api, type Folder, type MessageDetail, type MessageSummary } from "@/lib/api";
import { cn, formatRelativeDate, initials } from "@/lib/utils";

const folderIcons: Record<string, typeof Inbox> = {
  "\\Inbox": Inbox,
  "\\Sent": Send,
  "\\Drafts": PenSquare,
  "\\Trash": Trash2,
  "\\Archive": Archive,
  "\\Junk": Mail,
};

function FolderIcon({ specialUse }: { specialUse?: string }) {
  const Icon = (specialUse && folderIcons[specialUse]) || Mail;
  return <Icon className="h-4 w-4 shrink-0" />;
}

function MessageRow({
  message,
  selected,
  onClick,
}: {
  message: MessageSummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/60",
        !message.seen && "mail-row-unread",
        selected && "mail-row-selected"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {initials(message.fromName, message.from)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">{message.fromName || message.from}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDate(message.date)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {message.flagged && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          {message.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
          <p className="truncate text-sm">{message.subject}</p>
        </div>
        <p className="truncate text-xs text-muted-foreground">{message.preview}</p>
      </div>
    </button>
  );
}

function MessageReader({
  message,
  loading,
  onReply,
  onDelete,
}: {
  message: MessageDetail | null;
  loading: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Mail className="h-12 w-12 opacity-30" />
        <p className="text-sm">Selecione uma mensagem para ler</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-border/80 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold leading-snug">{message.subject}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              De <span className="font-medium text-foreground">{message.fromName || message.from}</span>
              {" · "}
              {new Date(message.date).toLocaleString("pt-BR")}
            </p>
            {message.to.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Para: {message.to.join(", ")}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReply}>
              Responder
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-6">
          {message.html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: message.html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{message.text}</pre>
          )}
          {message.attachments.length > 0 && (
            <div className="mt-6 rounded-lg border bg-muted/40 p-4">
              <p className="mb-2 text-sm font-medium">Anexos</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {message.attachments.map((a) => (
                  <li key={a.filename} className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5" />
                    {a.filename} ({Math.round(a.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function MailboxPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeFolderName = useMemo(
    () => folders.find((f) => f.path === activeFolder)?.name ?? "Caixa de entrada",
    [folders, activeFolder]
  );

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const { folders: data } = await api.folders();
      setFolders(data);
      if (!data.some((f) => f.path === activeFolder) && data[0]) {
        setActiveFolder(data[0].path);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar pastas");
    } finally {
      setLoadingFolders(false);
    }
  }, [activeFolder]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const { messages: data } = await api.messages(activeFolder, 0, search || undefined);
      setMessages(data);
      if (data.length === 0) {
        setSelectedUid(null);
        setSelectedMessage(null);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar mensagens");
    } finally {
      setLoadingMessages(false);
    }
  }, [activeFolder, search, refreshKey]);

  const loadMessage = useCallback(
    async (uid: number) => {
      setLoadingMessage(true);
      try {
        const msg = await api.message(activeFolder, uid);
        setSelectedMessage(msg);
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Erro ao abrir mensagem");
      } finally {
        setLoadingMessage(false);
      }
    },
    [activeFolder]
  );

  useEffect(() => {
    if (user) loadFolders();
  }, [user, loadFolders]);

  useEffect(() => {
    if (user) loadMessages();
  }, [user, loadMessages]);

  useEffect(() => {
    if (selectedUid) loadMessage(selectedUid);
    else setSelectedMessage(null);
  }, [selectedUid, loadMessage]);

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleDelete = async () => {
    if (!selectedUid) return;
    try {
      await api.deleteMessages(activeFolder, [selectedUid]);
      toast.success("Mensagem excluída");
      setSelectedUid(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-card">
      <div className="border-b border-border/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Nive Mail</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={() => setComposeOpen(true)}>
          <PenSquare className="h-4 w-4" />
          Escrever
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        {loadingFolders ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <nav className="space-y-0.5">
            {folders.map((folder) => (
              <button
                key={folder.path}
                type="button"
                onClick={() => {
                  setActiveFolder(folder.path);
                  setSelectedUid(null);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                  activeFolder === folder.path && "folder-active"
                )}
              >
                <FolderIcon specialUse={folder.specialUse} />
                <span className="flex-1 truncate text-left">{folder.name}</span>
                {(folder.unseen ?? 0) > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {folder.unseen}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
      </ScrollArea>
      <div className="border-t border-border/80 p-3">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Mobile header */}
      <header className="flex items-center gap-2 border-b border-border/80 px-3 py-2 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <p className="flex-1 truncate font-semibold">{activeFolderName}</p>
        <Button variant="ghost" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-border/80 lg:block">{sidebar}</aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="relative h-full w-72 shadow-elevated">{sidebar}</div>
          </div>
        )}

        {/* Message list */}
        <section
          className={cn(
            "flex w-full shrink-0 flex-col border-r border-border/80 md:w-80 lg:w-96",
            selectedUid && "hidden md:flex"
          )}
        >
          <div className="hidden border-b border-border/80 p-3 lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar e-mails…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{activeFolderName}</p>
              <Button variant="ghost" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingMessages ? (
              <div className="space-y-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="border-b p-4">
                    <Skeleton className="mb-2 h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhuma mensagem nesta pasta</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageRow
                  key={msg.uid}
                  message={msg}
                  selected={selectedUid === msg.uid}
                  onClick={() => setSelectedUid(msg.uid)}
                />
              ))
            )}
          </ScrollArea>
        </section>

        {/* Reading pane */}
        <section className={cn("min-w-0 flex-1", !selectedUid && "hidden md:block")}>
          {selectedUid && (
            <div className="border-b border-border/80 p-2 md:hidden">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUid(null)}>
                ← Voltar
              </Button>
            </div>
          )}
          <MessageReader
            message={selectedMessage}
            loading={loadingMessage}
            onReply={() => {
              if (selectedMessage) setComposeOpen(true);
            }}
            onDelete={handleDelete}
          />
        </section>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={
          selectedMessage
            ? { email: selectedMessage.from, subject: selectedMessage.subject }
            : undefined
        }
      />
    </div>
  );
}
