// ============================================================
// POST /api/ai/contact
//
// Two tasks over one contact:
//   summary  — a short "story so far" paragraph for the person about to
//              ring them.
//   cleanup  — structured field suggestions extracted from the messy
//              free-text notes the CSV import left behind.
//
// Guarantees that matter more than the output:
//   - The caller must be signed in; the contact is fetched through RLS,
//     so a user can only ever summarise their own account's customers.
//   - Nothing personal reaches the provider — `buildContactContext`
//     strips phone, email, plate and VIN, including inside note text.
//   - `cleanup` NEVER writes. It returns suggestions; the UI applies the
//     ones a human ticks.
// ============================================================

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { buildContactContext } from '@/lib/ai/redact';
import { chat, isAiConfigured, AI_FAILURE_MESSAGE } from '@/lib/ai/provider';
import { SERVICE_TYPES } from '@/lib/services';
import { LEAD_STATUSES } from '@/lib/lead-status';
import type { Contact, Deal } from '@/types';

const SUMMARY_SYSTEM = `You write one short paragraph briefing a car-workshop employee before they phone a customer.
Rules:
- 2-3 sentences, max 60 words. Plain language, no marketing tone.
- Cover: the vehicle, what work they want, and where things stand.
- If a follow-up is overdue or they were never reached, say so plainly.
- Never invent details. If something is unknown, don't mention it.
- Some values appear as [phone], [email] or [redacted]; never refer to those placeholders.`;

const CLEANUP_SYSTEM = `You extract structured fields from a car workshop's messy lead notes.
Return ONLY a JSON object with these optional keys:
  "service_types": array of strings, each EXACTLY one of ${JSON.stringify(SERVICE_TYPES)}
  "lead_status": one of "cold" | "warm" | "hot"
  "job_description": a tidied one-line version of the note
  "next_action": a short imperative like "Call back Thursday"
Rules:
- Only include a key when the note genuinely supports it. Omit rather than guess.
- "CALL TO BOOK", "URGENT", "wants to book" imply hot. "Out of town", "unresponsive", "next month" imply cold.
- Do not invent services that aren't mentioned.`;

interface CleanupSuggestion {
  service_types?: string[];
  lead_status?: string;
  job_description?: string;
  next_action?: string;
}

/** Keep only values the app already understands. */
function sanitiseCleanup(raw: unknown): CleanupSuggestion {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const out: CleanupSuggestion = {};

  if (Array.isArray(input.service_types)) {
    const allowed = input.service_types.filter(
      (s): s is string =>
        typeof s === 'string' && (SERVICE_TYPES as readonly string[]).includes(s),
    );
    if (allowed.length) out.service_types = [...new Set(allowed)];
  }

  if (
    typeof input.lead_status === 'string' &&
    (LEAD_STATUSES as readonly string[]).includes(input.lead_status)
  ) {
    out.lead_status = input.lead_status;
  }

  if (typeof input.job_description === 'string' && input.job_description.trim()) {
    out.job_description = input.job_description.trim().slice(0, 500);
  }

  if (typeof input.next_action === 'string' && input.next_action.trim()) {
    out.next_action = input.next_action.trim().slice(0, 200);
  }

  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: AI_FAILURE_MESSAGE.not_configured, reason: 'not_configured' },
      { status: 503 },
    );
  }

  const limit = checkRateLimit(`ai:${user.id}`, RATE_LIMITS.ai);
  if (!limit.success) return rateLimitResponse(limit);

  let body: { contactId?: unknown; task?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contactId = typeof body.contactId === 'string' ? body.contactId : null;
  const task = body.task === 'cleanup' ? 'cleanup' : body.task === 'summary' ? 'summary' : null;
  if (!contactId || !task) {
    return NextResponse.json(
      { error: 'contactId and task ("summary" | "cleanup") are required' },
      { status: 400 },
    );
  }

  // RLS scopes this to the caller's account — no explicit account filter
  // needed, and none would be trustworthy anyway.
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  if (contactError) {
    console.error('[ai] contact load failed:', contactError.message);
    return NextResponse.json({ error: 'Failed to load customer' }, { status: 500 });
  }
  if (!contact) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const [dealsRes, notesRes] = await Promise.all([
    supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('contact_notes')
      .select('note_text')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const context = buildContactContext(
    contact as Contact,
    (dealsRes.data ?? []) as Deal[],
    (notesRes.data ?? []).map((n) => n.note_text as string),
  );

  const result = await chat({
    system: task === 'summary' ? SUMMARY_SYSTEM : CLEANUP_SYSTEM,
    user: JSON.stringify(context),
    temperature: task === 'summary' ? 0.4 : 0,
    maxTokens: task === 'summary' ? 200 : 400,
    json: task === 'cleanup',
  });

  if (!result.ok) {
    const status = result.reason === 'rate_limited' ? 429 : 502;
    return NextResponse.json(
      { error: AI_FAILURE_MESSAGE[result.reason], reason: result.reason },
      { status },
    );
  }

  if (task === 'summary') {
    // Cache so re-opening a customer doesn't spend the shared free-tier
    // budget again. The column arrives in migration 030; if it hasn't
    // been applied yet the write fails harmlessly and the summary is
    // simply regenerated next time.
    const { error: cacheError } = await supabase
      .from('contacts')
      .update({ ai_summary: result.text, ai_summary_at: new Date().toISOString() })
      .eq('id', contactId);
    if (cacheError) {
      console.warn('[ai] summary cache skipped:', cacheError.message);
    }
    return NextResponse.json({ summary: result.text });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    console.error('[ai] cleanup returned non-JSON');
    return NextResponse.json(
      { error: 'The model returned something unreadable. Try again.', reason: 'empty_response' },
      { status: 502 },
    );
  }

  return NextResponse.json({ suggestions: sanitiseCleanup(parsed) });
}
