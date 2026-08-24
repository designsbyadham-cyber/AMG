"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/hooks/use-theme";

/**
 * Toaster that follows the app theme.
 *
 * sonner ships its own palette and was mounted with a hard-coded
 * `theme="light"`, so every toast stayed white — including on top of
 * After Dark. It also cannot use `theme="system"` here: the theme is a
 * stored preference, not an OS setting, so the OS answer is frequently
 * the wrong one.
 */
export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme === "dark" ? "dark" : "light"}
      position="top-right"
      // Take the app tokens rather than sonner's own greys, so a toast
      // reads as part of the product instead of a library default.
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}
