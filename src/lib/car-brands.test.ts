import { describe, expect, it } from 'vitest';

import {
  CAR_BRANDS,
  brandForContact,
  brandInitials,
  brandLogoSrc,
  detectBrand,
  findBrand,
} from './car-brands';

/**
 * Fixtures are real `car_model` values from the production database, not
 * invented ones. That is the whole point: the matcher exists to cope
 * with what people actually typed.
 */
describe('detectBrand', () => {
  it('finds a brand stated plainly', () => {
    expect(detectBrand('bmw 318i')?.name).toBe('BMW');
    expect(detectBrand('Honda accord 2010')?.name).toBe('Honda');
    expect(detectBrand('2023 Volkswagen Touareg')?.name).toBe('Volkswagen');
  });

  it('ignores a leading model year', () => {
    expect(detectBrand('1995 Nissan Skyline GTR 33')?.name).toBe('Nissan');
    expect(detectBrand('2013 Porsche Boxter')?.name).toBe('Porsche');
  });

  it('recovers the brand from a model-only entry', () => {
    // ~90% of imported rows look like this — no brand token at all.
    expect(detectBrand('altima')?.name).toBe('Nissan');
    expect(detectBrand('defender')?.name).toBe('Land Rover');
    expect(detectBrand('bentayga')?.name).toBe('Bentley');
    expect(detectBrand('G63')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('2016 Lr4')?.name).toBe('Land Rover');
    expect(detectBrand('continental GT')?.name).toBe('Bentley');
  });

  it('tolerates the misspellings seen in the data', () => {
    expect(detectBrand('Porshce cayenne turbo')?.name).toBe('Porsche');
    expect(detectBrand('Cayanne 2016 to 2025')?.name).toBe('Porsche');
    expect(detectBrand('Infinti g 37')?.name).toBe('Infiniti');
    expect(detectBrand('2013 Porsche Boxter')?.name).toBe('Porsche');
  });

  it('is case and separator insensitive', () => {
    expect(detectBrand('MERCEDES')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('mercedes-benz')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('mercedes_benz')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('  Land   Rover ')?.name).toBe('Land Rover');
  });

  it('takes the first brand named when a row lists two cars', () => {
    // Predictable beats clever: the row leads with the Audi.
    expect(detectBrand('Audi tsq8, Porshce cayenne turbo')?.name).toBe('Audi');
    expect(detectBrand('Defender 2 doors, Mercedes gle 450')?.name).toBe('Land Rover');
    expect(detectBrand('270 Z, kia carnival')?.name).toBe('Kia');
  });

  it('prefers the longer phrase at the same position', () => {
    expect(detectBrand('range rover sport')?.name).toBe('Land Rover');
    expect(detectBrand('alfa romeo giulia')?.name).toBe('Alfa Romeo');
  });

  it('returns null rather than guessing', () => {
    expect(detectBrand('Classic Car')).toBeNull();
    expect(detectBrand('4 x 4')).toBeNull();
    expect(detectBrand('')).toBeNull();
    expect(detectBrand(null)).toBeNull();
    expect(detectBrand(undefined)).toBeNull();
  });

  it('matches whole words only, never substrings', () => {
    // The bug this guards against is real: a substring scan over the
    // live data matched RAM inside unrelated words.
    expect(detectBrand('ramadan booking')).toBeNull();
    expect(detectBrand('minimal wrap')).toBeNull();
    expect(detectBrand('affordable')).toBeNull();
  });

  it('does not treat furniture as a manufacturer', () => {
    // An interior shop says "seat" constantly. SEAT stays selectable by
    // hand but must never be inferred.
    expect(detectBrand('leather seat covers')).toBeNull();
    expect(detectBrand('replace driver seat')).toBeNull();
  });
});

