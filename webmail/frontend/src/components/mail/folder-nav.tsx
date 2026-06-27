import { getFolderIcon } from "@/lib/folder-icons";
import type { Folder } from "@/lib/api";
import { cn } from "@/lib/utils";

type FolderNavProps = {
  folders: Folder[];
  activeFolder: string;
  onSelect: (path: string) => void;
};

export function FolderNav({ folders, activeFolder, onSelect }: FolderNavProps) {
  return (
    <nav className="space-y-0.5" aria-label="Pastas de e-mail">
      {folders.map((folder) => {
        const Icon = getFolderIcon(folder.specialUse);
        const isActive = folder.path === activeFolder;
        const unseen = folder.unseen ?? 0;

        return (
          <button
            key={folder.path}
            type="button"
            onClick={() => onSelect(folder.path)}
            className={cn("nav-item", isActive && "nav-item-active")}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">{folder.name}</span>
            {unseen > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                {unseen > 99 ? "99+" : unseen}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
