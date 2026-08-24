/**
 * Car manufacturer catalog, and the matcher that finds a brand inside
 * whatever text a human actually typed.
 *
 * Two jobs:
 *   1. Feed the make autocomplete, so new records get one canonical
 *      spelling instead of "Porshce" / "porsche" / "Porche".
 *   2. Recover a brand from records that never had one. Most imported
 *      customers have no `car_brand` at all: the make is buried in
 *      `car_model` ("1995 Nissan Skyline GTR 33"), or is only implied
 *      by the model ("bentayga", "defender", "G63"). Detection runs at
 *      render time, so those get a badge without migrating or
 *      overwriting anyone's data.
 *
 * `id` doubles as the logo filename in `public/brands/<id>.png`.
 *
 * Logo files are vendored from filippofilip95/car-logos-dataset (MIT).
 * The marks themselves remain the trademarks of their owners; they are
 * used here only to identify a customer's own vehicle inside the CRM.
 */

export interface CarBrand {
  id: string;
  name: string;
  /** Lowercase alternate spellings, including misspellings seen in real data. */
  aliases: readonly string[];
  /** Models distinctive enough to imply the brand on their own. */
  models: readonly string[];
}

/**
 * Ordering is irrelevant to matching (position in the input decides),
 * but it drives the autocomplete list, so the makes this workshop
 * actually sees come first.
 */
