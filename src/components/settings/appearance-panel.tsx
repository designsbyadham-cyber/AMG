"use client";

import { Check } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { THEMES, type ThemeMeta } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Appearance panel — theme picker.
 *
 * Two options, so each card can afford to actually show its theme
 * rather than reduce it to an accent dot: the preview is a miniature
 * of the real layout (rail, surface, card, button) painted in that
 * theme's own tokens. With six accent variants there was no room for
 * that, and the swatch told you nothing about what you were choosing.
 *
 * Click applies and persists immediately. No save button: the whole
 * change is a CSS-variable swap on <html> and there is nothing to roll
 * back.
 */
export function AppearancePanel() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Daylight is the default and what the app is designed around.
          After Dark is the same workspace for late shifts. Saved to this
          device.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            meta={t}
            isActive={t.id === theme}
            onPick={() => setTheme(t.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({
  meta,
  isActive,
  onPick,
}: {
  meta: ThemeMeta;
  isActive: boolean;
  onPick: () => void;
}) {
  const { surface, raised, ink, accent } = meta.preview;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isActive}
      aria-label={`Use the ${meta.name} theme`}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors",
        isActive
          ? "border-primary bg-primary-soft"
          : "border-border hover:bg-muted/50",
      )}
    >
      {/* A small honest render of the theme, in the theme's own colors. */}
      <div
        aria-hidden
        className="flex h-24 gap-1.5 overflow-hidden rounded-lg p-1.5 ring-1 ring-inset ring-black/5"
        style={{ background: surface }}
      >
        <div className="flex w-1/4 flex-col gap-1 rounded p-1" style={{ background: raised }}>
          <span className="h-1.5 w-full rounded-full" style={{ background: accent }} />
          <span className="h-1.5 w-3/4 rounded-full opacity-25" style={{ background: ink }} />
          <span className="h-1.5 w-2/3 rounded-full opacity-25" style={{ background: ink }} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 rounded p-1.5" style={{ background: raised }}>
          <span className="h-2 w-1/2 rounded-full opacity-80" style={{ background: ink }} />
          <span className="h-1.5 w-full rounded-full opacity-20" style={{ background: ink }} />
          <span className="h-1.5 w-5/6 rounded-full opacity-20" style={{ background: ink }} />
          <span className="mt-auto h-3.5 w-14 rounded" style={{ background: accent }} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{meta.name}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {meta.tagline}
          </div>
        </div>
        {isActive && (
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </span>
        )}
      </div>
    </button>
  );
}
