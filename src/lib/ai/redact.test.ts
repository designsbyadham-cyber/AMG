import { describe, expect, it } from 'vitest';
import type { Contact, Deal } from '@/types';
import { buildContactContext, firstNameOnly, scrubText } from './redact';

const contact: Contact = {
  id: 'c1',
  user_id: 'u1',
  phone: '+971 50 123 4567',
  name: 'Abdulla Jawhar',
  email: 'jawhar@gmail.com',
  car_brand: 'Infinity',
  car_model: 'QX80',
  car_year: 2026,
  car_trim: 'S',
  vin: '78SDYF8SD7YFS8D7',
  plate_number: 'DXB Q 12312',
  service_types: ['Tinting'],
  job_description: 'Wants tint. Call 0501234567 or mail jawhar@gmail.com, plate DXB Q 12312.',
  lead_status: 'hot',
  contact_status: 'follow_up',
  created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
};

/** Everything the provider would receive, flattened for assertions. */
function serialised(c: Contact, deals: Deal[] = [], notes: string[] = []) {
  return JSON.stringify(buildContactContext(c, deals, notes));
}

describe('scrubText', () => {
  it('removes emails', () => {
    expect(scrubText('mail me at bob@example.com now')).toBe('mail me at [email] now');
  });

  it('removes phone numbers in several shapes', () => {
    for (const phone of ['+971 50 123 4567', '971553184046', '(672) 903-0287', '050-123-4567']) {
      expect(scrubText(`call ${phone} today`)).not.toContain('123');
      expect(scrubText(`call ${phone} today`)).toContain('[phone]');
    }
  });

  it('removes VIN-shaped tokens', () => {
    expect(scrubText('vin 1HGBH41JXMN109186 ok')).toBe('vin [vin] ok');
  });

  it('removes caller-supplied known values such as a plate', () => {
    expect(scrubText('plate DXB Q 12312 is his', ['DXB Q 12312'])).toContain('[redacted]');
  });

  it('leaves ordinary text alone', () => {
    expect(scrubText('Wants ceramic tint and PPF')).toBe('Wants ceramic tint and PPF');
  });

  it('handles empty input', () => {
    expect(scrubText(null)).toBe('');
    expect(scrubText(undefined)).toBe('');
  });

  it('ignores short known values that would over-redact', () => {
    // A 2-char value would otherwise blank out normal words.
    expect(scrubText('Interior work', ['or'])).toBe('Interior work');
  });
});

describe('firstNameOnly', () => {
  it('keeps only the first name', () => {
    expect(firstNameOnly('Abdulla Jawhar')).toBe('Abdulla');
  });

  it('rejects a phone number masquerading as a name', () => {
    expect(firstNameOnly('+971503239876')).toBeNull();
  });

  it('handles missing names', () => {
    expect(firstNameOnly(null)).toBeNull();
    expect(firstNameOnly('   ')).toBeNull();
  });
});

describe('buildContactContext', () => {
  it('never leaks phone, email, plate or VIN anywhere in the payload', () => {
    const payload = serialised(contact);
    expect(payload).not.toContain('971');
    expect(payload).not.toContain('jawhar@gmail.com');
    expect(payload).not.toContain('DXB Q 12312');
    expect(payload).not.toContain('78SDYF8SD7YFS8D7');
    expect(payload).not.toContain('0501234567');
  });

  it('keeps the useful context', () => {
    const ctx = buildContactContext(contact);
    expect(ctx.firstName).toBe('Abdulla');
    expect(ctx.vehicle).toBe('Infinity QX80 S');
    expect(ctx.year).toBe(2026);
    expect(ctx.services).toEqual(['Tinting']);
    expect(ctx.leadStatus).toBe('hot');
    expect(ctx.jobDescription).toContain('Wants tint');
  });

  it('scrubs identifiers out of deal titles and notes', () => {
    const deals = [
      {
        id: 'd1',
        user_id: 'u1',
        pipeline_id: 'p1',
        stage_id: 's1',
        contact_id: 'c1',
        title: 'Tint for +971 50 123 4567',
        value: 1200,
        currency: 'AED',
        notes: 'reach him on jawhar@gmail.com',
        created_at: new Date().toISOString(),
      } as Deal,
    ];
    const payload = serialised(contact, deals, ['spoke to him on 0501234567']);
    expect(payload).not.toContain('jawhar@gmail.com');
    expect(payload).not.toContain('0501234567');
    expect(payload).toContain('[phone]');
  });

  it('drops empty notes rather than sending blanks', () => {
    expect(buildContactContext(contact, [], ['', '   ']).notes).toEqual([]);
  });
});
