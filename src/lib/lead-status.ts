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
    badge: 'bg-muted text-muted-foreground',
    active: 'border-border bg-muted text-foreground',
  },
  warm: {
    label: 'Warm',
    badge: 'bg-accent text-foreground',
    active: 'border-foreground/25 bg-accent text-foreground',
  },
  hot: {
    label: 'Hot',
    badge: 'bg-primary-soft text-primary',
    active: 'border-primary bg-primary-soft text-primary',
  },
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === 'string' &&
    (LEAD_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