export const CAR_BRANDS: readonly CarBrand[] = [
  {
    id: 'mercedes-benz',
    name: 'Mercedes-Benz',
    aliases: ['mercedes', 'merc', 'benz', 'mercedes benz', 'mb'],
    models: ['g63', 'g class', 'g wagon', 's class', 'e class', 'c class', 'a class', 'gle', 'gla', 'glc', 'gls', 'maybach', 'sprinter', 'sl', 'sel', 'sec'],
  },
  {
    id: 'mercedes-amg',
    name: 'Mercedes-AMG',
    // 'amg' moved here off Mercedes-Benz. A row that leads with the
    // sub-brand means the sub-brand; one that says "Mercedes ... AMG"
    // still resolves to Mercedes-Benz, because position decides.
    aliases: ['amg', 'mercedes amg'],
    models: [],
  },
  { id: 'bmw', name: 'BMW', aliases: ['bimmer', 'beemer'], models: ['x5', 'x6', 'm3', 'm4', 'm5', 'i8', 'z3', 'z4'] },
  {
    id: 'nissan',
    name: 'Nissan',
    aliases: [],
    models: ['altima', 'skyline', 'gtr', 'gt r', 'patrol', 'sentra', 'maxima', 'juke', 'qashqai', 'navara', 'x trail', '370z', '350z'],
  },
  { id: 'datsun', name: 'Datsun', aliases: [], models: ['240z', '260z', '280z'] },
  {
    id: 'toyota',
    name: 'Toyota',
    aliases: [],
    models: ['camry', 'corolla', 'yaris', 'hilux', 'land cruiser', 'prado', 'rav4', 'supra', 'c hr'],
  },
  { id: 'lexus', name: 'Lexus', aliases: [], models: ['lx570', 'rx350', 'is300'] },
  {
    id: 'porsche',
    name: 'Porsche',
    aliases: ['porshce', 'porche', 'porsch'],
    models: ['cayenne', 'cayanne', 'boxster', 'boxter', 'macan', 'panamera', 'taycan', 'carrera', 'cayman'],
  },
  { id: 'audi', name: 'Audi', aliases: [], models: ['rs5', 'rs6', 'rs7', 'q7', 'q8', 'sq8', 'e tron', 'etron'] },
  { id: 'tesla', name: 'Tesla', aliases: [], models: ['cybertruck', 'model s', 'model 3', 'model x', 'model y'] },
  {
    id: 'land-rover',
    name: 'Land Rover',
    aliases: ['landrover', 'range rover', 'rangerover', 'range'],
    models: ['defender', 'discovery', 'evoque', 'freelander', 'velar', 'lr4', 'lr3'],
  },
  { id: 'bentley', name: 'Bentley', aliases: [], models: ['bentayga', 'continental gt', 'flying spur'] },
  { id: 'honda', name: 'Honda', aliases: [], models: ['civic', 'accord', 'crv', 'cr v', 'hrv'] },
  { id: 'volkswagen', name: 'Volkswagen', aliases: ['vw'], models: ['touareg', 'golf', 'tiguan', 'passat', 'jetta'] },
  { id: 'kia', name: 'Kia', aliases: [], models: ['carnival', 'sportage', 'sorento', 'seltos'] },
  { id: 'hyundai', name: 'Hyundai', aliases: [], models: ['tucson', 'elantra', 'santa fe'] },
  { id: 'infiniti', name: 'Infiniti', aliases: ['infinity', 'infinti'], models: ['q50', 'q60', 'qx80', 'g37'] },
  { id: 'mitsubishi', name: 'Mitsubishi', aliases: [], models: ['pajero', 'lancer', 'evo'] },
  { id: 'maserati', name: 'Maserati', aliases: ['masarati'], models: ['ghibli', 'levante'] },
  { id: 'mini', name: 'MINI', aliases: [], models: ['cooper'] },
  { id: 'cadillac', name: 'Cadillac', aliases: [], models: ['escalade', 'ct5'] },
  { id: 'ford', name: 'Ford', aliases: [], models: ['mustang', 'raptor', 'bronco', 'f150', 'f 150', 'explorer'] },
  { id: 'dodge', name: 'Dodge', aliases: [], models: ['hellcat', 'charger', 'challenger', 'durango'] },
  { id: 'chevrolet', name: 'Chevrolet', aliases: ['chevy'], models: ['tahoe', 'camaro', 'corvette', 'silverado'] },
  { id: 'rolls-royce', name: 'Rolls-Royce', aliases: ['rolls', 'rolls royce'], models: ['ghost', 'cullinan', 'wraith', 'phantom'] },
  { id: 'suzuki', name: 'Suzuki', aliases: [], models: ['jimny'] },
  { id: 'ferrari', name: 'Ferrari', aliases: [], models: ['f8', '488', '812'] },
  { id: 'lamborghini', name: 'Lamborghini', aliases: ['lambo'], models: ['urus', 'huracan', 'aventador'] },
  { id: 'mclaren', name: 'McLaren', aliases: [], models: ['720s', '570s'] },
  { id: 'aston-martin', name: 'Aston Martin', aliases: ['aston'], models: ['vantage', 'db11', 'dbx'] },
  { id: 'bugatti', name: 'Bugatti', aliases: [], models: ['chiron', 'veyron'] },
  { id: 'jaguar', name: 'Jaguar', aliases: [], models: ['f pace', 'f type'] },
  { id: 'jeep', name: 'Jeep', aliases: [], models: ['wrangler', 'grand cherokee'] },
  { id: 'gmc', name: 'GMC', aliases: [], models: ['yukon', 'sierra'] },
  { id: 'chrysler', name: 'Chrysler', aliases: [], models: [] },
  { id: 'lincoln', name: 'Lincoln', aliases: [], models: ['navigator'] },
  { id: 'acura', name: 'Acura', aliases: [], models: [] },
  { id: 'genesis', name: 'Genesis', aliases: [], models: [] },
  { id: 'mazda', name: 'Mazda', aliases: [], models: ['miata', 'mx5'] },
  { id: 'subaru', name: 'Subaru', aliases: [], models: ['impreza', 'wrx', 'forester'] },
  { id: 'volvo', name: 'Volvo', aliases: [], models: ['xc90', 'xc60'] },
  { id: 'peugeot', name: 'Peugeot', aliases: [], models: [] },
  { id: 'renault', name: 'Renault', aliases: [], models: ['duster'] },
  { id: 'fiat', name: 'Fiat', aliases: [], models: [] },
  { id: 'alfa-romeo', name: 'Alfa Romeo', aliases: ['alfa', 'alfa romeo'], models: ['giulia', 'stelvio'] },
  { id: 'skoda', name: 'Skoda', aliases: ['skoda'], models: ['octavia'] },
  { id: 'opel', name: 'Opel', aliases: [], models: [] },
  { id: 'citroen', name: 'Citroen', aliases: ['citroen'], models: [] },
  { id: 'ram', name: 'RAM', aliases: [], models: [] },
  { id: 'hummer', name: 'Hummer', aliases: [], models: [] },
  { id: 'lotus', name: 'Lotus', aliases: [], models: ['emira', 'evija'] },
  { id: 'mg', name: 'MG', aliases: [], models: [] },
  { id: 'byd', name: 'BYD', aliases: [], models: [] },
  { id: 'lucid', name: 'Lucid', aliases: [], models: [] },
  { id: 'rivian', name: 'Rivian', aliases: [], models: [] },
  { id: 'pagani', name: 'Pagani', aliases: [], models: ['huayra'] },
  { id: 'koenigsegg', name: 'Koenigsegg', aliases: [], models: [] },
  { id: 'brabus', name: 'Brabus', aliases: [], models: [] },
  { id: 'dacia', name: 'Dacia', aliases: [], models: [] },
  { id: 'mercury', name: 'Mercury', aliases: [], models: [] },
  // Two-wheelers. The imported data already contains an 'electric bike',
  // so the shop clearly sees more than cars.
  { id: 'kawasaki', name: 'Kawasaki', aliases: [], models: ['ninja', 'z900', 'zx10r'] },
  { id: 'yamaha', name: 'Yamaha', aliases: [], models: ['mt 07', 'mt 09', 'r1', 'r6'] },
  { id: 'ktm', name: 'KTM', aliases: [], models: ['duke'] },
  // SEAT ships a logo and can be picked by hand, but it is deliberately
  // excluded from the matcher below: this is an interior-upgrades shop,
  // so "seat covers" and "leather seats" would all become SEATs.
  { id: 'seat', name: 'SEAT', aliases: [], models: [] },
];

