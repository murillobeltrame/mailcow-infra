import { Archive, FileText, Inbox, Mail, PenSquare, Send, Trash2, type LucideIcon } from "lucide-react";

const FOLDER_ICONS: Record<string, LucideIcon> = {
  "\\Inbox": Inbox,
  "\\Sent": Send,
  "\\Drafts": PenSquare,
  "\\Trash": Trash2,
  "\\Archive": Archive,
  "\\Junk": Mail,
  "\\Templates": FileText,
};

export function getFolderIcon(specialUse?: string): LucideIcon {
  return (specialUse && FOLDER_ICONS[specialUse]) || Mail;
}
