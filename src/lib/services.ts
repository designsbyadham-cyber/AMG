// Single source of truth for the optional service options a customer
// can pick. Used by the contact form (multi-select), the customers
// table, the contact detail view, and the pipeline job cards.

export const SERVICE_TYPES = [
  'Interior Upgrades',
  'Exterior Upgrades',
  'Detailing & Protection',
  'Tinting',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// Badge colours keyed by service name. Unknown values fall back to a
// neutral style at the call site.
/**
 * Services are categories, not signals, so they don't get their own
 * hues — four coloured chips per card was most of the visual noise on
 * the job list. One neutral chip; the label carries the meaning.
 */
export const SERVICE_CHIP_CLASS = 'bg-muted text-muted-foreground';

/**
 * Normalise a contact's services into a string array, regardless of
 * whether it was saved as the new multi-select `service_types` array or
 * the legacy single `service_type` value. Backward compatible: records
 * that only have the old column still resolve correctly.
 */
export function getServiceTypes(
  c?: { service_types?: string[] | null; service_type?: string | null } | null,
): string[] {
  if (!c) return [];
  if (c.service_types && c.service_types.length > 0) return c.service_types;
  if (c.service_type) return [c.service_type];
  return [];
}
