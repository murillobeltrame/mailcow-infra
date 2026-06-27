import { useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  persistTheme,
  resolveDark,
  subscribeSystemTheme,
  type ThemeMode,
} from "@/lib/theme";

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme());
  const dark = resolveDark(mode);

  useEffect(() => {
    applyTheme(dark);
    persistTheme(mode);
  }, [dark, mode]);

  useEffect(() => {
    if (mode !== "system") return;
    return subscribeSystemTheme((isDark) => applyTheme(isDark));
  }, [mode]);

  return {
    dark,
    mode,
    toggle: () => {
      setMode((current) => {
        const isDark = resolveDark(current);
        return isDark ? "light" : "dark";
      });
    },
    setMode,
  };
}
