/**
 * Redaction for anything sent to an AI provider.
 *
 * The model gets enough to be useful — vehicle, services, job history,
 * call outcomes — and nothing that identifies the customer personally.
 * Phone, email, VIN and plate never leave the server.
 *
 * This is enforced in code rather than asked for in the prompt, because
 * a prompt is a request and a function is a guarantee. The free-text
 * notes get scrubbed too: the imported leads have numbers sitting inside
 * the note body ("call 0501234567 on Thursday"), so redacting the
 * columns alone would leak through the text.
 */

import type { Contact, Deal } from '@/types';
import { getServiceTypes } from '@/lib/services';

/** Runs of 7+ digits, tolerating spaces, dashes, dots, brackets and +. */
const PHONE_RE = /(?:\+?\d[\d\s().-]{5,}\d)/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** 17-char VIN-shaped tokens (letters+digits, no I/O/Q by spec). */
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

/**
 * Remove personal identifiers from free text.
 *
 * `known` lets the caller also strip exact values it holds (this
 * contact's plate, for instance), which no generic pattern can catch
 * reliably — UAE plates look like "DXB Q 12312" and a plate regex would
 * eat ordinary words.
 */
export function scrubText(input: string | null | undefined, known: string[] = []): string {
  if (!input) return '';
  let out = input;

  for (const value of known) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < 3) continue;
    // Escape the literal before using it as a pattern.
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '[redacted]');
  }

  out = out.replace(EMAIL_RE, '[email]');
  out = out.replace(VIN_RE, '[vin]');
  out = out.replace(PHONE_RE, '[phone]');

  return out.replace(/\s+/g, ' ').trim();
}

/** First name only — enough for natural wording, not enough to identify. */
export function firstNameOnly(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (!first) return null;
  // A "name" that is really a phone number or junk shouldn't pass through.
  if (!/[a-z]/i.test(first)) return null;
  return first;
}

export interface ContactContext {
  firstName: string | null;
  vehicle: string | null;
  year: number | null;
  services: string[];
  jobDescription: string;
  leadStatus: string | null;
  contactStatus: string | null;
  lastCallOutcome: string | null;
  messaged: boolean;
  addedDaysAgo: number | null;
  deals: Array<{
    title: string;
    value: number;
    currency: string;
    status: string;
    stage: string | null;
    notes: string;
  }>;
  notes: string[];
}

/**
 * Build the redacted payload for a contact. Everything the provider sees
 * comes from here — callers must not hand raw rows to the model.
 */
export function buildContactContext(
  contact: Contact,
  deals: Deal[] = [],
  notes: string[] = [],
): ContactContext {
  // Values we strip from every free-text field for this contact.
  const known = [contact.phone, contact.email, contact.plate_number, contact.vin]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  const vehicle = [contact.car_brand, contact.car_model, contact.car_trim]
    .filter(Boolean)
    .join(' ')
    .trim();

  const addedDaysAgo = contact.created_at
    ? Math.floor((Date.now() - new Date(contact.created_at).getTime()) / 86_400_000)
    : null;

  return {
    firstName: firstNameOnly(contact.name),
    vehicle: vehicle || null,
    year: contact.car_year ?? null,
    services: getServiceTypes(contact),
    jobDescription: scrubText(contact.job_description, known),
    leadStatus: contact.lead_status ?? null,
    contactStatus: contact.contact_status ?? null,
    lastCallOutcome: contact.last_call_outcome ?? null,
    messaged: Boolean(contact.messaged),
    addedDaysAgo,
    deals: deals.map((d) => ({
      title: scrubText(d.title, known),
      value: Number(d.value || 0),
      currency: d.currency || 'AED',
      status: d.status ?? 'open',
      stage: d.stage?.name ?? null,
      notes: scrubText(d.notes, known),
    })),
    notes: notes.map((n) => scrubText(n, known)).filter(Boolean),
  };
}
