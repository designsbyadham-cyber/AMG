'use client';

import { useState } from 'react';
import { Car } from 'lucide-react';

import { brandInitials, brandLogoSrc, type CarBrand } from '@/lib/car-brands';
import { cn } from '@/lib/utils';

/**
 * Manufacturer mark for a vehicle.
 *
 * Two shapes:
 *  - `height` (preferred on cards) locks the vertical size and lets the
 *    width follow the artwork. The supplied logo set mixes circles
 *    (BMW), wide ovals (Land Rover) and wordmarks (Ford, Volvo); forcing
 *    them all into a square box shrinks the wide ones to nothing to make
 *    them fit. Matching on height is what makes them read as the same
 *    size to the eye.
 *  - `size` keeps the square chip, still used where the slot is fixed.
 *
 * Always renders something: the logo, then the brand's initials, then a
 * generic car glyph. A list is scanned down one edge, so a row that
 * renders nothing would break the alignment of every row after it.
 *
 * The chip is light in both themes on purpose. Most marks are near-black
 * (Audi, Mercedes, Porsche), so painting them onto a dark card surface
 * would erase them.
 */

interface BrandBadgeProps {
  brand: CarBrand | null;
  /** Fixed height, width follows the artwork. Wins over `size`. */
  height?: number;
  /** Fixed square box. */
  size?: number;
  /** Draw a hairline around the chip. Off by default. */
  bordered?: boolean;
  className?: string;
}

export function BrandBadge({
  brand,
  height,
  size = 36,
  bordered = false,
  className,
}: BrandBadgeProps) {
  const [failed, setFailed] = useState(false);
  const showLogo = brand !== null && !failed;

  const shell = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white',
    bordered && 'ring-1 ring-inset ring-black/10',
    className,
  );

  if (height) {
    return (
      <span
        className={cn(shell, 'justify-start')}
        // A DEFINITE box on both axes, deliberately.
        //
        // The previous version let the width come from the image
        // (`w-auto` inside a content-sized span) which is circular: the
        // span sized to the image while the image capped to the span.
        // Browsers resolve that inconsistently, and with lazy loading the
        // answer depended on whether the file had arrived yet — so the
        // same logo rendered at different sizes on different cards.
        //
        // Fixed box, `object-contain`, left-aligned: wide wordmarks fill
        // the width, round marks fill the height, and every card gets an
        // identical result every time.
        style={{ width: height * 2.6, height, padding: 2 }}
        title={brand?.name ?? 'Unknown make'}
      >
        {showLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={brandLogoSrc(brand)}
            alt={brand.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain object-left"
          />
        ) : brand ? (
          <span
            className="px-1 font-heading font-bold leading-none tracking-tight text-neutral-700"
            style={{ fontSize: height * 0.46 }}
          >
            {brandInitials(brand.name)}
          </span>
        ) : (
          <Car
            className="text-neutral-400"
            style={{ width: height * 0.6, height: height * 0.6 }}
          />
        )}
      </span>
    );
  }

  return (
    <span
      className={shell}
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
