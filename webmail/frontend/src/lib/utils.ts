import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Garante array mesmo quando a API devolve objeto indexado. */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.msg)) return obj.msg as T[];
  const values = Object.values(obj).filter((v) => v && typeof v === "object");
  return values as T[];
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Hoje → hora; ontem; últimos dias → dia da semana; mesmo ano → dia/mês; antes → dia/mês/ano. */
export function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Ontem";
  if (days < 7) return date.toLocaleDateString("pt-BR", { weekday: "short" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatFullDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}

/** Cor estável por remetente, para distinguir remetentes de relance na lista. */
export function avatarStyle(seed?: string) {
  const text = (seed || "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 50%), hsl(${(hue + 24) % 360} 55% 40%))` };
}

export function cleanMessagePreview(text: string) {
  if (!text) return "";
  return text
    .replace(
      /(?:^|\s)(?:return-path|delivered-to|received|from|to|cc|bcc|reply-to|subject|date|message-id|mime-version|content-type|content-transfer-encoding|content-disposition|dkim-signature|authentication-results|received-spf|x-[\w-]+):/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function initials(name?: string, email?: string) {
  const source = name || email || "?";
  const parts = source.replace(/<[^>]+>/g, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
