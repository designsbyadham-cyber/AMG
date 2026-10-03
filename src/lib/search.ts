import type { Deal } from '@/types';
import { vehicleName } from '@/lib/jobs';
import { bookedAt } from '@/lib/dashboard';

/**
 * Matching for the dashboard's search, kept free of React so it can be
 * tested. Everything runs in the browser over rows already loaded: the
 * result list updates on every keystroke with no network round trip,
 * and no customer text is ever spliced into a database filter string.
 */

/** The columns search reads; a slim select keeps the payload small. */
export interface SearchContact {
  id: string;
  name?: string | null;
  phone: string;
  plate_number?: string | null;
  car_brand?: string | null;
  car_model?: string | null;
}

export interface SearchPage {
  href: string;
  label: string;
  hint: string;
  /** Other words people use for the same place. */
  keywords: string[];
}

export const SEARCH_PAGES: readonly SearchPage[] = [
  {
    href: '/pipelines',
    label: 'Jobs',
    hint: 'Job log and board',
    keywords: ['pipeline', 'board', 'deals', 'work'],
  },
  {
    href: '/contacts',
    label: 'Customers',
    hint: 'Everyone on record',
    keywords: ['contacts', 'clients', 'people'],
  },
  {
    href: '/inbox',
    label: 'Inbox',
    hint: 'WhatsApp conversations',
    keywords: ['messages', 'chat', 'whatsapp'],
  },
  {
    href: '/call-log',
    label: 'Call Log',
    hint: 'Who to call next',
    keywords: ['calls', 'phone', 'follow up'],
  },
  {
    href: '/broadcasts',
    label: 'Broadcasts',
    hint: 'Bulk WhatsApp sends',
    keywords: ['campaign', 'bulk', 'send'],
  },
  {
    href: '/automations',
    label: 'Automations',
    hint: 'Rules that run themselves',
    keywords: ['rules', 'triggers'],
  },
  {
    href: '/flows',
    label: 'Flows',
    hint: 'Conversation flows',
    keywords: ['bot', 'chatbot'],
  },
  {
    href: '/settings',
    label: 'Settings',
    hint: 'Profile, team, WhatsApp',
    keywords: ['profile', 'team', 'members', 'account', 'whatsapp', 'tags'],
  },
];

/** Letters and digits only, so "D12345" finds plate "D 12345". */
const compact = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Lower-cased words of the query, empty when there is nothing to match. */
export function queryWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * How well one word matches a set of fields: 0 when a field or a word
 * inside it starts with it, 1 when it appears anywhere (also with
 * spaces and punctuation ignored), -1 when it is absent.
 */
function wordRank(fields: (string | null | undefined)[], word: string): number {
  const cw = compact(word);
  let best = -1;
  for (const field of fields) {
    if (!field) continue;
    const v = field.toLowerCase();
    if (
      v.startsWith(word) ||
      v.split(/[\s/,-]+/).some((w) => w.startsWith(word))
    )
      return 0;
    if (v.includes(word) || (cw.length >= 2 && compact(v).includes(cw)))
      best = 1;
  }
  return best;
}

/**
 * Every word must match some field, so "porsche james" narrows rather
 * than widens. The rank is the weakest word's: lower is better, -1 is
 * no match.
 */
export function matchRank(
  fields: (string | null | undefined)[],
  words: string[]
): number {
  if (words.length === 0) return -1;
  let worst = 0;
  for (const word of words) {
    const r = wordRank(fields, word);
    if (r < 0) return -1;
    worst = Math.max(worst, r);
  }
  return worst;
}

export function jobFields(
  deal: Deal,
  stageName?: string
): (string | null | undefined)[] {
  return [
    vehicleName(deal),
    deal.title,
    deal.contact?.name,
    deal.contact?.phone,
    deal.contact?.plate_number,
    stageName,
  ];
}

/** Matching jobs, best match first, then most recently booked. */
export function searchJobs(
  deals: Deal[],
  query: string,
  stageName: Map<string, string>
): Deal[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return deals
    .map((deal) => ({
      deal,
      rank: matchRank(jobFields(deal, stageName.get(deal.stage_id)), words),
    }))
    .filter((r) => r.rank >= 0)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (bookedAt(b.deal)?.getTime() ?? 0) - (bookedAt(a.deal)?.getTime() ?? 0)
    )
    .map((r) => r.deal);
}

/** Matching customers, best match first, then alphabetically. */
export function searchContacts(
  contacts: SearchContact[],
  query: string
): SearchContact[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return contacts
    .map((c) => ({
      c,
      rank: matchRank(
        [
          c.name,
          c.phone,
          c.plate_number,
          [c.car_brand, c.car_model].filter(Boolean).join(' '),
        ],
        words
      ),
    }))
    .filter((r) => r.rank >= 0)
    .sort(
      (a, b) =>
        a.rank - b.rank || (a.c.name ?? '').localeCompare(b.c.name ?? '')
    )
    .map((r) => r.c);
}

/** Matching pages; every page when the query is empty. */
export function searchPages(query: string): SearchPage[] {
  const words = queryWords(query);
  if (words.length === 0) return [...SEARCH_PAGES];
  return SEARCH_PAGES.filter(
    (p) => matchRank([p.label, p.hint, ...p.keywords], words) >= 0
  );
}

/**
 * Splits text into plain and matched runs for highlighting. Returns
 * strings, never markup, so customer-entered text stays inert.
 */
export function highlightParts(
  text: string,
  query: string
): { text: string; match: boolean }[] {
  const words = queryWords(query);
  if (!text || words.length === 0) return [{ text, match: false }];
  const escaped = words
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: words.includes(part.toLowerCase()) }));
}
