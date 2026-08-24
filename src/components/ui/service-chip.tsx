'use client';

import { Armchair, Car, Sparkles, Sun, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Service chip.
 *
 * Square-cornered, tinted, and carrying its own mark — the reference's
 * chip treatment. These hues are categorical: they encode *which*
 * service, so they deliberately sit outside the semantic tokens the
 * rest of the app uses. Each carries a light shade with a `dark:`
 * partner so it holds on both themes.
 */

const SERVICE_META: Record<
  string,
  { icon: typeof Car; chip: string; iconClass: string }
> = {
  'Interior Upgrades': {
    icon: Armchair,
    chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    iconClass: 'text-indigo-500 dark:text-indigo-400',
  },
  'Exterior Upgrades': {
    icon: Car,
    chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    iconClass: 'text-sky-500 dark:text-sky-400',
  },
  'Detailing & Protection': {
    icon: Sparkles,
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  Tinting: {
    icon: Sun,
    chip: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    iconClass: 'text-violet-500 dark:text-violet-400',
  },
};

const FALLBACK = {
  icon: Wrench,
  chip: 'bg-muted text-muted-foreground',
  iconClass: 'text-muted-foreground',
};

export function ServiceChip({
  service,
  className,
}: {
  service: string;
  className?: string;
}) {
  const meta = SERVICE_META[service] ?? FALLBACK;
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
        meta.chip,
        className,
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', meta.iconClass)} strokeWidth={2} />
      {service}
    </span>
  );
}
