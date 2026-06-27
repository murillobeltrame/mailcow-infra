import { ArrowLeft, Mail, Paperclip, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageDetail } from "@/lib/api";

type MessageReaderProps = {
  message: MessageDetail | null;
  loading: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onReply: () => void;
  onDelete: () => void;
};

export function MessageReader({
  message,
  loading,
  showBack,
  onBack,
  onReply,
  onDelete,
}: MessageReaderProps) {
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-7 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!message) {
    return (
      <EmptyState
        icon={Mail}
        title="Nenhuma mensagem selecionada"
        description="Escolha um e-mail na lista para ler o conteúdo."
      />
    );
  }

  return (
    <div className="panel animate-fade-in">
      {showBack && onBack && (
        <div className="panel-header md:hidden">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      )}

      <div className="panel-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-snug">{message.subject || "(Sem assunto)"}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              De{" "}
              <span className="font-medium text-foreground">{message.fromName || message.from}</span>
              <span className="mx-1.5">·</span>
              <time dateTime={message.date}>
                {new Date(message.date).toLocaleString("pt-BR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
            {message.to.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">Para: {message.to.join(", ")}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onReply}>
              <Reply className="h-4 w-4" />
              Responder
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>
      </div>

      <div className="panel-body">
        <ScrollArea className="h-full">
          <div className="p-6">
            {message.html ? (
              <div className="mail-body" dangerouslySetInnerHTML={{ __html: message.html }} />
            ) : (
              <pre className="mail-body whitespace-pre-wrap font-sans">{message.text || ""}</pre>
            )}

            {message.attachments.length > 0 && (
              <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-medium">Anexos ({message.attachments.length})</p>
                <ul className="space-y-1.5">
                  {message.attachments.map((a) => (
                    <li key={`${a.filename}-${a.size}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.filename}</span>
                      <span className="shrink-0 tabular-nums">({Math.max(1, Math.round(a.size / 1024))} KB)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
