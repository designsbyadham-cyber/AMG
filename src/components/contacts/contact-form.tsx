'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { BrandCombobox } from "@/components/ui/brand-combobox";
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

import { SERVICE_TYPES, getServiceTypes } from '@/lib/services';
import { LEAD_STATUSES, LEAD_STATUS_META, type LeadStatus } from '@/lib/lead-status';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
}: ContactFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const isEdit = !!contact;

  // Customer Info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus | null>(null);

  // Vehicle Details
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carTrim, setCarTrim] = useState('');
  const [vin, setVin] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  // Service (multi-select: "select all that apply")
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [jobDescription, setJobDescription] = useState('');

  function toggleService(service: string) {
    setServiceTypes((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  }

  const [saving, setSaving] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setLeadStatus(contact?.lead_status ?? null);
      setCarBrand(contact?.car_brand ?? '');
      setCarModel(contact?.car_model ?? '');
      setCarYear(contact?.car_year != null ? String(contact.car_year) : '');
      setCarTrim(contact?.car_trim ?? '');
      setVin(contact?.vin ?? '');
      setPlateNumber(contact?.plate_number ?? '');
      setServiceTypes(getServiceTypes(contact));
      setJobDescription(contact?.job_description ?? '');
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      fetchTags();
    }
  }, [open, contact]);

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId) throw new Error('Your profile is not linked to an account.');

      const vehiclePayload = {
        car_brand: carBrand.trim() || null,
        car_model: carModel.trim() || null,
        car_year: carYear ? parseInt(carYear, 10) : null,
        car_trim: carTrim.trim() || null,
        vin: vin.trim() || null,
        plate_number: plateNumber.trim() || null,
        service_types: serviceTypes.length ? serviceTypes : null,
        // Keep the legacy single column in sync (first selection) so any
        // reader that still references service_type keeps working.
        service_type: serviceTypes[0] ?? null,
        job_description: jobDescription.trim() || null,
        lead_status: leadStatus,
      };

      let contactId = contact?.id;

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            ...vehiclePayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            ...vehiclePayload,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagRows);
          if (tagError) throw tagError;
        }
      }

      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save customer';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground overflow-y-auto max-h-[90vh] sm:max-w-lg max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[88vh] max-sm:rounded-b-none max-sm:rounded-t-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Customer' : 'Add Customer'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? 'Update the customer details below.'
              : 'Fill in the details to create a new customer.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1 — Customer Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Info</h3>
            <div className="space-y-2">
              <Label htmlFor="cf-name">Name</Label>
              <Input
                id="cf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-phone">Phone <span className="text-destructive">*</span></Label>
              <Input
                id="cf-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 50 123 4567"
              />
              <p className="text-xs text-muted-foreground">Include country code, e.g. +971 for UAE</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-email">Email</Label>
              <Input
                id="cf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-company">Company / Fleet</Label>
              <Input
                id="cf-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Fleet Ltd."
              />
            </div>
            <div className="space-y-2">
              <Label>Lead Status</Label>
              <div className="grid grid-cols-3 gap-2">
                {LEAD_STATUSES.map((s) => {
                  const active = leadStatus === s;
                  const meta = LEAD_STATUS_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLeadStatus(active ? null : s)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? meta.active
                          : 'border-input bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2 — Vehicle Details */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cf-car-brand">Car Brand</Label>
                <BrandCombobox
                  id="cf-car-brand"
                  value={carBrand}
                  onChange={setCarBrand}
                  placeholder="e.g. Toyota, BMW"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-car-model">Car Model</Label>
                <Input
                  id="cf-car-model"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="e.g. Camry, X5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cf-car-year">Year</Label>
                <Input
                  id="cf-car-year"
                  type="number"
                  min={1900}
                  max={2030}
                  value={carYear}
                  onChange={(e) => setCarYear(e.target.value)}
                  placeholder="2022"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-car-trim">Trim / Variant</Label>
                <Input
                  id="cf-car-trim"
                  value={carTrim}
                  onChange={(e) => setCarTrim(e.target.value)}
                  placeholder="e.g. Sport, M-Sport"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cf-vin">VIN / Chassis No.</Label>
                <Input
                  id="cf-vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-plate">Plate Number</Label>
                <Input
                  id="cf-plate"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="DXB A 12345"
                />
              </div>
            </div>
          </div>

          {/* Section 3 — Service */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service</h3>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <p className="text-xs text-muted-foreground">Select all that apply</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SERVICE_TYPES.map((t) => {
                  const checked = serviceTypes.includes(t);
                  return (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(t)}
                        className="size-4 rounded border-input text-primary focus:ring-primary"
                      />
                      {t}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-job-desc">Job Description</Label>
              <textarea
                id="cf-job-desc"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Describe the job in detail…"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Section 4 — Tags */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
            {loadingTags ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-3 animate-spin" />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags available. Create tags in Settings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="max-sm:sticky max-sm:bottom-0 max-sm:bg-card max-sm:py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
