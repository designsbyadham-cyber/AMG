/**
 * Call Log catalog — the three buckets a contact moves through as you
 * work the phone list, plus the outcome of the last call attempt.
 * Stored on `contacts` (migration 026).
 *
 * Buckets:
 *   not_contacted -> "To Contact": never reached out yet
 *   follow_up     -> "Follow Up": missed call / scheduled callback
 *   contacted     -> "Contacted": reached (answered or messaged)
 */

import type { Contact } from '@/types';

export const CONTACT_STATUSES = ['not_contacted', 'follow_up', 'contacted'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_META: Record<
  ContactStatus,
  { label: string; blurb: string; accent: string; badge: string }
> = {
  not_contacted: {
    label: 'To Contact',
    blurb: "Haven't reached out yet",
    accent: '#f59e0b', // amber — needs a first call
    badge: 'bg-amber-500/10 text-amber-500',
  },
  follow_up: {
    label: 'Follow Up',
    blurb: 'Missed call or scheduled callback',
    accent: '#3b82f6', // blue — awaiting a callback
    badge: 'bg-blue-500/10 text-blue-500',
  },
  contacted: {
    label: 'Contacted',
    blurb: 'Reached by call or message',
    accent: '#10b981', // green — done
    badge: 'bg-emerald-500/10 text-emerald-500',
  },
};

export type CallOutcome = 'answered' | 'no_answer';

export const CALL_OUTCOME_META: Record<CallOutcome, { label: string; badge: string }> = {
  answered: { label: 'Answered', badge: 'bg-emerald-500/10 text-emerald-500' },
  no_answer: { label: 'No answer', badge: 'bg-red-500/10 text-red-500' },
};

/** Read a contact's bucket, defaulting to not_contacted for legacy rows. */
export function getContactStatus(c?: Contact | null): ContactStatus {
  const s = c?.contact_status;
  return s === 'contacted' || s === 'follow_up' ? s : 'not_contacted';
}

/**
 * Derive the bucket from what the user logged in the modal. A call that
 * connected (or a message sent with no call) counts as "contacted"; a
 * missed call, or a scheduled callback with no other action, is a
 * follow-up; nothing logged leaves them to-contact.
 */
export function deriveContactStatus(input: {
  outcome: CallOutcome | null;
  messaged: boolean;
  followUp: string | null;
}): ContactStatus {
  if (input.outcome === 'answered') return 'contacted';
  if (input.outcome === 'no_answer') return 'follow_up';
  if (input.messaged) return 'contacted';
  if (input.followUp) return 'follow_up';
  return 'not_contacted';
}

/** YYYY-MM-DD `n` days from today, for defaulting the follow-up date. */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local midnight ISO date (YYYY-MM-DD) for "today" comparisons. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Short relative label for a date-only value, e.g. "Overdue 2d",
 * "Today", "in 3d". Positive = future, negative = past.
 */
export function relativeDay(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date(todayISO()).getTime();
  const target = new Date(dateStr.slice(0, 10)).getTime();
  const days = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (days === 0) return { label: 'Today', overdue: false };
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, overdue: true };
  return { label: `in ${days}d`, overdue: false };
}

/** "5d ago" / "today" for a timestamp. */
export function daysAgo(ts: string): string {
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
