import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { asArray } from "@/lib/utils";

export function ContactsPage() {
  const [selectedHref, setSelectedHref] = useState<string | null>(null);

  const booksQuery = useQuery({
    queryKey: ["contacts", "books"],
    queryFn: () => api.contactBooks().then((r) => r.books),
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", "list", selectedHref],
    queryFn: () => api.contacts(selectedHref!).then((r) => r.contacts),
    enabled: !!selectedHref,
  });

  const books = asArray<{ href: string; name: string }>(booksQuery.data);
  const contacts = asArray<{ fn: string; email?: string }>(contactsQuery.data);

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
            ) : contactsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ul className="divide-y divide-border/60">
                {contacts.map((c, i) => (
                  <li key={i} className="flex items-center justify-between py-3">
                    <span className="font-medium">{c.fn || "—"}</span>
                    <span className="text-sm text-muted-foreground">{c.email ?? ""}</span>
                  </li>
                ))}
                {contacts.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">Nenhum contacto</p>
                )}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
