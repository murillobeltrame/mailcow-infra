import { Menu, PenLine } from "lucide-react";
import { useState } from "react";
import { ComposeSheet, type ComposeDefaults } from "@/components/mail/compose-sheet";
import { FolderRail } from "@/components/mail/folder-rail";
import { InboxPanel } from "@/components/mail/inbox-panel";
import { ReadingPanel } from "@/components/mail/reading-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/auth-context";
import { useMailbox } from "@/hooks/use-mailbox";
import { cn } from "@/lib/utils";

export function MailApp() {
  const { user } = useAuth();
  const mailbox = useMailbox();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<ComposeDefaults | undefined>();
  const [foldersOpen, setFoldersOpen] = useState(false);

  if (!user) return null;

  const openCompose = () => {
    setComposeDefaults(undefined);
    setComposeOpen(true);
  };

  const openReply = () => {
    if (!mailbox.message) return;
    setComposeDefaults({
      to: mailbox.message.from,
      subject: mailbox.message.subject,
      mode: "reply",
    });
    setComposeOpen(true);
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
    setComposeOpen(true);
  };

  const openForward = () => {
    if (!mailbox.message) return;
    const quoted = mailbox.message.text ?? mailbox.message.html?.replace(/<[^>]+>/g, "") ?? "";
    setComposeDefaults({
      subject: mailbox.message.subject,
      body: `\n\n---------- Mensagem encaminhada ----------\nDe: ${mailbox.message.from}\nAssunto: ${mailbox.message.subject}\n\n${quoted}`,
      mode: "forward",
    });
    setComposeOpen(true);
  };

  const closeCompose = () => setComposeOpen(false);

  const selectFolder = (path: string) => {
    mailbox.selectFolder(path);
    setFoldersOpen(false);
  };

  const showingMessage = mailbox.selectedUid !== null;

  return (
    <div className="mail-shell p-2 md:p-4">
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
          <p className="truncate text-sm font-semibold">{mailbox.activeFolderName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button size="icon" className="rounded-xl" onClick={openCompose} aria-label="Escrever">
          <PenLine className="h-4 w-4" />
        </Button>
      </header>

      <div className="mail-workspace">
        <FolderRail
          className="hidden md:flex"
          folders={mailbox.folders}
          activeFolder={mailbox.activeFolder}
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
                activeFolder={mailbox.activeFolder}
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

        <div className="flex min-h-0 min-w-0 flex-1 gap-2 sm:gap-3">
          <div className={cn("flex min-h-0 min-w-0 flex-1 gap-2 sm:gap-3", showingMessage && "max-md:hidden")}>
            <InboxPanel
              folderName={mailbox.activeFolderName}
              messages={mailbox.messages}
              selectedUid={mailbox.selectedUid}
              loading={mailbox.messagesLoading}
              searchInput={mailbox.searchInput}
              onSearchChange={mailbox.setSearchInput}
              onSearchSubmit={mailbox.submitSearch}
              onSelect={mailbox.setSelectedUid}
              onRefresh={mailbox.refresh}
              refreshing={mailbox.refreshing}
              hasMore={mailbox.hasMoreMessages}
              loadingMore={mailbox.messagesFetchingMore}
              onLoadMore={mailbox.loadMoreMessages}
              bulkMode={mailbox.bulkMode}
              selectedUids={mailbox.selectedUids}
              onToggleBulkMode={mailbox.toggleBulkMode}
              onToggleUid={mailbox.toggleUid}
              onBulkDelete={mailbox.bulkDelete}
              bulkDeleting={mailbox.bulkDeleting}
            />
            <ReadingPanel
              message={mailbox.message}
              loading={mailbox.messageLoading && showingMessage}
              error={mailbox.messageError}
              folder={mailbox.activeFolder}
              folders={mailbox.folders}
              onReply={openReply}
              onReplyAll={openReplyAll}
              onForward={openForward}
              onDelete={() => {
                if (mailbox.selectedUid !== null) mailbox.deleteMessage(mailbox.selectedUid);
              }}
              onToggleFlag={(flagged) => {
                if (mailbox.selectedUid !== null) mailbox.toggleFlag({ uid: mailbox.selectedUid, flagged });
              }}
              onMarkUnread={() => {
                if (mailbox.selectedUid !== null) mailbox.markUnread(mailbox.selectedUid);
              }}
              onMove={(to) => {
                if (mailbox.selectedUid !== null) mailbox.moveMessage({ uid: mailbox.selectedUid, to });
              }}
            />
          </div>

          {showingMessage && (
            <div className="flex min-h-0 min-w-0 flex-1 md:hidden">
              <ReadingPanel
                message={mailbox.message}
                loading={mailbox.messageLoading}
                error={mailbox.messageError}
                folder={mailbox.activeFolder}
                folders={mailbox.folders}
                showBack
                onBack={() => mailbox.setSelectedUid(null)}
                onReply={openReply}
                onReplyAll={openReplyAll}
                onForward={openForward}
                onDelete={() => {
                  if (mailbox.selectedUid !== null) mailbox.deleteMessage(mailbox.selectedUid);
                }}
                onToggleFlag={(flagged) => {
                  if (mailbox.selectedUid !== null) mailbox.toggleFlag({ uid: mailbox.selectedUid, flagged });
                }}
                onMarkUnread={() => {
                  if (mailbox.selectedUid !== null) mailbox.markUnread(mailbox.selectedUid);
                }}
                onMove={(to) => {
                  if (mailbox.selectedUid !== null) mailbox.moveMessage({ uid: mailbox.selectedUid, to });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ComposeSheet open={composeOpen} onClose={closeCompose} defaults={composeDefaults} onSent={mailbox.refreshAll} />
    </div>
  );
}
