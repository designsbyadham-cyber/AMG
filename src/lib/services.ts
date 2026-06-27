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
export const SERVICE_TYPE_COLORS: Record<string, string> = {
  'Interior Upgrades': 'bg-purple-500/10 text-purple-600',
  'Exterior Upgrades': 'bg-blue-500/10 text-blue-600',
  'Detailing & Protection': 'bg-emerald-500/10 text-emerald-600',
  Tinting: 'bg-amber-500/10 text-amber-600',
};

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
