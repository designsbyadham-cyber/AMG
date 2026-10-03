import { describe, expect, it } from 'vitest';

import type { Deal } from '@/types';
import {
  highlightParts,
  matchRank,
  queryWords,
  searchContacts,
  searchJobs,
  searchPages,
  type SearchContact,
} from '@/lib/search';

/**
 * Pins what the dashboard search promises: forgiving about spaces and
 * case, strict about every word matching, best match first, and never
 * turning customer text into markup.
 */

type DealOverrides = Omit<Partial<Deal>, 'contact'> & {
  contact?: Partial<NonNullable<Deal['contact']>>;
};

function deal(id: string, over: DealOverrides = {}): Deal {
  const { contact, ...rest } = over;
  return {
    id,
    user_id: 'u1',
    pipeline_id: 'p1',
    stage_id: 's1',
    contact_id: `c-${id}`,
    title: 'Job',
    value: 1000,
    created_at: '2026-09-01T10:00:00Z',
    ...rest,
    contact: {
      id: `c-${id}`,
      user_id: 'u1',
      phone: '+971500000000',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...contact,
    },
  } as Deal;
}

const STAGES = new Map([['s1', 'In Progress']]);

describe('matchRank', () => {
  it('ranks a word-start match above a match inside a word', () => {
    expect(matchRank(['Porsche 911 GT3'], queryWords('911'))).toBe(0);
    expect(matchRank(['Porsche 911 GT3'], queryWords('rsche'))).toBe(1);
    expect(matchRank(['Porsche 911 GT3'], queryWords('ferrari'))).toBe(-1);
  });

  it('ignores case, spaces and punctuation', () => {
    expect(matchRank(['Dubai P 48213'], queryWords('p48213'))).toBe(1);
    expect(matchRank(['+971 50 123 4567'], queryWords('501234567'))).toBe(1);
    expect(matchRank(['LAMBORGHINI Urus'], queryWords('lambo'))).toBe(0);
  });

  it('needs every word to match somewhere', () => {
    const fields = ['Porsche 911', 'James Whitfield'];
    expect(matchRank(fields, queryWords('porsche james'))).toBe(0);
    expect(matchRank(fields, queryWords('porsche omar'))).toBe(-1);
  });

  it('matches nothing for an empty query', () => {
    expect(matchRank(['anything'], queryWords('   '))).toBe(-1);
  });
});

describe('searchJobs', () => {
  const ferrari = deal('f', {
    contact: { car_brand: 'Ferrari', car_model: 'Roma', name: 'Sofia' },
  });
  const porsche = deal('p', {
    contact: {
      car_brand: 'Porsche',
      car_model: '911',
      name: 'James',
      plate_number: 'D 30098',
    },
    created_at: '2026-09-20T10:00:00Z',
  });
  const porscheOld = deal('po', {
    contact: { car_brand: 'Porsche', car_model: 'Cayenne', name: 'Noura' },
    created_at: '2026-03-01T10:00:00Z',
  });

  it('finds jobs by vehicle, customer, plate or stage', () => {
    expect(
      searchJobs([ferrari, porsche], 'roma', STAGES).map((d) => d.id)
    ).toEqual(['f']);
    expect(
      searchJobs([ferrari, porsche], 'james', STAGES).map((d) => d.id)
    ).toEqual(['p']);
    expect(
      searchJobs([ferrari, porsche], 'd30098', STAGES).map((d) => d.id)
    ).toEqual(['p']);
    expect(searchJobs([ferrari], 'progress', STAGES).map((d) => d.id)).toEqual([
      'f',
    ]);
  });

  it('puts better matches first, then the most recently booked', () => {
    const ids = searchJobs(
      [porscheOld, ferrari, porsche],
      'porsche',
      STAGES
    ).map((d) => d.id);
    expect(ids).toEqual(['p', 'po']);
  });

  it('returns nothing for a blank query', () => {
    expect(searchJobs([ferrari], '  ', STAGES)).toEqual([]);
  });
});

describe('searchContacts', () => {
  const people: SearchContact[] = [
    { id: '1', name: 'Omar Haddad', phone: '+971501112233' },
    {
      id: '2',
      name: 'Fatima Rahman',
      phone: '+971504445566',
      car_brand: 'Mercedes-Benz',
      car_model: 'G 63',
    },
    {
      id: '3',
      name: null,
      phone: '+971507778899',
      plate_number: 'Dubai Q 11720',
    },
  ];

  it('finds customers by name, phone, plate or car', () => {
    expect(searchContacts(people, 'omar').map((c) => c.id)).toEqual(['1']);
    expect(searchContacts(people, '0444').map((c) => c.id)).toEqual(['2']);
    expect(searchContacts(people, 'q11720').map((c) => c.id)).toEqual(['3']);
    expect(searchContacts(people, 'mercedes').map((c) => c.id)).toEqual(['2']);
  });
});

describe('searchPages', () => {
  it('lists every page with no query, and matches synonyms', () => {
    expect(searchPages('').length).toBeGreaterThan(5);
    expect(searchPages('contacts').map((p) => p.href)).toEqual(['/contacts']);
    expect(searchPages('whatsapp').map((p) => p.href)).toContain('/inbox');
  });
});

describe('highlightParts', () => {
  it('marks every matched run and keeps the rest', () => {
    expect(highlightParts('Porsche 911', 'por 911')).toEqual([
      { text: 'Por', match: true },
      { text: 'sche ', match: false },
      { text: '911', match: true },
    ]);
  });

  it('treats regex characters in the query as text', () => {
    expect(highlightParts('a+b (c)', '(c)')).toEqual([
      { text: 'a+b ', match: false },
      { text: '(c)', match: true },
    ]);
  });

  it('returns the text untouched with no query', () => {
    expect(highlightParts('Ferrari', '')).toEqual([
      { text: 'Ferrari', match: false },
    ]);
  });
});
