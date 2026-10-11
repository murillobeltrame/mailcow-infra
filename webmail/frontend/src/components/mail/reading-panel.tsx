import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  FolderInput,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Folder, MailAddress, MessageDetail } from "@/lib/api";
import { api } from "@/lib/api";
import { openMailLink, sanitizeMailHtml, splitTextLinks } from "@/lib/sanitize-mail-html";
import { avatarStyle, cn, formatBytes, formatFullDate, initials } from "@/lib/utils";

type ReadingPanelProps = {
  message: MessageDetail | null;
  loading: boolean;
  error?: Error | null;
  folder: string;
  folders?: Folder[];
  /** E-mail da conta logada, para mostrar "eu" nos destinatários. */
  selfEmail?: string;
  showBack?: boolean;
  onBack?: () => void;
  onReply: () => void;
  onReplyAll?: () => void;
  onForward: () => void;
  onDelete: () => void;
  onToggleFlag?: (flagged: boolean) => void;
  onMarkUnread?: () => void;
  onMove?: (targetFolder: string) => void;
};

function CopyEmailButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? "Copiado" : "Copiar e-mail"}
      aria-label={copied ? "E-mail copiado" : `Copiar ${value}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard indisponível */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function AddressChip({ addr, self }: { addr: MailAddress; self?: string }) {
  const isSelf = !!self && addr.address.toLowerCase() === self.toLowerCase();
  return (
    <span className="inline-flex max-w-full items-baseline gap-1" title={addr.address}>
      <span className="truncate font-medium text-foreground">{isSelf ? "eu" : addr.name || addr.address}</span>
      {(addr.name || isSelf) && <span className="truncate text-muted-foreground">&lt;{addr.address}&gt;</span>}
    </span>
  );
}

function AddressList({ list, self }: { list: MailAddress[]; self?: string }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {list.map((a) => (
        <AddressChip key={a.address} addr={a} self={self} />
      ))}
    </span>
  );
}

function parseLegacy(list: string[]): MailAddress[] {
  return list.map((raw) => {
    const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim() || undefined, address: m[2].trim() };
    return { address: raw.trim() };
  });
}

function MoveMenu({
  targets,
  onMove,
}: {
  targets: Folder[];
  onMove: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
        return;
      }
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mover para outra pasta"
        onClick={() => setOpen((v) => !v)}
      >
        <FolderInput className="h-4 w-4" />
        <span className="hidden lg:inline">Mover</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {targets.map((f) => (
            <button
              key={f.path}
              role="menuitem"
              type="button"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onMove(f.path);
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadingPanel({
  message,
  loading,
  error,
  folder,
  folders = [],
  selfEmail,
  showBack,
  onBack,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onToggleFlag,
  onMarkUnread,
  onMove,
}: ReadingPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const safeHtml = useMemo(
    () => (message?.html ? sanitizeMailHtml(message.html) : ""),
    [message?.html],
  );
  const textParts = useMemo(
    () => (message?.text && !message.html ? splitTextLinks(message.text) : []),
    [message?.html, message?.text],
  );

  // Cada mensagem abre com o cabeçalho resumido.
  useEffect(() => {
    setShowDetails(false);
  }, [message?.uid, folder]);

  const backBar =
    showBack && onBack ? (
      <div className="shrink-0 border-b border-border/60 px-4 py-2">
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    ) : null;

  if (loading) {
    return (
      <section className="mail-surface min-w-0 flex-1 flex-col">
        {backBar}
        <div className="p-6">
          <Skeleton className="mb-4 h-10 w-10 rounded-full" />
          <Skeleton className="mb-2 h-7 w-3/4 max-w-lg" />
          <Skeleton className="mb-6 h-4 w-1/3" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </section>
    );
  }

  if (error && !message) {
    return (
      <section className="mail-surface min-w-0 flex-1 flex-col">
        {backBar}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-base font-medium">Não foi possível abrir o e-mail</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </p>
        </div>
      </section>
    );
  }

  if (!message) {
    return (
      <section className="mail-surface min-w-0 flex-1 flex-col">
        {backBar}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Mail className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="mt-4 text-base font-medium">Selecione um e-mail</p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma mensagem da lista para ler aqui.</p>
        </div>
      </section>
    );
  }

  const senderName = message.fromName?.trim();
  const senderAddress = message.from;
  const toList = message.toList ?? parseLegacy(message.to);
  const ccList = message.ccList ?? parseLegacy(message.cc);
  const replyTo =
    message.replyTo && message.replyTo.address.toLowerCase() !== senderAddress.toLowerCase()
      ? message.replyTo
      : undefined;
  const moveTargets = folders.filter((f) => f.path !== folder);
  const toSummary = toList.slice(0, 2);
  const toExtra = toList.length - toSummary.length + ccList.length;
  const attachments = message.attachments;

  return (
    <section className="mail-surface min-w-0 flex-1 flex-col">
      {backBar}

      <header className="shrink-0 border-b border-border/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 basis-64 break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {message.subject || "(Sem assunto)"}
          </h1>
          <div className="flex shrink-0 flex-wrap items-center gap-2" role="toolbar" aria-label="Ações do e-mail">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onReply} title="Responder">
              <Reply className="h-4 w-4" />
              <span className="hidden sm:inline">Responder</span>
            </Button>
            {onReplyAll && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={onReplyAll}
                title="Responder a todos"
                aria-label="Responder a todos"
              >
                <ReplyAll className="h-4 w-4" />
                <span className="hidden lg:inline">Todos</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onForward} title="Encaminhar">
              <Forward className="h-4 w-4" />
              <span className="hidden lg:inline">Encaminhar</span>
            </Button>
            {onMove && moveTargets.length > 0 && <MoveMenu targets={moveTargets} onMove={onMove} />}
            {onToggleFlag && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onToggleFlag(!message.flagged)}
                title={message.flagged ? "Remover estrela" : "Marcar com estrela"}
                aria-label={message.flagged ? "Remover estrela" : "Marcar com estrela"}
                aria-pressed={message.flagged}
              >
                <Star className={cn("h-4 w-4", message.flagged && "fill-amber-400 text-amber-400")} />
              </Button>
            )}
            {onMarkUnread && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={onMarkUnread}
                title="Marcar como não lido"
                aria-label="Marcar como não lido"
              >
                <MailOpen className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Excluir"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div
            className="avatar h-11 w-11 text-sm"
            style={avatarStyle(senderAddress || senderName)}
            aria-hidden
          >
            {initials(message.fromName, message.from)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold">{senderName || senderAddress || "Remetente desconhecido"}</span>
              {senderName && senderAddress && (
                <span className="flex min-w-0 items-center gap-0.5 text-sm text-muted-foreground">
                  <span className="truncate">&lt;{senderAddress}&gt;</span>
                  <CopyEmailButton value={senderAddress} />
                </span>
              )}
              {!senderName && senderAddress && <CopyEmailButton value={senderAddress} />}
            </div>

            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span>Para:</span>
              {toList.length === 0 ? (
                <span>destinatários ocultos</span>
              ) : (
                <>
                  {toSummary.map((a, i) => (
                    <span key={a.address} className="inline-flex max-w-[16rem] items-baseline">
                      <AddressChip addr={a} self={selfEmail} />
                      {i < toSummary.length - 1 && ","}
                    </span>
                  ))}
                  {toExtra > 0 && <span>e mais {toExtra}</span>}
                </>
              )}
              <button
                type="button"
                className="ml-1 inline-flex items-center gap-0.5 rounded-md px-1 text-primary hover:underline"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
                <ChevronDown className={cn("h-3 w-3 transition", showDetails && "rotate-180")} />
              </button>
            </p>
          </div>
          <time
            className="shrink-0 text-right text-xs text-muted-foreground"
            dateTime={message.date}
            title={formatFullDate(message.date)}
          >
            {new Date(message.date).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>

        {replyTo && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            As respostas serão enviadas para <strong>{replyTo.address}</strong>, diferente do remetente.
          </p>
        )}

        {showDetails && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-muted/50 p-4 text-sm">
            <dt className="text-muted-foreground">De</dt>
            <dd className="min-w-0 break-all">
              {senderName ? `${senderName} <${senderAddress}>` : senderAddress || "—"}
            </dd>
            {replyTo && (
              <>
                <dt className="text-muted-foreground">Responder para</dt>
                <dd className="min-w-0 break-all">
                  {replyTo.name ? `${replyTo.name} <${replyTo.address}>` : replyTo.address}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Para</dt>
            <dd className="min-w-0 break-all">
              {toList.length > 0 ? <AddressList list={toList} self={selfEmail} /> : "—"}
            </dd>
            {ccList.length > 0 && (
              <>
                <dt className="text-muted-foreground">Cc</dt>
                <dd className="min-w-0 break-all">
                  <AddressList list={ccList} self={selfEmail} />
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Data</dt>
            <dd>{formatFullDate(message.date)}</dd>
            <dt className="text-muted-foreground">Pasta</dt>
            <dd>{folders.find((f) => f.path === folder)?.name ?? folder}</dd>
          </dl>
        )}

        {attachments.length > 0 && (
          <a
            href="#anexos"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {attachments.length} anexo{attachments.length === 1 ? "" : "s"}
          </a>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-5 sm:p-6">
        {safeHtml ? (
          <div
            className="mail-body"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
            onClick={openMailLink}
          />
        ) : (
          <pre className="mail-body whitespace-pre-wrap font-sans">
            {textParts.map((part, index) =>
              part.href ? (
                <a key={`${part.href}-${index}`} href={part.href} target="_blank" rel="noopener noreferrer">
                  {part.text}
                </a>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </pre>
        )}

        {attachments.length > 0 && (
          <div id="anexos" className="mt-8 rounded-xl border border-border/60 bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium">Anexos ({attachments.length})</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, index) => (
                <a
                  key={`${a.filename}-${a.size}-${index}`}
                  href={api.attachmentUrl(folder, message.uid, index)}
                  download={a.filename}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[200px] truncate">{a.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
