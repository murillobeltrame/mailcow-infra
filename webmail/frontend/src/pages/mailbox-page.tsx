import { Menu, PenSquare, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { ComposeDialog } from "@/components/mail/compose-dialog";
import { MailSearch } from "@/components/mail/mail-search";
import { MailSidebar } from "@/components/mail/mail-sidebar";
import { MessageList } from "@/components/mail/message-list";
import { MessageReader } from "@/components/mail/message-reader";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useMailbox } from "@/hooks/use-mailbox";
import { cn } from "@/lib/utils";

export function MailboxPage() {
  const { user, logout } = useAuth();
  const mailbox = useMailbox();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);

  const composeDefaults = useMemo(() => {
    if (!replyMode || !mailbox.message) return undefined;
    return { to: mailbox.message.from, subject: mailbox.message.subject };
  }, [replyMode, mailbox.message]);

  const openCompose = () => {
    setReplyMode(false);
    setComposeOpen(true);
  };

  const openReply = () => {
    setReplyMode(true);
    setComposeOpen(true);
  };

  if (!user) return null;

  const closeSidebar = () => setSidebarOpen(false);

  const handleSelectFolder = (path: string) => {
    mailbox.selectFolder(path);
    closeSidebar();
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header mobile */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/80 px-3 py-2 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{mailbox.activeFolderName}</p>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={mailbox.refresh} aria-label="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="default" size="icon" onClick={openCompose} aria-label="Escrever">
          <PenSquare className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-border/80 lg:block">
          <MailSidebar
            email={user.email}
            folders={mailbox.folders}
            activeFolder={mailbox.activeFolder}
            loading={mailbox.foldersLoading}
            onSelectFolder={mailbox.selectFolder}
            onCompose={openCompose}
            onLogout={logout}
          />
        </aside>

        {/* Sidebar mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={closeSidebar}
              aria-label="Fechar menu"
            />
            <aside className="relative h-full w-72 max-w-[85vw] shadow-elevated">
              <MailSidebar
                email={user.email}
                folders={mailbox.folders}
                activeFolder={mailbox.activeFolder}
                loading={mailbox.foldersLoading}
                onSelectFolder={handleSelectFolder}
                onCompose={() => {
                  openCompose();
                  closeSidebar();
                }}
                onLogout={logout}
              />
            </aside>
          </div>
        )}

        {/* Lista de mensagens */}
        <section
          className={cn(
            "panel w-full shrink-0 border-r border-border/80 md:w-80 lg:w-[22rem]",
            mailbox.selectedUid !== null && "hidden md:flex"
          )}
        >
          <div className="panel-header hidden space-y-3 lg:block">
            <MailSearch
              value={mailbox.searchInput}
              onChange={mailbox.setSearchInput}
              onSubmit={mailbox.submitSearch}
            />
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-sm font-semibold">{mailbox.activeFolderName}</h2>
              <Button variant="ghost" size="icon" onClick={mailbox.refresh} aria-label="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="panel-header lg:hidden">
            <MailSearch
              value={mailbox.searchInput}
              onChange={mailbox.setSearchInput}
              onSubmit={mailbox.submitSearch}
            />
          </div>

          <div className="panel-body">
            <MessageList
              messages={mailbox.messages}
              selectedUid={mailbox.selectedUid}
              loading={mailbox.messagesLoading}
              onSelect={mailbox.setSelectedUid}
            />
          </div>
        </section>

        {/* Leitura */}
        <section className={cn("min-w-0 flex-1", mailbox.selectedUid === null && "hidden md:block")}>
          <MessageReader
            message={mailbox.message}
            loading={mailbox.messageLoading && mailbox.selectedUid !== null}
            showBack={mailbox.selectedUid !== null}
            onBack={() => mailbox.setSelectedUid(null)}
            onReply={openReply}
            onDelete={() => {
              if (mailbox.selectedUid !== null) mailbox.deleteMessage(mailbox.selectedUid);
            }}
          />
        </section>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaults={composeDefaults}
        onSent={mailbox.refresh}
      />
    </div>
  );
}
