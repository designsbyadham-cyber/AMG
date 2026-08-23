/**
 * How complete is what we know about a customer?
 *
 * Deliberately **not** an AI feature: "which fields are empty" is a fact,
 * not a judgement. Computing it locally makes it instant and free, keeps
 * it working when the AI provider is rate-limited or down, and means the
 * model is only ever asked to do the part it's actually good at (phrasing
 * the follow-up question).
 *
 * Weights reflect what the workshop needs to quote and book a job, not
 * database tidiness — the vehicle and the requested services matter far
 * more than an email address.
 */

import type { Contact } from '@/types';
import { getServiceTypes } from '@/lib/services';

export interface MissingField {
  field: string;
  label: string;
  /** Plain-language prompt for the person making the call. */
  ask: string;
  weight: number;
}

export interface ProfileScore {
  /** 0-100. */
  score: number;
  band: 'strong' | 'partial' | 'thin';
  missing: MissingField[];
  presentLabels: string[];
}

interface FieldSpec {
  field: string;
  label: string;
  ask: string;
  weight: number;
  has: (c: Contact) => boolean;
}

const nonEmpty = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;

/**
 * `phone` is intentionally absent: it's NOT NULL on the table, so every
 * contact has one and scoring it would just inflate every score by a
 * constant.
 */
const FIELDS: FieldSpec[] = [
  {
    field: 'car_model',
    label: 'Vehicle',
    ask: 'Which car is it — make and model?',
    weight: 20,
    has: (c) => nonEmpty(c.car_brand) || nonEmpty(c.car_model),
  },
  {
    field: 'service_types',
    label: 'Services',
    ask: 'What work do they actually want done?',
    weight: 20,
    has: (c) => getServiceTypes(c).length > 0,
  },
  {
    field: 'name',
    label: 'Name',
    ask: 'Who are we speaking to?',
    weight: 15,
    has: (c) => nonEmpty(c.name),
  },
  {
    field: 'job_description',
    label: 'Job details',
    ask: 'What exactly needs doing, in their words?',
    weight: 10,
    has: (c) => nonEmpty(c.job_description),
  },
  {
    field: 'lead_status',
    label: 'Lead temperature',
    ask: 'How keen are they — cold, warm or hot?',
    weight: 10,
    has: (c) => nonEmpty(c.lead_status),
  },
  {
    field: 'plate_number',
    label: 'Plate',
    ask: "What's the plate number?",
    weight: 10,
    has: (c) => nonEmpty(c.plate_number),
  },
  {
    field: 'car_year',
    label: 'Year',
    ask: 'What year is the car?',
    weight: 5,
    has: (c) => c.car_year !== null && c.car_year !== undefined,
  },
  {
    field: 'email',
    label: 'Email',
    ask: 'Can we get an email for the quote?',
    weight: 5,
    has: (c) => nonEmpty(c.email),
  },
  {
    field: 'vin',
    label: 'VIN',
    ask: 'Do we have the VIN / chassis number?',
    weight: 5,
    has: (c) => nonEmpty(c.vin),
  },
];

const TOTAL_WEIGHT = FIELDS.reduce((sum, f) => sum + f.weight, 0);

export function scoreContact(contact: Contact): ProfileScore {
  const missing: MissingField[] = [];
  const presentLabels: string[] = [];
  let earned = 0;

  for (const spec of FIELDS) {
    if (spec.has(contact)) {
      earned += spec.weight;
      presentLabels.push(spec.label);
    } else {
      missing.push({
        field: spec.field,
        label: spec.label,
        ask: spec.ask,
        weight: spec.weight,
      });
    }
  }

  const score = Math.round((earned / TOTAL_WEIGHT) * 100);
  // Heaviest gaps first, so the caller asks the question that matters most.
  missing.sort((a, b) => b.weight - a.weight);

  return {
    score,
    band: score >= 80 ? 'strong' : score >= 50 ? 'partial' : 'thin',
    missing,
    presentLabels,
  };
}
