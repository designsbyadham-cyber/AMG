'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact } from '@/types';
import { scoreContact } from '@/lib/ai/profile-score';
import { getServiceTypes } from '@/lib/services';
import { LEAD_STATUS_META, type LeadStatus } from '@/lib/lead-status';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { Loader2, Sparkles, Check, RefreshCw } from 'lucide-react';

interface CleanupSuggestion {
  service_types?: string[];
  lead_status?: LeadStatus;
  job_description?: string;
  next_action?: string;
}

interface ContactAiPanelProps {
  contact: Contact;
  /** Re-fetch the contact after suggestions are applied. */
  onUpdated: () => void;
}

/** Which suggested fields the user has ticked. */
type Picked = Record<string, boolean>;

const BAND_CAPTION = {
  strong: 'Complete',
  partial: 'Partial',
  thin: 'Sparse',
} as const;

export function ContactAiPanel({ contact, onUpdated }: ContactAiPanelProps) {
  const supabase = createClient();

  const [summary, setSummary] = useState<string | null>(contact.ai_summary ?? null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupSuggestion | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [picked, setPicked] = useState<Picked>({});
  const [applying, setApplying] = useState(false);
  // Latched once the server reports it has no provider key, so the
  // buttons stop inviting clicks that can only fail.
  const [notConfigured, setNotConfigured] = useState(false);

  // Deterministic — no network, so it renders instantly and keeps working
  // when the model is rate-limited or not configured at all.
  const strength = useMemo(() => scoreContact(contact), [contact]);

  async function callAi(task: 'summary' | 'cleanup') {
    const res = await fetch('/api/ai/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, task }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (payload.reason === 'not_configured') setNotConfigured(true);
      else toast.error(payload.error || 'AI request failed');
      return null;
    }
    return payload as { summary?: string; suggestions?: CleanupSuggestion };
  }

  async function handleSummary() {
    setSummaryLoading(true);
    const payload = await callAi('summary');
    setSummaryLoading(false);
    if (payload?.summary) setSummary(payload.summary);
  }

  async function handleCleanup() {
    setCleanupLoading(true);
    const payload = await callAi('cleanup');
    setCleanupLoading(false);
    if (!payload) return;
    const s = payload.suggestions ?? {};
    if (Object.keys(s).length === 0) {
      toast.info('Nothing new to suggest from these notes.');
      return;
    }
    setCleanup(s);
    // Pre-tick everything; the user unticks what they disagree with.
    setPicked(Object.fromEntries(Object.keys(s).map((k) => [k, true])));
  }

  async function applyPicked() {
    if (!cleanup) return;
    const update: Record<string, unknown> = {};
    if (picked.service_types && cleanup.service_types?.length) {
      update.service_types = cleanup.service_types;
      update.service_type = cleanup.service_types[0];
    }
    if (picked.lead_status && cleanup.lead_status) update.lead_status = cleanup.lead_status;
    if (picked.job_description && cleanup.job_description) {
      update.job_description = cleanup.job_description;
    }

    if (Object.keys(update).length === 0) {
      toast.info('Nothing selected.');
      return;
    }

    setApplying(true);
    const { error } = await supabase
      .from('contacts')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', contact.id);
    setApplying(false);

    if (error) {
      toast.error('Failed to save changes');
      return;
    }
    toast.success('Customer updated');
    setCleanup(null);
    onUpdated();
  }

  const currentServices = getServiceTypes(contact);
  const canTidy = Boolean(contact.job_description) && !notConfigured;

  return (
    <section className="space-y-5">
      {/* ── Profile strength — deterministic, no AI call ─────────────── */}
      <div className="flex items-center gap-4">
        <ScoreGauge
          value={strength.score}
          band={strength.band}
          caption={BAND_CAPTION[strength.band]}
          size={92}
          label="How complete this customer record is"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">Profile strength</h3>
          {strength.missing.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Everything we need to quote this job is on file.
            </p>
          ) : (
            /* The old copy listed the gaps and then asked the same
               questions underneath. The questions alone carry both. */
            <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
              {strength.missing.slice(0, 3).map((m) => (
                <li key={m.field}>{m.ask}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Summary</h3>
          <div className="flex items-center gap-1">
            {canTidy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCleanup}
                disabled={cleanupLoading}
                className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {cleanupLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Tidy notes
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSummary}
              disabled={summaryLoading || notConfigured}
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {summaryLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : summary ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {summary ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </div>

        {summary ? (
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {notConfigured
              ? 'AI is not set up yet. Add a provider key to enable summaries; the score above works either way.'
              : 'Generate a short brief before you call.'}
          </p>
        )}
      </div>

      {/* ── Note cleanup — suggestions only, never auto-applied ───────── */}
      {cleanup && (
        <div className="space-y-3 rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-medium text-foreground">Tick what to keep, then apply.</p>

          {cleanup.service_types?.length ? (
            <SuggestionRow
              id="service_types"
              label="Services"
              current={currentServices.join(', ') || 'none'}
              proposed={cleanup.service_types.join(', ')}
              checked={!!picked.service_types}
              onToggle={(v) => setPicked((p) => ({ ...p, service_types: v }))}
            />
          ) : null}

          {cleanup.lead_status ? (
            <SuggestionRow
              id="lead_status"
              label="Lead"
              current={contact.lead_status ? LEAD_STATUS_META[contact.lead_status].label : 'none'}
              proposed={LEAD_STATUS_META[cleanup.lead_status].label}
              checked={!!picked.lead_status}
              onToggle={(v) => setPicked((p) => ({ ...p, lead_status: v }))}
            />
          ) : null}

          {cleanup.job_description ? (
            <SuggestionRow
              id="job_description"
              label="Job details"
              current={contact.job_description ?? 'none'}
              proposed={cleanup.job_description}
              checked={!!picked.job_description}
              onToggle={(v) => setPicked((p) => ({ ...p, job_description: v }))}
            />
          ) : null}

          {cleanup.next_action && (
            <p className="text-xs text-muted-foreground">
              Next step: <span className="text-foreground">{cleanup.next_action}</span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={applyPicked} disabled={applying} className="h-8">
              {applying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCleanup(null)}
              disabled={applying}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SuggestionRow({
  id,
  label,
  current,
  proposed,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  current: string;
  proposed: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <label htmlFor={`sg-${id}`} className="flex cursor-pointer items-start gap-2.5">
      <input
        id={`sg-${id}`}
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-input text-primary focus:ring-primary"
      />
      <span className="min-w-0 flex-1 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-muted-foreground">
          <span className="line-through opacity-70">{current}</span>
          {' → '}
          <span className="text-foreground">{proposed}</span>
        </span>
      </span>
    </label>
  );
}
