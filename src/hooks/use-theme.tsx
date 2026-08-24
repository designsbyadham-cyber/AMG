"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_THEME,
  STORAGE_KEY,
  THEMES,
  isThemeId,
  normaliseTheme,
  type ThemeId,
} from "@/lib/themes";

/**
 * ThemeProvider — wraps the whole app, owns the active theme state.
 *
 * The boot script in `src/app/layout.tsx` has already applied
 * `document.documentElement.dataset.theme` before React hydrates, so
 * by the time this Provider mounts the page is already painted in the
 * right colors. We just read what is there and keep it in sync.
 *
 * Every read goes through `normaliseTheme`, so a device still holding
 * one of the retired accent themes resolves to After Dark instead of
 * being silently reset to the default.
 *
 * Persistence is localStorage only (device-scoped). A future follow-up
 * could mirror to `profiles.preferences` for cross-device sync, but a
 * per-device choice is also defensible — a phone used outdoors may
 * deserve a different theme than a workshop laptop.
 */

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  // Whatever the boot script applied is the truth.
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeId(fromAttr)) return fromAttr;
  // Fall back to storage if the attribute is missing (e.g. someone
  // bypassed the boot script in a custom layout).
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return normaliseTheme(stored);
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }
  return normaliseTheme(fromAttr);
}

/**
 * Keep the browser chrome in step with the app. Mobile Safari and
 * Chrome paint the address bar from `<meta name="theme-color">`; left
 * static it stays light behind a dark app, which is exactly the kind
 * of undrawn surface that gives a build away.
 */
function syncBrowserChrome(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const surface = THEMES.find((t) => t.id === theme)?.preview.surface;
  if (meta && surface) meta.setAttribute("content", surface);
  // Tells form controls, scrollbars and the like which way to render.
  document.documentElement.style.colorScheme =
    theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
      syncBrowserChrome(next);
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same private-browsing edge case as above; in-memory state still
      // updates so the current tab works for the session.
    }
  }, []);

  // The boot script sets the attribute but cannot touch the meta tag
  // (it runs in <head>, before <body> exists). Catch up once mounted.
  useEffect(() => {
    syncBrowserChrome(theme);
  }, [theme]);

  // Sync from other tabs — change the theme in tab A and tab B catches
  // up without a refresh.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = normaliseTheme(e.newValue);
      if (next !== theme) {
        setThemeState(next);
        document.documentElement.dataset.theme = next;
        syncBrowserChrome(next);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — a no-op
    // setter so callers do not crash. The boot script still applied the
    // right CSS attribute, so visually the page is fine.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
    };
  }
  return ctx;
}
