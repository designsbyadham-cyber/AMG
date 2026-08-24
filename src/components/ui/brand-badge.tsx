'use client';

import { useState } from 'react';
import { Car } from 'lucide-react';

import { brandInitials, brandLogoSrc, type CarBrand } from '@/lib/car-brands';
import { cn } from '@/lib/utils';

/**
 * Manufacturer mark for a vehicle.
 *
 * Always renders something, in this order: the logo, then the brand's
 * initials, then a generic car glyph when the vehicle has no
 * identifiable make. A job log is scanned down the left edge, so a row
 * that renders nothing would break the alignment of every row after it.
 *
 * The chip is light in both themes on purpose. Most manufacturer marks
 * are near-black (Audi, Mercedes, Porsche), so painting them onto a
 * dark card surface would erase them.
 */

interface BrandBadgeProps {
  brand: CarBrand | null;
  /** Rendered box in px. */
  size?: number;
  /**
   * Draw a hairline around the chip. Off by default: on a white card the
   * chip is invisible anyway, so the ring only ever reads as a box drawn
   * around the mark.
   */
  bordered?: boolean;
  className?: string;
}

export function BrandBadge({
  brand,
  size = 36,
  bordered = false,
  className,
}: BrandBadgeProps) {
  const [failed, setFailed] = useState(false);
  const showLogo = brand !== null && !failed;

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-lg',
        'bg-white',
        bordered && 'ring-1 ring-inset ring-black/10',
        className,
      )}
      style={{ width: size, height: size }}
      title={brand?.name ?? 'Unknown make'}
    >
      {showLogo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={brandLogoSrc(brand)}
          alt={brand.name}
          width={size}
          height={size}
          loading="lazy"
          // A missing file must degrade to initials, not a broken image.
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-0.5"
        />
      ) : brand ? (
        <span
          className="font-heading font-bold leading-none tracking-tight text-neutral-700"
          style={{ fontSize: size * 0.34 }}
        >
          {brandInitials(brand.name)}
        </span>
      ) : (
        <Car className="text-neutral-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}
