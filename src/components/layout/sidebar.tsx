"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  ChevronDown,
  ChevronsUpDown,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PhoneCall,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Per-role chip metadata used in the sidebar's account strip + the
// Members tab roster. Keeping this near both consumers in a single
// place avoids drift between the two surfaces — when a designer
// wants to recolour "agent" rows, this is the one diff.
const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    // Amber: scarce, immutable, "the boss" — gets visual emphasis.
    label: "Owner",
    className: "border-warning/40 bg-warning-soft text-warning",
  },
  admin: {
    icon: Shield,
    // Primary-tinted: significant but not as scarce as owner.
    label: "Admin",
    className: "border-primary/40 bg-primary-soft text-primary",
  },
  agent: {
    icon: UserCog,
    // Neutral: the operational default.
    label: "Agent",
    className: "border-border bg-muted text-muted-foreground",
  },
  viewer: {
    icon: User,
    // Muted: read-only role; visually quieter than agent.
    label: "Viewer",
    className: "border-border bg-muted/60 text-muted-foreground/70",
  },
};

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /**
   * When true, the nav row renders a small "Beta" chip after the label.
   * Purely informational — doesn't affect routing or access.
   */
  beta?: boolean;
}

/** Day-to-day work. Always visible, never collapsed. */
const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/contacts", label: "Customers", icon: Users },
  { href: "/call-log", label: "Call Log", icon: PhoneCall },
  { href: "/pipelines", label: "Jobs", icon: GitBranch },
];

/** Set-up-once tooling. Grouped so it stops competing with the daily work. */
const outreachNav: NavItem[] = [
  { href: "/broadcasts", label: "Broadcasts", icon: Radio },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/flows", label: "Flows", icon: Workflow, beta: true },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const totalUnread = useTotalUnread();
  const [outreachOpen, setOutreachOpen] = useState(true);

  // Only surface the account-name strip when it actually carries
  // information. A solo user's personal account is named after them
  // (the 017 signup trigger seeds it from `full_name`), so showing it
  // here would just duplicate the user name above. Once the account is
  // renamed or the user joins a shared account, the name diverges and
  // the strip becomes meaningful — that's the signal we gate on. Wait
  // for the profile fetch to settle first, otherwise the strip flashes
  // in once the row resolves (a layout jump).
  const showAccountStrip =
    !profileLoading && !!account?.name && account.name !== profile?.full_name;

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function isRouteActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Part of the page, not an object on it: full-bleed, square, no
          frame and no divider. It separates from the content area by
          surface tone alone. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-[16.5rem] flex-col bg-sidebar",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-64 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ── Brand ─────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-start gap-2.5 px-4 pt-4 pb-3">
            <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
              {/* logo.png is a 6:1 lockup whose wordmark half is white
                  artwork — invisible on a light panel — while the mark
                  itself is dark. So: clip to the mark, set the name as
                  live text, and keep the chip light in both themes or
                  the dark mark disappears on After Dark.

                  Crop measured from the file, not eyeballed: the mark
                  occupies x 2.39%–24.10% of the image, centred at
                  13.24%. Scaling to 358% makes it ~28px inside the 36px
                  chip, and translating by its own centre lands it dead
                  centre; the crop is proportional, so the chip can be
                  resized freely. Re-measure if the asset is replaced. */}
              <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt=""
                  aria-hidden
                  className="absolute left-1/2 top-1/2 w-[358%] max-w-none -translate-x-[13.24%] -translate-y-1/2"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-heading text-base font-bold leading-tight text-foreground">
                  AMG Operations
                </span>
                <span className="block truncate text-xs leading-tight text-muted-foreground">
                  Service CRM
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="-mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* ── Account switcher ──────────────────────────────────── */}
          <div className="shrink-0 px-3 pb-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2 py-1.5 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted">
                <Avatar className="size-7 shrink-0">
                  {profile?.avatar_url ? (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.full_name ?? "Avatar"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                    {profile?.full_name?.charAt(0)?.toUpperCase() ??
                      profile?.email?.charAt(0)?.toUpperCase() ??
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="min-w-0 flex-1 truncate text-sm text-foreground"
                  title={profile?.email ?? undefined}
                >
                  {profile?.email ?? profile?.full_name ?? "Account"}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={6}
                className="min-w-56 bg-popover text-popover-foreground ring-border"
              >
                {showAccountStrip && account?.name ? (
                  <>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                      <UsersRound className="size-3.5 shrink-0" />
                      {/* `title=` exposes the full name on hover when it
                          gets truncated (long account names). */}
                      <span className="truncate" title={account.name}>
                        {account.name}
                      </span>
                      {accountRole ? <RoleChip role={accountRole} /> : null}
                    </div>
                    <DropdownMenuSeparator className="bg-border" />
                  </>
                ) : null}
                <DropdownMenuItem
                  render={
                    <Link
                      href="/settings?tab=profile"
                      onClick={onClose}
                      className="text-foreground focus:bg-muted focus:text-foreground"
                    />
                  }
                >
                  <User className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      href="/settings?tab=whatsapp"
                      onClick={onClose}
                      className="text-foreground focus:bg-muted focus:text-foreground"
                    />
                  }
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-foreground focus:bg-muted focus:text-foreground"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mx-3 shrink-0 border-t border-border" />

          {/* ── Navigation ────────────────────────────────────────── */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <ul className="flex flex-col gap-0.5">
              {primaryNav.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isRouteActive(item.href)}
                  count={item.href === "/inbox" ? totalUnread : 0}
                />
              ))}
            </ul>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setOutreachOpen((v) => !v)}
                aria-expanded={outreachOpen}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground transition-colors hover:text-primary"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    !outreachOpen && "-rotate-90",
                  )}
                />
                Outreach
              </button>

              {outreachOpen && (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {outreachNav.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isRouteActive(item.href)}
                      indented
                    />
                  ))}
                </ul>
              )}
            </div>
          </nav>

          {/* ── Settings ──────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border px-3 py-3">
            <ul>
              <NavRow
                item={{ href: "/settings", label: "Settings", icon: Settings }}
                active={isRouteActive("/settings")}
              />
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

function RoleChip({ role }: { role: AccountRole }) {
  const meta = ROLE_CHIP[role];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        meta.className,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

/**
 * One navigation row.
 *
 * The active state is a light bubble plus an accent dash pinned to the
 * panel's left edge. The dash is what makes the current section findable
 * in peripheral vision — a grey fill alone is easy to miss on a white
 * panel, and colouring the whole row would put a second loud element
 * next to the page it already highlights.
 */
function NavRow({
  item,
  active,
  count = 0,
  indented,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  indented?: boolean;
}) {
  return (
    <li className="relative">
      {active && (
        <span
          aria-hidden
          // -left-3 escapes the nav's px-3 to sit flush on the panel edge.
          className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // Taller on mobile so fingers can hit the row reliably (≥44px).
          "flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition-colors lg:py-2",
          indented && "pl-4",
          active
            ? "bg-muted font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <item.icon
          // Lighter than the lucide default so the icon set reads as one
          // unified line weight rather than as bold glyphs.
          strokeWidth={1.75}
          className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.beta && (
          <span
            aria-label="Beta feature"
            className="shrink-0 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning"
          >
            Beta
          </span>
        )}
        {count > 0 && (
          <span
            aria-label={`${count} unread conversation${count === 1 ? "" : "s"}`}
            className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
          >
            {count.toLocaleString()}
          </span>
        )}
      </Link>
    </li>
  );
}
