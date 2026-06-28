import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { asArray } from "@/lib/utils";

export function CalendarPage() {
  const qc = useQueryClient();
  const [selectedHref, setSelectedHref] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState("");

  const calendarsQuery = useQuery({
    queryKey: ["calendar", "calendars"],
    queryFn: () => api.calendars().then((r) => r.calendars),
  });

  const eventsQuery = useQuery({
    queryKey: ["calendar", "events", selectedHref],
    queryFn: () => api.calendarEvents(selectedHref!).then((r) => r.events),
    enabled: !!selectedHref,
  });

  const createEvent = useMutation({
    mutationFn: () => api.createCalendarEvent(selectedHref!, newEvent.trim()),
    onSuccess: () => {
      toast.success("Evento criado");
      setNewEvent("");
      qc.invalidateQueries({ queryKey: ["calendar", "events", selectedHref] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const deleteEvent = useMutation({
    mutationFn: (path: string) => api.deleteCalendarEvent(path),
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["calendar", "events", selectedHref] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const calendars = asArray<{ href: string; name: string }>(calendarsQuery.data);
  const events = asArray<{ summary: string; path?: string }>(eventsQuery.data);

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
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label htmlFor="event-title">Novo evento</Label>
                    <Input
                      id="event-title"
                      placeholder="Reunião, compromisso…"
                      value={newEvent}
                      onChange={(e) => setNewEvent(e.target.value)}
                    />
                  </div>
                  <Button
                    className="rounded-xl"
                    disabled={!newEvent.trim() || createEvent.isPending}
                    onClick={() => createEvent.mutate()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                {eventsQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <ul className="space-y-3">
                    {events.map((ev, i) => (
                      <li
                        key={ev.path ?? i}
                        className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                      >
                        <p className="font-medium">{ev.summary || "(Sem título)"}</p>
                        {ev.path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-destructive"
                            disabled={deleteEvent.isPending}
                            onClick={() => deleteEvent.mutate(ev.path!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                    {events.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum evento neste calendário</p>
                    )}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
