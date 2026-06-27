import { Inbox } from "lucide-react";
import { MessageRow } from "@/components/mail/message-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageSummary } from "@/lib/api";

type MessageListProps = {
  messages: MessageSummary[];
  selectedUid: number | null;
  loading: boolean;
  onSelect: (uid: number) => void;
};

export function MessageList({ messages, selectedUid, loading, onSelect }: MessageListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border/60">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhuma mensagem" description="Esta pasta está vazia." />;
  }

  return (
    <ScrollArea className="h-full">
      <div role="list">
        {messages.map((msg) => (
          <MessageRow
            key={msg.uid}
            message={msg}
            selected={selectedUid === msg.uid}
            onSelect={() => onSelect(msg.uid)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