/** Never auto-detected, only selectable. See the note above. */
const DETECTION_BLOCKLIST = new Set(['seat']);

const BY_ID = new Map(CAR_BRANDS.map((b) => [b.id, b]));

/**
 * Lowercase and reduce every separator to a single space, so
 * "Mercedes-Benz", "mercedes benz" and "MERCEDES_BENZ" collapse to one
 * key. Digits survive — several model hints are numeric ("240z", "g63").
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * phrase -> brand, built once. Keys may be multi-word ("land rover",
 * "s class"), which is why matching walks n-grams longest-first rather
 * than looking up single tokens.
 */
const PHRASES = new Map<string, CarBrand>();
let MAX_WORDS = 1;

for (const brand of CAR_BRANDS) {
  if (DETECTION_BLOCKLIST.has(brand.id)) continue;
  for (const key of [brand.name.toLowerCase(), ...brand.aliases, ...brand.models]) {
    const normalised = normalise(key);
    if (!normalised) continue;
    // First writer wins, so an earlier brand keeps a shared model name.
    if (!PHRASES.has(normalised)) PHRASES.set(normalised, brand);
    MAX_WORDS = Math.max(MAX_WORDS, normalised.split(' ').length);
  }
}

/**
 * Find the brand named earliest in `text`.
 *
 * Position in the input decides, not order in the catalog: a job logged
 * as "Audi tsq8, Porshce cayenne turbo" is an Audi job with a note about
 * a second car. Picking whichever brand sat higher in the list would be
 * arbitrary, and arbitrary is worse than predictable.
 *
 * Matching is on whole words. Substring matching looks fine until
 * "ramadan" becomes a RAM and "minimal" becomes a MINI.
 */
export function detectBrand(text: string | null | undefined): CarBrand | null {
  if (!text) return null;
  const words = normalise(text).split(' ').filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    // Longest phrase first: "land rover" must beat a bare "land", and
    // "continental gt" must not be shadowed by "continental".
    const maxSpan = Math.min(MAX_WORDS, words.length - i);
    for (let span = maxSpan; span >= 1; span--) {
      const hit = PHRASES.get(words.slice(i, i + span).join(' '));
      if (hit) return hit;
    }
  }
  return null;
}

/** Resolve a stored or typed make to a catalog entry. Exact names only. */
export function findBrand(value: string | null | undefined): CarBrand | null {
  if (!value) return null;
  const normalised = normalise(value);
  for (const brand of CAR_BRANDS) {
    if (normalise(brand.name) === normalised) return brand;
  }
  return BY_ID.get(normalised) ?? null;
}

export function getBrandById(id: string): CarBrand | null {
  return BY_ID.get(id) ?? null;
}

/**
 * The brand to badge a customer with. Trusts `car_brand` when it is set,
 * and otherwise reads the make out of the model text, which is where it
 * lives for most of the imported records.
 */
export function brandForContact(
  contact?: { car_brand?: string | null; car_model?: string | null } | null,
): CarBrand | null {
  if (!contact) return null;
  return detectBrand(contact.car_brand) ?? detectBrand(contact.car_model);
}

/** Fallback mark when there is no logo — "MB", "BM", "LR". */
export function brandInitials(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Brands whose logo is a vendor-supplied SVG. Everything else falls back
 * to the PNG set.
 *
 * A flag per catalog entry would drift the moment someone adds a brand
 * and forgets it, so this is one list — and `car-brands.test.ts` asserts
 * that the file each brand resolves to actually exists on disk, which is
 * what stops the drift rather than discipline.
 */
const SVG_LOGOS = new Set([
  'acura', 'audi', 'bmw', 'brabus', 'bugatti', 'byd', 'citroen', 'dacia',
  'dodge', 'ferrari', 'fiat', 'ford', 'gmc', 'honda', 'hummer', 'infiniti',
  'jeep', 'kawasaki', 'kia', 'ktm', 'lamborghini', 'land-rover', 'lexus',
  'mazda', 'mercedes-amg', 'mercedes-benz', 'mercury', 'mini', 'mitsubishi',
  'nissan', 'opel', 'pagani', 'porsche', 'rolls-royce', 'skoda', 'subaru',
  'suzuki', 'tesla', 'volvo', 'yamaha',
]);

/** Public path to a brand's logo, extension included. */
export function brandLogoSrc(brand: CarBrand): string {
  return `/brands/${brand.id}.${SVG_LOGOS.has(brand.id) ? 'svg' : 'png'}`;
}
