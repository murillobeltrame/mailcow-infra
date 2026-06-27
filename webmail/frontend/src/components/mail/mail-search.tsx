import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type MailSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
};

export function MailSearch({ value, onChange, onSubmit, placeholder = "Buscar e-mails…" }: MailSearchProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
        className="pl-9"
        aria-label="Buscar e-mails"
      />
    </div>
  );
}
