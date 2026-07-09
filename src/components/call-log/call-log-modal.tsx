'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Contact } from '@/types';
import { SERVICE_TYPE_COLORS, getServiceTypes } from '@/lib/services';
import { LEAD_STATUS_META } from '@/lib/lead-status';
import {
  CONTACT_STATUS_META,
  deriveContactStatus,
  dateInDays,
  getContactStatus,
  type CallOutcome,
} from '@/lib/call-log';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Phone,
  PhoneOff,
  Car,
  Wrench,
  MessageSquare,
  CalendarClock,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface CallLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSaved: () => void;
}

export function CallLogModal({ open, onOpenChange, contact, onSaved }: CallLogModalProps) {
  const supabase = createClient();

  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [messaged, setMessaged] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync the local form from the contact each time the modal opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !contact) return;
    setOutcome(contact.last_call_outcome ?? null);
    setMessaged(contact.messaged ?? false);
    setFollowUp(contact.next_follow_up_at ?? '');
  }, [open, contact]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!contact) return null;

  const c = contact;
  const vehicleParts = [c.car_year, c.car_brand, c.car_model].filter(Boolean).join(' ');
  const vehicleLine = [vehicleParts, c.plate_number].filter(Boolean).join(' · ');
  const services = getServiceTypes(c);
  const currentStatus = getContactStatus(c);
  const nextStatus = deriveContactStatus({ outcome, messaged, followUp: followUp || null });

  // Choosing "No answer" with no callback date yet defaults it to +2 days
  // so a missed call always lands with a concrete next action.
  function chooseOutcome(next: CallOutcome) {
    const value = outcome === next ? null : next;
    setOutcome(value);
    if (value === 'no_answer' && !followUp) setFollowUp(dateInDays(2));
  }

  async function persist(payload: Partial<Contact>) {
    setSaving(true);
    const { error } = await supabase.from('contacts').update(payload).eq('id', c.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return false;
    }
    return true;
  }

  async function handleSave() {
    const anyAction = outcome !== null || messaged;
    const ok = await persist({
      contact_status: nextStatus,
      last_call_outcome: outcome,
      messaged,
      last_contacted_at: anyAction ? new Date().toISOString() : c.last_contacted_at ?? null,
      next_follow_up_at: followUp || null,
    });
    if (!ok) return;
    toast.success('Call logged');
    onSaved();
    onOpenChange(false);
  }

  async function handleReset() {
    const ok = await persist({
      contact_status: 'not_contacted',
      last_call_outcome: null,
      messaged: false,
      last_contacted_at: null,
      next_follow_up_at: null,
    });
    if (!ok) return;
    toast.success('Reset to “To Contact”');
    onSaved();
    onOpenChange(false);
  }

  const statusMeta = CONTACT_STATUS_META[nextStatus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground overflow-y-auto max-h-[90vh] sm:max-w-md max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[88vh] max-sm:rounded-b-none max-sm:rounded-t-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {c.name || c.phone}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusMeta.badge}`}
            >
              {statusMeta.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact card */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
            <a
              href={`tel:${c.phone}`}
              className="text-sm font-semibold text-primary flex items-center gap-1.5 hover:underline"
            >
              <Phone className="size-3.5 shrink-0" />
              {c.phone}
            </a>
            {vehicleLine && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Car className="size-3 shrink-0" />
                {vehicleLine}
              </p>
            )}
            {services.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Wrench className="size-3 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {services.map((s) => (
                    <span
                      key={s}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${SERVICE_TYPE_COLORS[s] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {c.lead_status && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEAD_STATUS_META[c.lead_status].badge}`}
              >
                {LEAD_STATUS_META[c.lead_status].label} lead
              </span>
            )}
            {c.job_description && (
              <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                {c.job_description}
              </p>
            )}
          </div>

          {/* Call outcome */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Log the call</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => chooseOutcome('answered')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  outcome === 'answered'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Phone className="size-4" />
                Answered
              </button>
              <button
                type="button"
                onClick={() => chooseOutcome('no_answer')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  outcome === 'no_answer'
                    ? 'border-red-500 bg-red-500/15 text-red-500'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <PhoneOff className="size-4" />
                No answer
              </button>
            </div>
          </div>

          {/* Message sent toggle */}
          <button
            type="button"
            onClick={() => setMessaged((prev) => !prev)}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
              messaged
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              Sent a message
            </span>
            <span
              className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${messaged ? 'bg-primary justify-end' : 'bg-border justify-start'}`}
            >
              <span className="size-4 rounded-full bg-white" />
            </span>
          </button>

          {/* Follow-up date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarClock className="size-3" />
              Contact them by
            </Label>
            <Input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row max-sm:sticky max-sm:bottom-0 max-sm:bg-card">
          {currentStatus !== 'not_contacted' && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="sm:mr-auto"
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
