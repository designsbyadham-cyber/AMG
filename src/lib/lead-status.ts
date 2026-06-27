/**
 * Lead temperature catalog — the Cold / Warm / Hot label a contact
 * can carry. Stored in `contacts.lead_status` (migration 025) as the
 * lowercase id; NULL means unlabeled.
 *
 * `badge` styles the read-only chip; `active` styles a selected
 * option in the picker. Colors are intentionally semantic (blue =
 * cold, amber = warm, red = hot) and use /10–/15 tints so they read
 * correctly on the dark themed cards.
 */

export const LEAD_STATUSES = ['cold', 'warm', 'hot'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; badge: string; active: string }
> = {
  cold: {
    label: 'Cold',
    badge: 'bg-blue-500/10 text-blue-500',
    active: 'border-blue-500 bg-blue-500/15 text-blue-500',
  },
  warm: {
    label: 'Warm',
    badge: 'bg-amber-500/10 text-amber-500',
    active: 'border-amber-500 bg-amber-500/15 text-amber-500',
  },
  hot: {
    label: 'Hot',
    badge: 'bg-red-500/10 text-red-500',
    active: 'border-red-500 bg-red-500/15 text-red-500',
  },
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === 'string' &&
    (LEAD_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
