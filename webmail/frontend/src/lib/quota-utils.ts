/** Mailcow devolve quota em bytes na listagem; a API de edição espera MB. */
const BYTES_PER_MB = 1024 * 1024;

export function parseQuotaToMb(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n >= BYTES_PER_MB) return Math.round(n / BYTES_PER_MB);
  return Math.round(n);
}

export function isUnlimitedQuotaMb(mb: number): boolean {
  return mb <= 0;
}

/** Rótulo legível para uma quota em MB (0 = ilimitada). */
export function formatQuotaMb(mb: number): string {
  if (isUnlimitedQuotaMb(mb)) return "Ilimitada";
  if (mb >= 1024) {
    const gb = mb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1).replace(/\.0$/, "")} GB`;
  }
  return `${mb} MB`;
}

/** Uso de armazenamento sempre em MB/GB (nunca "Ilimitada"). */
export function formatStorageMb(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1).replace(/\.0$/, "")} GB`;
  }
  return `${mb} MB`;
}

export function formatQuotaUsage(
  usedRaw: string | number | undefined,
  totalRaw: string | number | undefined,
): string {
  const usedMb = parseQuotaToMb(usedRaw);
  const totalMb = parseQuotaToMb(totalRaw);
  const usedLabel = formatStorageMb(usedMb);
  if (isUnlimitedQuotaMb(totalMb)) return `${usedLabel} / Ilimitada`;
  return `${usedLabel} / ${formatQuotaMb(totalMb)}`;
}

export function quotaUsagePercent(usedMb: number, totalMb: number): number | null {
  if (isUnlimitedQuotaMb(totalMb)) return null;
  return Math.min(100, Math.round((usedMb / totalMb) * 100));
}
