import { ArrowLeft, Mail, Paperclip, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageDetail } from "@/lib/api";
import { initials } from "@/lib/utils";

type ReadingPanelProps = {
  message: MessageDetail | null;
  loading: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onReply: () => void;
  onDelete: () => void;
};

export function ReadingPanel({
  message,
  loading,
  showBack,
  onBack,
  onReply,
  onDelete,
}: ReadingPanelProps) {
  if (loading) {
    return (
      <section className="mail-surface flex min-w-0 flex-1 flex-col p-6">
        <Skeleton className="mb-4 h-10 w-10 rounded-full" />
        <Skeleton className="mb-2 h-7 w-3/4 max-w-lg" />
        <Skeleton className="mb-6 h-4 w-1/3" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </section>
    );
  }

  if (!message) {
    return (
      <section className="mail-surface hidden min-w-0 flex-1 flex-col items-center justify-center md:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Mail className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-base font-medium">Selecione um e-mail</p>
        <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
          Escolha uma mensagem na lista ao lado para visualizar o conteúdo.
        </p>
      </section>
    );
  }

  const sender = message.fromName || message.from;

  return (
    <section className="mail-surface flex min-w-0 flex-1 flex-col">
      {showBack && onBack && (
        <div className="border-b border-border/60 px-4 py-2 md:hidden">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      )}

      <header className="shrink-0 border-b border-border/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="avatar h-12 w-12 text-sm">{initials(message.fromName, message.from)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {message.subject || "(Sem assunto)"}
            </h1>
            <p className="mt-1.5 text-sm">
              <span className="font-medium">{sender}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <time className="text-muted-foreground" dateTime={message.date}>
                {new Date(message.date).toLocaleString("pt-BR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </time>
            </p>
            {message.to.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">Para: {message.to.join(", ")}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onReply}>
              <Reply className="h-4 w-4" />
              Responder
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-5 sm:p-6">
        {message.html ? (
          <div className="mail-body" dangerouslySetInnerHTML={{ __html: message.html }} />
        ) : (
          <pre className="mail-body whitespace-pre-wrap font-sans">{message.text || ""}</pre>
        )}

        {message.attachments.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/60 bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium">Anexos ({message.attachments.length})</p>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((a) => (
                <div
                  key={`${a.filename}-${a.size}`}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[200px] truncate">{a.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.max(1, Math.round(a.size / 1024))} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
