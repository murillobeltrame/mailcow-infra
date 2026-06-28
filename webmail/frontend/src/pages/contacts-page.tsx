import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { asArray } from "@/lib/utils";

export function ContactsPage() {
  const qc = useQueryClient();
  const [selectedHref, setSelectedHref] = useState<string | null>(null);
  const [fn, setFn] = useState("");
  const [email, setEmail] = useState("");

  const booksQuery = useQuery({
    queryKey: ["contacts", "books"],
    queryFn: () => api.contactBooks().then((r) => r.books),
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", "list", selectedHref],
    queryFn: () => api.contacts(selectedHref!).then((r) => r.contacts),
    enabled: !!selectedHref,
  });

  const createContact = useMutation({
    mutationFn: () => api.createContact(selectedHref!, fn.trim(), email.trim() || undefined),
    onSuccess: () => {
      toast.success("Contacto criado");
      setFn("");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["contacts", "list", selectedHref] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const deleteContact = useMutation({
    mutationFn: (path: string) => api.deleteContact(path),
    onSuccess: () => {
      toast.success("Contacto removido");
      qc.invalidateQueries({ queryKey: ["contacts", "list", selectedHref] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const books = asArray<{ href: string; name: string }>(booksQuery.data);
  const contacts = asArray<{ fn: string; email?: string; path?: string }>(contactsQuery.data);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contactos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Livro de endereços via CardDAV (SOGo)</p>
      </div>

      {booksQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-surface p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum livro de endereços encontrado</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-1">
            {books.map((book) => (
              <button
                key={book.href}
                type="button"
                onClick={() => setSelectedHref(book.href)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedHref === book.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {book.name}
              </button>
            ))}
          </aside>
          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            {!selectedHref ? (
              <p className="text-sm text-muted-foreground">Selecione um livro</p>
            ) : (
              <>
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-fn">Nome</Label>
                    <Input id="contact-fn" value={fn} onChange={(e) => setFn(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">E-mail</Label>
                    <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      className="rounded-xl"
                      disabled={!fn.trim() || createContact.isPending}
                      onClick={() => createContact.mutate()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar contacto
                    </Button>
                  </div>
                </div>
                {contactsQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {contacts.map((c, i) => (
                      <li key={c.path ?? i} className="flex items-center justify-between py-3">
                        <div>
                          <span className="font-medium">{c.fn || "—"}</span>
                          {c.email && (
                            <span className="ml-2 text-sm text-muted-foreground">{c.email}</span>
                          )}
                        </div>
                        {c.path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-destructive"
                            disabled={deleteContact.isPending}
                            onClick={() => deleteContact.mutate(c.path!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                    {contacts.length === 0 && (
                      <p className="py-4 text-sm text-muted-foreground">Nenhum contacto</p>
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
