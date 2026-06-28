import { Paperclip, Star } from "lucide-react";
import type { MessageSummary } from "@/lib/api";
import { cn, formatRelativeDate, initials } from "@/lib/utils";

type MessageCardProps = {
  message: MessageSummary;
  selected: boolean;
  onSelect: () => void;
  bulkMode?: boolean;
  checked?: boolean;
  onCheck?: (checked: boolean) => void;
};

export function MessageCard({ message, selected, onSelect, bulkMode, checked, onCheck }: MessageCardProps) {
  const sender = message.fromName || message.from.split("@")[0];

  return (
    <div className="flex items-start gap-1">
      {bulkMode && (
        <input
          type="checkbox"
          className="mt-3 shrink-0"
          checked={checked}
          onChange={(e) => onCheck?.(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Selecionar ${message.subject}`}
        />
      )}
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex-1 rounded-xl px-3 py-3 text-left transition-all",
        selected
          ? "bg-accent shadow-sm ring-1 ring-primary/20"
          : "hover:bg-muted/70",
        !message.seen && !selected && "bg-surface"
      )}
    >
      <div className="flex gap-3">
        <div className="relative">
          <div className="avatar h-10 w-10">{initials(message.fromName, message.from)}</div>
          {!message.seen && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", !message.seen && "font-semibold")}>{sender}</span>
            <time
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              dateTime={message.date}
            >
              {formatRelativeDate(message.date)}
            </time>
          </div>

          <div className="mt-0.5 flex items-center gap-1">
            {message.flagged && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            {message.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
            <p className={cn("truncate text-sm", !message.seen ? "font-medium text-foreground" : "text-foreground/80")}>
              {message.subject || "(Sem assunto)"}
            </p>
          </div>

          {message.preview && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{message.preview}</p>
          )}
        </div>
      </div>
    </button>
    </div>
  );
}
