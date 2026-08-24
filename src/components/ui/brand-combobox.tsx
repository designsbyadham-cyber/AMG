'use client';

import { useMemo } from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';

import { CAR_BRANDS, findBrand } from '@/lib/car-brands';
import { BrandBadge } from '@/components/ui/brand-badge';
import { cn } from '@/lib/utils';

/**
 * Make field with manufacturer autocomplete.
 *
 * Type "aud", and the list narrows while the input inline-completes to
 * "Audi"; Enter commits the canonical spelling. That is what stops the
 * same manufacturer arriving as "Porshce", "porsche" and "Porche".
 *
 * It stays a plain text field underneath. A workshop will eventually
 * take in a make that is not on the list, and a control that refuses
 * the booking is worse than one that occasionally stores an odd
 * spelling — so anything typed is kept, matched or not.
 */

interface BrandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function BrandCombobox({
  value,
  onChange,
  id,
  placeholder = 'Start typing a make',
  className,
}: BrandComboboxProps) {
  // Plain strings as items: base-ui filters them natively, and the row
  // still looks the brand up by name to draw its logo.
  const names = useMemo(() => CAR_BRANDS.map((b) => b.name), []);
  const selected = findBrand(value);

  return (
    <Autocomplete.Root
      items={names}
      value={value}
      onValueChange={(next) => onChange(next)}
      // `both` filters the list *and* inline-completes the input;
      // `autoHighlight` puts the caret on the first match so Enter
      // commits it without an arrow-key press first.
      mode="both"
      autoHighlight
    >
      <div className="relative">
        {/* The mark for whatever is currently committed, so the field
            confirms the match without opening the list. */}
        {selected && (
          <BrandBadge
            brand={selected}
            size={22}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
          />
        )}
        <Autocomplete.Input
          id={id}
          placeholder={placeholder}
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-muted px-2.5 text-sm text-foreground',
            'outline-none transition-colors placeholder:text-muted-foreground',
            'focus:border-primary focus:ring-1 focus:ring-primary',
            selected && 'pl-9',
            className,
          )}
        />
      </div>

      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} className="isolate z-50">
          <Autocomplete.Popup
            className={cn(
              'max-h-72 w-(--anchor-width) min-w-48 overflow-y-auto rounded-lg bg-popover p-1',
              'text-popover-foreground shadow-md ring-1 ring-foreground/10',
              'origin-(--transform-origin) duration-100',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <Autocomplete.Empty className="px-3 py-2 text-xs text-muted-foreground">
              No matching make. What you typed will be saved as-is.
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(name: string) => (
                <Autocomplete.Item
                  key={name}
                  value={name}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                    'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
                  )}
                >
                  <BrandBadge brand={findBrand(name)} size={24} />
                  {name}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
