'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  ArrowRight,
  CornerDownLeft,
  GitBranch,
  MessageSquare,
  PhoneCall,
  Radio,
  Search,
  Settings,
  User,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import type { Deal } from '@/types';
import { brandForContact } from '@/lib/car-brands';
import { BrandBadge } from '@/components/ui/brand-badge';
import { Input } from '@/components/ui/input';
import { formatCurrency, vehicleName } from '@/lib/jobs';
import {
  highlightParts,
  searchContacts,
  searchJobs,
  searchPages,
  type SearchContact,
  type SearchPage,
} from '@/lib/search';
import { EASE_OUT, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * The dashboard's search: a command palette anchored under the field.
 *
 * Results appear as you type, right where you are looking. The first
 * version filtered the jobs table at the bottom of the page, which was
 * correct but invisible: nothing near the field changed, so it read as
 * a placeholder. Now every result is one press away from the record it
 * names: a job opens its card on the Jobs board, a customer opens their
 * profile, and a page goes to that page.
 *
 * Jobs come from the rows the dashboard already holds. Customers load
 * once, on first focus, so a visit that never searches costs nothing.
 */

const JOB_LIMIT = 5;
const CUSTOMER_LIMIT = 4;
const PAGE_LIMIT = 4;

const PAGE_ICONS: Record<string, LucideIcon> = {
  '/pipelines': GitBranch,
  '/contacts': Users,
  '/inbox': MessageSquare,
  '/call-log': PhoneCall,
  '/broadcasts': Radio,
  '/automations': Zap,
  '/flows': Workflow,
  '/settings': Settings,
};

type Item =
  | { kind: 'job'; key: string; href: string; deal: Deal }
  | { kind: 'customer'; key: string; href: string; contact: SearchContact }
  | { kind: 'page'; key: string; href: string; page: SearchPage }
  | { kind: 'all-jobs'; key: string; total: number };

interface Group {
  id: string;
  label: string;
  items: Item[];
}

const noopSubscribe = () => () => {};

/** Platform for the shortcut hint. Server render assumes not-Mac. */
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false
  );
}

