export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "nive-mail-theme";

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function initTheme() {
  applyTheme(resolveDark(getStoredTheme()));
}

export function persistTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function subscribeSystemTheme(onChange: (dark: boolean) => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