describe('brandForContact', () => {
  it('trusts car_brand when it is set', () => {
    expect(brandForContact({ car_brand: 'toyota', car_model: '4 x 4' })?.name).toBe('Toyota');
    expect(brandForContact({ car_brand: 'Land Rover', car_model: 'Defender' })?.name).toBe(
      'Land Rover',
    );
  });

  it('falls back to the model text when car_brand is empty', () => {
    expect(brandForContact({ car_brand: null, car_model: 'bmw 318i' })?.name).toBe('BMW');
    expect(brandForContact({ car_brand: null, car_model: 'defender' })?.name).toBe('Land Rover');
  });

  it('handles missing contacts and empty vehicles', () => {
    expect(brandForContact(null)).toBeNull();
    expect(brandForContact(undefined)).toBeNull();
    expect(brandForContact({ car_brand: null, car_model: null })).toBeNull();
  });
});

describe('findBrand', () => {
  it('resolves a canonical name or an id', () => {
    expect(findBrand('Mercedes-Benz')?.id).toBe('mercedes-benz');
    expect(findBrand('mercedes-benz')?.id).toBe('mercedes-benz');
    expect(findBrand('BMW')?.id).toBe('bmw');
  });

  it('does not resolve an alias or a model', () => {
    // findBrand answers "is this exactly a catalog make?", which is a
    // narrower question than detectBrand answers.
    expect(findBrand('benz')).toBeNull();
    expect(findBrand('defender')).toBeNull();
    expect(findBrand('Some Custom Make')).toBeNull();
  });
});

describe('catalog integrity', () => {
  it('has unique ids', () => {
    const ids = CAR_BRANDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses ids that are safe as filenames', () => {
    for (const brand of CAR_BRANDS) {
      expect(brand.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('resolves every catalog brand by its own name', () => {
    for (const brand of CAR_BRANDS) {
      expect(findBrand(brand.name)?.id).toBe(brand.id);
    }
  });
});

describe('brandInitials', () => {
  it('takes one letter per word, or two from a single word', () => {
    expect(brandInitials('Mercedes-Benz')).toBe('MB');
    expect(brandInitials('Land Rover')).toBe('LR');
    expect(brandInitials('BMW')).toBe('BM');
    expect(brandInitials('Audi')).toBe('AU');
  });
});

describe('shorthand and deliberate abstentions', () => {
  it('reads the abbreviations the shop actually writes', () => {
    expect(detectBrand('MB 560 SEC 1989')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('SL 400 year 2015')?.name).toBe('Mercedes-Benz');
    expect(detectBrand('Z4')?.name).toBe('BMW');
    expect(detectBrand('Masarati ghibli')?.name).toBe('Maserati');
  });

  it('stays blank when the shorthand is genuinely ambiguous', () => {
    // "RR" is Rolls-Royce to half the trade and Range Rover to the other
    // half. A wrong badge is worse than no badge, so we abstain.
    expect(detectBrand('RR')).toBeNull();
    // Garbled 240Z. Not worth guessing at.
    expect(detectBrand('Z240')).toBeNull();
  });
});

describe('logo assets', () => {
  it('ships a logo file for every brand in the catalog', async () => {
    // A missing file degrades silently to initials in the UI, which is
    // easy to ship and hard to notice. Catch it here instead.
    const { existsSync } = await import('node:fs');
    // Resolved through brandLogoSrc, so a brand added without its
    // SVG_LOGOS entry fails here rather than silently falling back to
    // initials in the UI.
    const missing = CAR_BRANDS.filter(
      (b) => !existsSync(`public${brandLogoSrc(b)}`),
    ).map((b) => b.id);
    expect(missing).toEqual([]);
  });
});

describe('supplied logo set', () => {
  it('treats AMG as its own marque without stealing Mercedes rows', () => {
    expect(detectBrand('AMG GT')?.id).toBe('mercedes-amg');
    // Position still decides: a row led by "Mercedes" is a Mercedes.
    expect(detectBrand('Mercedes G 320 and G63')?.id).toBe('mercedes-benz');
    expect(detectBrand('g63 wagon 2013')?.id).toBe('mercedes-benz');
  });

  it('knows the two-wheel marques that came with the logo set', () => {
    expect(detectBrand('Kawasaki Ninja')?.name).toBe('Kawasaki');
    expect(detectBrand('yamaha r1')?.name).toBe('Yamaha');
    expect(detectBrand('KTM duke 390')?.name).toBe('KTM');
    expect(detectBrand('Brabus G800')?.name).toBe('Brabus');
  });
});