export function CommandSearch({
  deals,
  stageName,
  onShowAllJobs,
}: {
  deals: Deal[] | null;
  stageName?: Map<string, string>;
  /** "Show all N matching jobs": hand the query to the table below. */
  onShowAllJobs: (query: string) => void;
}) {
  const router = useRouter();
  const isMac = useIsMac();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [contacts, setContacts] = useState<SearchContact[] | null>(null);
  const contactsRequested = useRef(false);

  // Customers are fetched on first focus, not on page load.
  const ensureContacts = useCallback(async () => {
    if (contactsRequested.current) return;
    contactsRequested.current = true;
    const { data, error } = await createClient()
      .from('contacts')
      .select('id, name, phone, plate_number, car_brand, car_model')
      .order('updated_at', { ascending: false })
      .limit(2000);
    if (error) {
      // Leave the door open for a retry on the next focus. Jobs and
      // pages still search in the meantime.
      contactsRequested.current = false;
      return;
    }
    setContacts((data ?? []) as SearchContact[]);
  }, []);

  // ⌘K / Ctrl+K from anywhere on the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups: Group[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return [
        {
          id: 'pages',
          label: 'Jump to',
          items: searchPages('').map((page) => ({
            kind: 'page' as const,
            key: `page:${page.href}`,
            href: page.href,
            page,
          })),
        },
      ];
    }

    const jobs = deals ? searchJobs(deals, q, stageName ?? new Map()) : [];
    const people = contacts ? searchContacts(contacts, q) : [];
    const pages = searchPages(q);

    const jobItems: Item[] = jobs.slice(0, JOB_LIMIT).map((deal) => ({
      kind: 'job',
      key: `job:${deal.id}`,
      href: `/pipelines?job=${encodeURIComponent(deal.id)}`,
      deal,
    }));
    if (jobs.length > JOB_LIMIT) {
      jobItems.push({ kind: 'all-jobs', key: 'all-jobs', total: jobs.length });
    }

    return [
      { id: 'jobs', label: 'Jobs', items: jobItems },
      {
        id: 'customers',
        label: 'Customers',
        items: people.slice(0, CUSTOMER_LIMIT).map((contact) => ({
          kind: 'customer' as const,
          key: `customer:${contact.id}`,
          href: `/contacts?customer=${encodeURIComponent(contact.id)}`,
          contact,
        })),
      },
      {
        id: 'pages',
        label: 'Pages',
        items: pages.slice(0, PAGE_LIMIT).map((page) => ({
          kind: 'page' as const,
          key: `page:${page.href}`,
          href: page.href,
          page,
        })),
      },
    ].filter((g) => g.items.length > 0);
  }, [query, deals, contacts, stageName]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = Math.min(activeIndex, Math.max(0, flat.length - 1));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const choose = (item: Item) => {
    setOpen(false);
    if (item.kind === 'all-jobs') {
      onShowAllJobs(query.trim());
      inputRef.current?.blur();
      return;
    }
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (flat.length === 0) return;
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((active + step + flat.length) % flat.length);
        return;
      }
      case 'Enter':
        if (open && flat[active]) {
          e.preventDefault();
          choose(flat[active]);
        }
        return;
      case 'Escape':
        // First press closes the list, second clears, third leaves.
        if (open) setOpen(false);
        else if (query) setQuery('');
        else e.currentTarget.blur();
        return;
      case 'Tab':
        setOpen(false);
        return;
    }
  };

  const q = query.trim();
  const hasResults = flat.length > 0;

  return (
    <div
      className="relative w-full sm:max-w-sm"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
      />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          void ensureContacts();
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search jobs, customers, pages…"
        role="combobox"
        aria-label="Search jobs, customers and pages"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && hasResults ? optionId(active) : undefined
        }
        autoComplete="off"
        spellCheck={false}
        className="bg-card h-9 pr-16 pl-9 transition-shadow duration-200 focus-visible:shadow-md"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setActiveIndex(0);
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="border-border bg-muted text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 font-sans text-[10px] font-medium">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -4,
              scale: 0.98,
              transition: { duration: 0.12 },
            }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            style={{ transformOrigin: 'top left' }}
            // Pressing inside the panel must not blur the field, or the
            // list would close before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            className="border-border bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border shadow-lg sm:w-[30rem]"
          >
            <motion.div
              layoutScroll
              id={listId}
              role="listbox"
              aria-label="Search results"
              className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5"
            >
              <LayoutGroup id="search-results">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    role="group"
                    aria-labelledby={`${listId}-${group.id}`}
                    className="py-1"
                  >
                    <div
                      id={`${listId}-${group.id}`}
                      className="text-muted-foreground px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wider uppercase"
                    >
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const index = flat.indexOf(item);
                      return (
                        <Option
                          key={item.key}
                          id={optionId(index)}
                          item={item}
                          query={q}
                          active={index === active}
                          stage={
                            item.kind === 'job'
                              ? stageName?.get(item.deal.stage_id)
                              : undefined
                          }
                          onHover={() => setActiveIndex(index)}
                          onChoose={() => choose(item)}
                        />
                      );
                    })}
                  </div>
                ))}
              </LayoutGroup>

              {!hasResults && (
                <div className="px-4 py-8 text-center">
                  <p className="text-foreground text-sm">
                    No matches for “{q}”
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Try a plate, a phone number, a make or a customer&apos;s
                    name.
                  </p>
                </div>
              )}
              {q && contacts === null && (
                <p className="text-muted-foreground px-2.5 pt-1 pb-2 text-xs">
                  Loading customers…
                </p>
              )}
            </motion.div>

            <footer className="border-border bg-muted/40 text-muted-foreground hidden items-center gap-4 border-t px-3 py-2 text-[11px] sm:flex">
              <span className="flex items-center gap-1">
                <Key>↑</Key>
                <Key>↓</Key> to move
              </span>
              <span className="flex items-center gap-1">
                <Key>↵</Key> to open
              </span>
              <span className="flex items-center gap-1">
                <Key>esc</Key> to close
              </span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-card text-muted-foreground inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 font-sans text-[10px] font-medium">
      {children}
    </kbd>
  );
}

