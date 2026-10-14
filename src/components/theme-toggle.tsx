"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const explicitPreference = useRef(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      explicitPreference.current = saved === "light" || saved === "dark";
    } catch { /* The toggle still works when storage is unavailable. */ }
    const system = matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (explicitPreference.current) return;
      const next = event.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    system.addEventListener("change", followSystem);
    return () => system.removeEventListener("change", followSystem);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    explicitPreference.current = true;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); }
    catch { /* Keep the selected theme for this visit if storage is blocked. */ }
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}
  </button>;
}
