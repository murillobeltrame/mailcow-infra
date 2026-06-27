import { LogOut, PenSquare } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FolderNav } from "@/components/mail/folder-nav";
import type { Folder } from "@/lib/api";
import { cn } from "@/lib/utils";

type MailSidebarProps = {
  email: string;
  folders: Folder[];
  activeFolder: string;
  loading: boolean;
  onSelectFolder: (path: string) => void;
  onCompose: () => void;
  onLogout: () => void;
  className?: string;
};

export function MailSidebar({
  email,
  folders,
  activeFolder,
  loading,
  onSelectFolder,
  onCompose,
  onLogout,
  className,
}: MailSidebarProps) {
  return (
    <div className={cn("panel", className)}>
      <div className="panel-header space-y-4">
        <div>
          <BrandLogo size="md" />
          <p className="mt-2 truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <Button className="w-full" onClick={onCompose}>
          <PenSquare className="h-4 w-4" />
          Escrever
        </Button>
      </div>

      <div className="panel-body">
        <ScrollArea className="h-full px-2 py-3">
          {loading ? (
            <div className="space-y-2 px-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <FolderNav folders={folders} activeFolder={activeFolder} onSelect={onSelectFolder} />
          )}
        </ScrollArea>
      </div>

      <div className="shrink-0 border-t border-border/80 p-3">
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
