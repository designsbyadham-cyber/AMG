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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const SERVICE_TYPES = [
  'Interior Upgrades',
  'Exterior Upgrades',
  'Detailing & Protection',
  'Tinting',
] as const;

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

  // Vehicle Details
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carTrim, setCarTrim] = useState('');
  const [vin, setVin] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  // Service
  const [serviceType, setServiceType] = useState('');
  const [jobDescription, setJobDescription] = useState('');

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
      setCarBrand(contact?.car_brand ?? '');
      setCarModel(contact?.car_model ?? '');
      setCarYear(contact?.car_year != null ? String(contact.car_year) : '');
      setCarTrim(contact?.car_trim ?? '');
      setVin(contact?.vin ?? '');
      setPlateNumber(contact?.plate_number ?? '');
      setServiceType(contact?.service_type ?? '');
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
        service_type: serviceType || null,
        job_description: jobDescription.trim() || null,
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
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          </div>

          {/* Section 2 — Vehicle Details */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cf-car-brand">Car Brand</Label>
                <Input
                  id="cf-car-brand"
                  value={carBrand}
                  onChange={(e) => setCarBrand(e.target.value)}
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
              <Label htmlFor="cf-service-type">Service Type</Label>
              <select
                id="cf-service-type"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select service type…</option>
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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

          <DialogFooter>
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
