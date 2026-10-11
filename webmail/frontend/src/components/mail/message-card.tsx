import { Paperclip, Star } from "lucide-react";
import type { MessageSummary } from "@/lib/api";
import { avatarStyle, cleanMessagePreview, cn, formatFullDate, formatRelativeDate, initials } from "@/lib/utils";

type MessageCardProps = {
  message: MessageSummary;
  selected: boolean;
  onSelect: () => void;
  bulkMode?: boolean;
  checked?: boolean;
  onCheck?: (checked: boolean) => void;
};

export function MessageCard({ message, selected, onSelect, bulkMode, checked, onCheck }: MessageCardProps) {
  const sender = message.fromName || message.from || "Remetente desconhecido";
  // Com nome de exibição, o endereço aparece como dica para distinguir remetentes homônimos.
  const senderTitle = message.fromName && message.from ? `${message.fromName} <${message.from}>` : sender;
  const preview = cleanMessagePreview(message.preview);

  return (
    <div className="flex items-start gap-1">
      {bulkMode && (
        <input
          type="checkbox"
          className="mt-4 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          checked={checked}
          onChange={(e) => onCheck?.(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Selecionar ${message.subject}`}
        />
      )}
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group min-w-0 flex-1 rounded-xl px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-accent shadow-sm ring-1 ring-primary/20"
          : "hover:bg-muted/70",
        !message.seen && !selected && "bg-surface",
      )}
    >
      <div className="flex gap-3">
        <div className="relative">
          <div className="avatar h-10 w-10" style={avatarStyle(message.from || message.fromName)}>{initials(message.fromName, message.from)}</div>
          {!message.seen && (
            <span aria-label="Não lido" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", !message.seen && "font-bold")} title={senderTitle}>
              {sender}
            </span>
            <time
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                !message.seen ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
              dateTime={message.date}
              title={formatFullDate(message.date)}
            >
              {formatRelativeDate(message.date)}
            </time>
          </div>

          <div className="mt-0.5 flex items-center gap-1">
            {message.flagged && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Com estrela" />}
            {message.hasAttachments && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Com anexo" />}
            <p className={cn("truncate text-sm", !message.seen ? "font-semibold text-foreground" : "text-foreground/80")}>
              {message.subject || "(Sem assunto)"}
            </p>
          </div>

          {preview && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{preview}</p>
          )}
        </div>
      </div>
    </button>
    </div>
  );
}
