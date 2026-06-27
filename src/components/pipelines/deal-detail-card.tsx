'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Deal } from '@/types';
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
import { Loader2, Phone, Car, Wrench, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

interface DealDetailCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  onEdit: (deal: Deal) => void;
  onSaved: () => void;
}

export function DealDetailCard({
  open,
  onOpenChange,
  deal,
  onEdit,
  onSaved,
}: DealDetailCardProps) {
  const supabase = createClient();

  const [depositPct, setDepositPct] = useState('25');
  const [depositPaid, setDepositPaid] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !deal) return;
    setDepositPct(String(deal.deposit_percentage ?? 25));
    setDepositPaid(deal.deposit_paid ?? false);
    setStartDate(deal.start_date ?? '');
    setDeliveryDate(deal.delivery_date ?? '');
  }, [open, deal]);

  if (!deal) return null;

  const pct = parseFloat(depositPct) || 0;
  const depositAmount = (deal.value * pct) / 100;
  const remainingBalance = deal.value - depositAmount;

  const c = deal.contact;
  const vehicleParts = [c?.car_year, c?.car_brand, c?.car_model].filter(Boolean).join(' ');
  const vehicleLine = [vehicleParts, c?.plate_number].filter(Boolean).join(' · ');

  async function handleSave() {
    if (!deal) return;
    setSaving(true);
    const { error } = await supabase
      .from('deals')
      .update({
        deposit_percentage: pct || 25,
        deposit_paid: depositPaid,
        start_date: startDate || null,
        delivery_date: deliveryDate || null,
      })
      .eq('id', deal.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    toast.success('Saved');
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">{deal.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact & vehicle info */}
          {c && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
              <p className="font-semibold text-sm text-foreground">{c.name || c.phone}</p>
              {c.name && c.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="size-3 shrink-0" />
                  {c.phone}
                </p>
              )}
              {vehicleLine && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Car className="size-3 shrink-0" />
                  {vehicleLine}
                </p>
              )}
              {c.service_type && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wrench className="size-3 shrink-0" />
                  {c.service_type}
                </p>
              )}
              {c.job_description && (
                <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
                  {c.job_description}
                </p>
              )}
            </div>
          )}

          {/* Quote value */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quote Value</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(deal.value, deal.currency)}
            </span>
          </div>

          {/* Deposit */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deposit
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Percentage</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={depositPct}
                    onChange={(e) => setDepositPct(e.target.value)}
                    className="pr-7 h-8 text-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <div className="h-8 rounded-lg border border-border/50 bg-background px-3 flex items-center text-sm font-medium text-foreground">
                  {formatCurrency(depositAmount, deal.currency)}
                </div>
              </div>
            </div>

            {/* Paid toggle */}
            <button
              type="button"
              onClick={() => setDepositPaid((prev) => !prev)}
              className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                depositPaid
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{depositPaid ? 'Deposit Paid' : 'Deposit Pending'}</span>
              {depositPaid ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
            </button>

            {/* Remaining balance */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Remaining Balance</span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(remainingBalance, deal.currency)}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                Delivery Date
              </Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          {deal.notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{deal.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onEdit(deal);
            }}
          >
            Edit Full Details
          </Button>
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