/** Matched runs set in full ink, the rest a step quieter. */
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="text-foreground bg-transparent font-semibold"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

function Option({
  id,
  item,
  query,
  active,
  stage,
  onHover,
  onChoose,
}: {
  id: string;
  item: Item;
  query: string;
  active: boolean;
  stage?: string;
  onHover: () => void;
  onChoose: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      // mousemove, not mouseenter: a list that scrolls under a resting
      // pointer must not steal the keyboard's place.
      onMouseMove={active ? undefined : onHover}
      onClick={onChoose}
      className="relative flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm"
    >
      {active && (
        <motion.span
          layoutId="search-active"
          aria-hidden
          transition={SPRING}
          className="bg-muted absolute inset-0 rounded-lg"
        />
      )}
      <span className="relative flex min-w-0 flex-1 items-center gap-3">
        <OptionBody item={item} query={query} stage={stage} />
      </span>
      <CornerDownLeft
        aria-hidden
        className={cn(
          'text-muted-foreground relative hidden size-3.5 shrink-0 transition-opacity duration-150 sm:block',
          active ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

function OptionBody({
  item,
  query,
  stage,
}: {
  item: Item;
  query: string;
  stage?: string;
}) {
  switch (item.kind) {
    case 'job': {
      const { deal } = item;
      const sub = [
        deal.contact?.name || deal.contact?.phone,
        deal.contact?.plate_number,
        stage,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <>
          <BrandBadge
            brand={brandForContact(deal.contact)}
            size={28}
            bordered
            className="rounded-md"
          />
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate">
              <Highlight text={vehicleName(deal)} query={query} />
            </span>
            {sub && (
              <span className="text-muted-foreground block truncate text-xs">
                <Highlight text={sub} query={query} />
              </span>
            )}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatCurrency(Number(deal.value || 0))}
          </span>
        </>
      );
    }
    case 'customer': {
      const { contact } = item;
      const name = contact.name || contact.phone;
      const vehicle = [contact.car_brand, contact.car_model]
        .filter(Boolean)
        .join(' ');
      const sub = [
        contact.name ? contact.phone : null,
        contact.plate_number,
        vehicle,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <>
          <span className="bg-primary-soft text-primary grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">
            {/* No name means no initial worth showing; a phone number's
                first character is a "+". */}
            {contact.name?.trim() ? (
              contact.name.trim().charAt(0).toUpperCase()
            ) : (
              <User className="size-3.5" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate">
              <Highlight text={name} query={query} />
            </span>
            {sub && (
              <span className="text-muted-foreground block truncate text-xs">
                <Highlight text={sub} query={query} />
              </span>
            )}
          </span>
        </>
      );
    }
    case 'page': {
      const Icon = PAGE_ICONS[item.page.href] ?? ArrowRight;
      return (
        <>
          <span className="border-border bg-card text-muted-foreground grid size-7 shrink-0 place-items-center rounded-md border">
            <Icon className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="text-foreground">
              <Highlight text={item.page.label} query={query} />
            </span>
            <span className="text-muted-foreground ml-2 text-xs">
              {item.page.hint}
            </span>
          </span>
        </>
      );
    }
    case 'all-jobs':
      return (
        <>
          <span className="bg-primary-soft text-primary grid size-7 shrink-0 place-items-center rounded-md">
            <ArrowRight className="size-3.5" />
          </span>
          <span className="text-primary flex-1 font-medium">
            Show all {item.total} matching jobs
          </span>
        </>
      );
  }
}
