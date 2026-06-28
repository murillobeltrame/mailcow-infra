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

export function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Ontem";
  if (days < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function initials(name?: string, email?: string) {
  const source = name || email || "?";
  const parts = source.replace(/<[^>]+>/g, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
