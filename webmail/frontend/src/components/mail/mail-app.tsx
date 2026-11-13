import { Menu, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ComposePanel,
  type ComposeDefaults,
} from "@/components/mail/compose-panel";
import { FolderRail } from "@/components/mail/folder-rail";
import { InboxPanel } from "@/components/mail/inbox-panel";
import { ReadingPanel } from "@/components/mail/reading-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/auth-context";
import { useMailbox } from "@/hooks/use-mailbox";

export function MailApp() {
  const { user } = useAuth();
  const mailbox = useMailbox();
  const [foldersOpen, setFoldersOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Escrever é uma página própria (/compose); resposta/encaminhamento chegam pelo state da navegação.
  const composing = location.pathname === "/compose";
  const composeState = location.state as {
    compose?: ComposeDefaults;
    fromApp?: boolean;
  } | null;
  const draftParam = Number(searchParams.get("draft"));
  const composeDraftUid =
    Number.isInteger(draftParam) && draftParam > 0 ? draftParam : null;
  const draftsFolder = mailbox.folders.find(
    (f) => f.specialUse === "\\Drafts",
  )?.path;

  const setComposeDefaults = (defaults: ComposeDefaults | undefined) =>
    navigate("/compose", { state: { compose: defaults, fromApp: true } });

  if (!user) return null;

  const openCompose = () => setComposeDefaults(undefined);

  const openReply = () => {
    if (!mailbox.message) return;
    setComposeDefaults({
      to: mailbox.message.replyTo?.address ?? mailbox.message.from,
      subject: mailbox.message.subject,
      mode: "reply",
    });
  };

  const openReplyAll = () => {
    if (!mailbox.message || !user) return;
    const self = user.email.toLowerCase();
    const others = [
      mailbox.message.from,
      ...mailbox.message.to,
      ...mailbox.message.cc,
    ]
      .map((e) => e.replace(/.*<([^>]+)>.*/, "$1").trim())
      .filter((e) => e && !e.toLowerCase().includes(self));
    const unique = [...new Set(others)];
    setComposeDefaults({
      to: unique[0] ?? mailbox.message.from,
      cc: unique.slice(1).join(", ") || undefined,
      subject: mailbox.message.subject,
      mode: "reply-all",
    });
  };

  const openForward = () => {
    if (!mailbox.message) return;
    const quoted =
      mailbox.message.text ??
      mailbox.message.html?.replace(/<[^>]+>/g, "") ??
      "";
    setComposeDefaults({
      subject: mailbox.message.subject,
      body: `\n\n---------- Mensagem encaminhada ----------\nDe: ${mailbox.message.from}\nAssunto: ${mailbox.message.subject}\n\n${quoted}`,
      mode: "forward",
    });
  };

  const closeCompose = () => {
    if (composeState?.fromApp) navigate(-1);
    else navigate("/", { replace: true });
  };

  // Na pasta Rascunhos, clicar numa mensagem continua a escrita em vez de só ler.
  const selectMessage = (uid: number) => {
    if (draftsFolder && mailbox.activeFolder === draftsFolder) {
      navigate(`/compose?draft=${uid}`, { state: { fromApp: true } });
    } else {
      mailbox.selectMessage(uid);
    }
  };

  const selectFolder = (path: string) => {
    mailbox.selectFolder(path);
    setFoldersOpen(false);
  };

  const showingMessage = !composing && mailbox.selectedUid !== null;
  const closeMessage = () => mailbox.setSelectedUid(null);

  useEffect(() => {
    if (!showingMessage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") mailbox.setSelectedUid(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mailbox.setSelectedUid, showingMessage]);

  return (
    <div className="mail-shell p-2 md:p-4">
      {!showingMessage && !composing && (
        <header className="mb-2 flex shrink-0 items-center gap-2 md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl bg-surface"
            onClick={() => setFoldersOpen(true)}
            aria-label="Pastas"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {mailbox.activeFolderName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Button
            size="icon"
            className="rounded-xl"
            onClick={openCompose}
            aria-label="Escrever"
          >
            <PenLine className="h-4 w-4" />
          </Button>
        </header>
      )}

      <div className="mail-workspace">
        <FolderRail
          className="hidden md:flex"
          folders={mailbox.folders}
          activeFolder={composing ? "" : mailbox.activeFolder}
          composing={composing}
          loading={mailbox.foldersLoading}
          error={mailbox.foldersError}
          onSelectFolder={mailbox.selectFolder}
          onCompose={openCompose}
          onRetry={mailbox.refetchFolders}
        />

        {foldersOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setFoldersOpen(false)}
              aria-label="Fechar"
            />
            <div className="absolute left-0 top-0 h-full w-20 animate-slide-in-right">
              <FolderRail
                folders={mailbox.folders}
                activeFolder={composing ? "" : mailbox.activeFolder}
                composing={composing}
                loading={mailbox.foldersLoading}
                error={mailbox.foldersError}
                onSelectFolder={selectFolder}
                onCompose={() => {
                  openCompose();
                  setFoldersOpen(false);
                }}
                onRetry={mailbox.refetchFolders}
                className="h-full rounded-none rounded-r-2xl"
              />
            </div>
          </div>
        )}

        {composing ? (
          <ComposePanel
            key={location.key}
            defaults={composeState?.compose}
            draftUid={composeDraftUid}
            draftsFolder={draftsFolder}
            onClose={closeCompose}
          />
        ) : showingMessage ? (
          <ReadingPanel
            selfEmail={user.email}
            message={mailbox.message}
            loading={mailbox.messageLoading}
            error={mailbox.messageError}
            folder={mailbox.activeFolder}
            folders={mailbox.folders}
            showBack
            onBack={closeMessage}
            onReply={openReply}
            onReplyAll={openReplyAll}
            onForward={openForward}
            onDelete={() => {
              if (mailbox.selectedUid !== null)
                mailbox.deleteMessage(mailbox.selectedUid);
            }}
            onToggleFlag={(flagged) => {
              if (mailbox.selectedUid !== null)
                mailbox.toggleFlag({ uid: mailbox.selectedUid, flagged });
            }}
            onMarkUnread={() => {
              if (mailbox.selectedUid !== null)
                mailbox.markUnread(mailbox.selectedUid);
            }}
            onMove={(to) => {
              if (mailbox.selectedUid !== null)
                mailbox.moveMessage({ uid: mailbox.selectedUid, to });
            }}
          />
        ) : (
          <InboxPanel
            folderName={mailbox.activeFolderName}
            unreadMessages={mailbox.unreadMessages}
            readMessages={mailbox.readMessages}
            unreadTotal={mailbox.unreadTotal}
            readTotal={mailbox.readTotal}
            selectedUid={mailbox.selectedUid}
            loading={mailbox.messagesLoading}
            searchInput={mailbox.searchInput}
            onSearchChange={mailbox.setSearchInput}
            onSearchSubmit={mailbox.submitSearch}
            onSelect={selectMessage}
            onRefresh={mailbox.refresh}
            refreshing={mailbox.refreshing}
            hasMoreUnread={mailbox.hasMoreUnread}
            hasMoreRead={mailbox.hasMoreRead}
            loadingMoreUnread={mailbox.unreadFetchingMore}
            loadingMoreRead={mailbox.readFetchingMore}
            onLoadMoreUnread={mailbox.loadMoreUnread}
            onLoadMoreRead={mailbox.loadMoreRead}
            bulkMode={mailbox.bulkMode}
            selectedUids={mailbox.selectedUids}
            onToggleBulkMode={mailbox.toggleBulkMode}
            onToggleUid={mailbox.toggleUid}
            onBulkDelete={mailbox.bulkDelete}
            bulkDeleting={mailbox.bulkDeleting}
          />
        )}
      </div>
    </div>
  );
}
