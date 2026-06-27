import { Menu, PenLine } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { ComposeSheet } from "@/components/mail/compose-sheet";
import { FolderRail } from "@/components/mail/folder-rail";
import { InboxPanel } from "@/components/mail/inbox-panel";
import { ReadingPanel } from "@/components/mail/reading-panel";
import { Button } from "@/components/ui/button";
import { useMailbox } from "@/hooks/use-mailbox";
import { cn } from "@/lib/utils";

export function MailApp() {
  const { user, logout } = useAuth();
  const mailbox = useMailbox();
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const composeDefaults = useMemo(() => {
    if (!replyMode || !mailbox.message) return undefined;
    return { to: mailbox.message.from, subject: mailbox.message.subject };
  }, [replyMode, mailbox.message]);

  if (!user) return null;

  const openCompose = () => {
    setReplyMode(false);
    setComposeOpen(true);
  };

  const openReply = () => {
    setReplyMode(true);
    setComposeOpen(true);
  };

  const closeCompose = () => setComposeOpen(false);

  const selectFolder = (path: string) => {
    mailbox.selectFolder(path);
    setFoldersOpen(false);
  };

  const showingMessage = mailbox.selectedUid !== null;

  return (
    <div className="mail-shell">
      {/* Barra mobile */}
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
        {/* Rail desktop */}
        <FolderRail
          className="hidden md:flex"
          folders={mailbox.folders}
          activeFolder={mailbox.activeFolder}
          loading={mailbox.foldersLoading}
          onSelectFolder={mailbox.selectFolder}
          onCompose={openCompose}
          onLogout={logout}
        />

        {/* Drawer mobile — pastas */}
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
                onSelectFolder={selectFolder}
                onCompose={() => {
                  openCompose();
                  setFoldersOpen(false);
                }}
                onLogout={logout}
                className="h-full rounded-none rounded-r-2xl"
              />
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
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
            />
            <ReadingPanel
              message={mailbox.message}
              loading={mailbox.messageLoading && showingMessage}
              onReply={openReply}
              onDelete={() => {
                if (mailbox.selectedUid !== null) mailbox.deleteMessage(mailbox.selectedUid);
              }}
            />
          </div>

          {/* Mobile — leitura fullscreen */}
          {showingMessage && (
            <div className="flex min-h-0 min-w-0 flex-1 md:hidden">
              <ReadingPanel
                message={mailbox.message}
                loading={mailbox.messageLoading}
                showBack
                onBack={() => mailbox.setSelectedUid(null)}
                onReply={openReply}
                onDelete={() => {
                  if (mailbox.selectedUid !== null) mailbox.deleteMessage(mailbox.selectedUid);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ComposeSheet
        open={composeOpen}
        onClose={closeCompose}
        defaults={composeDefaults}
        onSent={mailbox.refresh}
      />
    </div>
  );
}
