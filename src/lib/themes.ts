/**
 * Single source of truth for the theme catalog.
 *
 * There are two themes and there should stay two. The app used to ship
 * six — one light, five dark variants that differed only in accent hue
 * — which made "what colour is a primary button?" a question with five
 * answers and left every screen needing five visual checks. One brand
 * indigo now carries both themes; the only thing that changes between
 * them is the lighting.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `:root` (Daylight) and `html[data-theme="dark"]` (After Dark). This
 * module only carries the metadata the picker and the no-flash boot
 * script need.
 */

export const THEME_IDS = ["sunlight", "dark"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

// Daylight is the product's look and the one `:root` mirrors in
// globals.css, so the server, first paint, and any visitor without a
// saved preference all agree — no flash while the client settles. A
// workshop is a bright room; the light workspace is chosen from that
// use scene rather than from category habit.
export const DEFAULT_THEME: ThemeId = "sunlight";

export const STORAGE_KEY = "wacrm.theme";

/**
 * Accent-variant themes retired when the catalog collapsed to two.
 * They were all dark, so anyone who had picked one gets After Dark
 * rather than being yanked into the light theme.
 *
 * Kept as data rather than deleted: the ids are still sitting in
 * localStorage on every device that ever selected one, and a stored
 * value we do not recognise silently resets the visitor's choice.
 */
export const RETIRED_THEME_IDS: Readonly<Record<string, ThemeId>> = {
  violet: "dark",
  emerald: "dark",
  cobalt: "dark",
  amber: "dark",
  rose: "dark",
};

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static preview colors for the picker card. Hard-coded so the card
   * does not need a getComputedStyle round trip against a theme that
   * is not currently applied. Must mirror the same theme in
   * globals.css.
   */
  preview: {
    surface: string;
    raised: string;
    ink: string;
    accent: string;
  };
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "sunlight",
    name: "Daylight",
    tagline: "The default. Built for a bright workshop floor.",
    preview: {
      surface: "oklch(0.98 0.002 250)",
      raised: "oklch(1 0 0)",
      ink: "oklch(0.22 0.01 255)",
      accent: "oklch(0.52 0.14 262)",
    },
  },
  {
    id: "dark",
    name: "After Dark",
    tagline: "The same workspace, dimmed for late shifts.",
    preview: {
      surface: "oklch(0.15 0.012 262)",
      raised: "oklch(0.19 0.013 262)",
      ink: "oklch(0.97 0.002 262)",
      accent: "oklch(0.68 0.15 262)",
    },
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * Resolve any stored or attribute value to a theme that still exists.
 * Retired ids map to their successor; anything else falls back to the
 * default. Never throws, so it is safe in the boot script.
 */
export function normaliseTheme(value: unknown): ThemeId {
  if (isThemeId(value)) return value;
  if (typeof value === "string" && value in RETIRED_THEME_IDS) {
    return RETIRED_THEME_IDS[value];
  }
  return DEFAULT_THEME;
}
