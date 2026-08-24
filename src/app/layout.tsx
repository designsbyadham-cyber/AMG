import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemedToaster } from "@/components/ui/themed-toaster";
import {
  DEFAULT_THEME,
  RETIRED_THEME_IDS,
  STORAGE_KEY,
  THEME_IDS,
} from "@/lib/themes";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AMG Operations",
    template: "%s — AMG Operations",
  },
  description: "AMG Operations — Automillenium Group service management.",
  robots: {
    index: false,
    follow: false,
  },
  // Browser favicon + Apple touch icon are provided by the file
  // conventions src/app/icon.svg and src/app/apple-icon.png.
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  // First paint only; ThemeProvider rewrites this to the active
  // theme surface once mounted.
  themeColor: "#fafafa",
  colorScheme: "light dark",
};

// Inline boot script — runs before React hydrates so the chosen theme
// is on the <html> element before first paint. Without it every load
// flashes Daylight for a frame before the React tree mounts and
// applies a saved After Dark preference.
//
// Kept dependency-free (no imports, no JSX) — it must be a string the
// browser can run as a single <script>. Valid and retired theme ids
// are injected from src/lib/themes.ts so the boot path cannot drift
// from the catalog.
const THEME_BOOT_SCRIPT = `
(function(){
  try {
    var STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
    var DEFAULT = ${JSON.stringify(DEFAULT_THEME)};
    var ALLOWED = ${JSON.stringify(THEME_IDS)};
    var RETIRED = ${JSON.stringify(RETIRED_THEME_IDS)};
    var saved = localStorage.getItem(STORAGE_KEY);
    var theme = ALLOWED.indexOf(saved) !== -1
      ? saved
      : (Object.prototype.hasOwnProperty.call(RETIRED, saved) ? RETIRED[saved] : DEFAULT);
    document.documentElement.dataset.theme = theme;
    // Rewrite the stored value too, so a retired id is migrated once
    // rather than re-resolved on every single page load.
    if (theme !== saved) localStorage.setItem(STORAGE_KEY, theme);
  } catch (_e) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${inter.variable} h-full antialiased`}
      // The `theme-boot` script below rewrites `data-theme` on <html>
      // from localStorage before React hydrates, so for any non-default
      // theme the client DOM intentionally differs from the server-
      // rendered `DEFAULT_THEME`. suppressHydrationWarning silences the
      // expected mismatch — it only applies to this element's own
      // attributes, so genuine mismatches in children still surface.
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
