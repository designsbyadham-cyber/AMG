import { describe, expect, it } from 'vitest';
import type { Contact } from '@/types';
import { scoreContact } from './profile-score';

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    user_id: 'u1',
    phone: '+971500000000',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Contact;
}

const complete = contact({
  name: 'Abdulla',
  email: 'a@example.com',
  car_brand: 'Infinity',
  car_model: 'QX80',
  car_year: 2026,
  plate_number: 'DXB Q 12312',
  vin: '1HGBH41JXMN109186',
  service_types: ['Tinting'],
  job_description: 'Full tint',
  lead_status: 'hot',
});

describe('scoreContact', () => {
  it('gives a phone-only contact a thin score', () => {
    const result = scoreContact(contact());
    expect(result.score).toBe(0);
    expect(result.band).toBe('thin');
    expect(result.presentLabels).toEqual([]);
  });

  it('gives a fully filled contact 100', () => {
    const result = scoreContact(complete);
    expect(result.score).toBe(100);
    expect(result.band).toBe('strong');
    expect(result.missing).toEqual([]);
  });

  it('ranks the heaviest gaps first', () => {
    // Missing vehicle (20) and email (5): vehicle must lead.
    const result = scoreContact(
      contact({
        name: 'Sam',
        service_types: ['Tinting'],
        job_description: 'x',
        lead_status: 'warm',
        plate_number: 'A 1',
        car_year: 2020,
        vin: '1HGBH41JXMN109186',
      }),
    );
    expect(result.missing[0].field).toBe('car_model');
    expect(result.missing.map((m) => m.field)).toContain('email');
  });

  it('counts a vehicle when only the brand is known', () => {
    const withBrand = scoreContact(contact({ car_brand: 'Nissan' }));
    expect(withBrand.presentLabels).toContain('Vehicle');
  });

  it('accepts the legacy single service_type column', () => {
    const legacy = scoreContact(contact({ service_type: 'Tinting' }));
    expect(legacy.presentLabels).toContain('Services');
  });

  it('treats whitespace-only values as missing', () => {
    const blank = scoreContact(contact({ name: '   ', job_description: '' }));
    expect(blank.missing.map((m) => m.field)).toEqual(
      expect.arrayContaining(['name', 'job_description']),
    );
  });

  it('carries a question for every gap', () => {
    for (const gap of scoreContact(contact()).missing) {
      expect(gap.ask.length).toBeGreaterThan(0);
      expect(gap.ask).toMatch(/\?$/);
    }
  });

  it('bands a partially complete contact between the extremes', () => {
    const partial = scoreContact(
      contact({ name: 'Sam', car_brand: 'Nissan', service_types: ['Tinting'] }),
    );
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(100);
    expect(['partial', 'thin']).toContain(partial.band);
  });
});
