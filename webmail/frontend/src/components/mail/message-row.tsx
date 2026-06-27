import { Paperclip, Star } from "lucide-react";
import type { MessageSummary } from "@/lib/api";
import { cn, formatRelativeDate, initials } from "@/lib/utils";

type MessageRowProps = {
  message: MessageSummary;
  selected: boolean;
  onSelect: () => void;
};

export function MessageRow({ message, selected, onSelect }: MessageRowProps) {
  const sender = message.fromName || message.from;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mail-row",
        !message.seen && "mail-row-unread",
        selected && "mail-row-selected"
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        aria-hidden
      >
        {initials(message.fromName, message.from)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm">{sender}</span>
          <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={message.date}>
            {formatRelativeDate(message.date)}
          </time>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {message.flagged && (
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Marcado" />
          )}
          {message.hasAttachments && (
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Com anexo" />
          )}
          <p className="truncate text-sm text-foreground">{message.subject || "(Sem assunto)"}</p>
        </div>
        {message.preview && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{message.preview}</p>
        )}
      </div>
    </button>
  );
}
