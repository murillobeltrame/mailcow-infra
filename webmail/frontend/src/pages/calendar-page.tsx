import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export function CalendarPage() {
  const [selectedHref, setSelectedHref] = useState<string | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendar", "calendars"],
    queryFn: () => api.calendars().then((r) => r.calendars),
  });

  const eventsQuery = useQuery({
    queryKey: ["calendar", "events", selectedHref],
    queryFn: () => api.calendarEvents(selectedHref!).then((r) => r.events),
    enabled: !!selectedHref,
  });

  const calendars = calendarsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
        <p className="mt-1 text-sm text-muted-foreground">Agendas sincronizadas via CalDAV (SOGo)</p>
      </div>

      {calendarsQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : calendars.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-surface p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum calendário encontrado</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-1">
            {calendars.map((cal) => (
              <button
                key={cal.href}
                type="button"
                onClick={() => setSelectedHref(cal.href)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedHref === cal.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {cal.name}
              </button>
            ))}
          </aside>
          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            {!selectedHref ? (
              <p className="text-sm text-muted-foreground">Selecione um calendário</p>
            ) : eventsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ul className="space-y-3">
                {(eventsQuery.data ?? []).map((ev, i) => (
                  <li key={i} className="rounded-xl border border-border/60 px-4 py-3">
                    <p className="font-medium">{ev.summary || "(Sem título)"}</p>
                  </li>
                ))}
                {(eventsQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum evento neste calendário</p>
                )}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
