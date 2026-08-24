'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactNote, CustomField, Deal } from '@/types';
import { SERVICE_TYPES, getServiceTypes } from '@/lib/services';
import { LEAD_STATUSES, LEAD_STATUS_META, type LeadStatus } from '@/lib/lead-status';
import { ContactAiPanel } from '@/components/contacts/contact-ai-panel';
import {
  SidePanel,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '@/components/ui/side-panel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandCombobox } from "@/components/ui/brand-combobox";
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

/** Shared shell for the small stacked "label above field" pattern. */
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

const INPUT_CLASS = 'h-9 bg-muted text-sm text-foreground';

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();
  const { accountId } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [tab, setTab] = useState('details');

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editLeadStatus, setEditLeadStatus] = useState<LeadStatus | null>(null);
  // Vehicle & Service (editable inline — mirrors the Add Customer form)
  const [editCarBrand, setEditCarBrand] = useState('');
  const [editCarModel, setEditCarModel] = useState('');
  const [editCarYear, setEditCarYear] = useState('');
  const [editCarTrim, setEditCarTrim] = useState('');
  const [editVin, setEditVin] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editServiceTypes, setEditServiceTypes] = useState<string[]>([]);
  const [editJobDescription, setEditJobDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleEditService(service: string) {
    setEditServiceTypes((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  }

  // Tags — folded in from their own tab. Saved on click, not on Save.
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields — folded into Details behind a disclosure, and saved
  // by the same Save changes button as everything else.
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savedCustomValues, setSavedCustomValues] = useState<Record<string, string>>({});
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
      setEditLeadStatus(data.lead_status ?? null);
      setEditCarBrand(data.car_brand ?? '');
      setEditCarModel(data.car_model ?? '');
      setEditCarYear(data.car_year != null ? String(data.car_year) : '');
      setEditCarTrim(data.car_trim ?? '');
      setEditVin(data.vin ?? '');
      setEditPlate(data.plate_number ?? '');
      setEditServiceTypes(getServiceTypes(data));
      setEditJobDescription(data.job_description ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
      setSavedCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      setTab('details');
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals]);

  const customFieldsDirty = useMemo(() => {
    const keys = new Set([
      ...Object.keys(customValues),
      ...Object.keys(savedCustomValues),
    ]);
    return [...keys].some(
      (k) => (customValues[k] ?? '').trim() !== (savedCustomValues[k] ?? '').trim()
    );
  }, [customValues, savedCustomValues]);

  /**
   * Drives the Save button. Comparing against the loaded record beats a
   * flag flipped by every onChange: retyping the original value stops
   * counting as a change, and a save that lands leaves nothing pending.
   */
  const dirty = useMemo(() => {
    if (!contact) return false;
    const same =
      editName.trim() === (contact.name ?? '') &&
      editPhone.trim() === contact.phone &&
      editEmail.trim() === (contact.email ?? '') &&
      editCompany.trim() === (contact.company ?? '') &&
      editLeadStatus === (contact.lead_status ?? null) &&
      editCarBrand.trim() === (contact.car_brand ?? '') &&
      editCarModel.trim() === (contact.car_model ?? '') &&
      editCarYear === (contact.car_year != null ? String(contact.car_year) : '') &&
      editCarTrim.trim() === (contact.car_trim ?? '') &&
      editVin.trim() === (contact.vin ?? '') &&
      editPlate.trim() === (contact.plate_number ?? '') &&
      editJobDescription.trim() === (contact.job_description ?? '') &&
      editServiceTypes.slice().sort().join('|') ===
        getServiceTypes(contact).slice().sort().join('|');
    return !same || customFieldsDirty;
  }, [
    contact,
    editName,
    editPhone,
    editEmail,
    editCompany,
    editLeadStatus,
    editCarBrand,
    editCarModel,
    editCarYear,
    editCarTrim,
    editVin,
    editPlate,
    editJobDescription,
    editServiceTypes,
    customFieldsDirty,
  ]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveCustomFields() {
    if (!contactId) return;
    // Replace wholesale: the value set is tiny, and this avoids diffing
    // inserts against updates against deletes.
    await supabase.from('contact_custom_values').delete().eq('contact_id', contactId);

    const rows = Object.entries(customValues)
      .filter(([, val]) => val.trim())
      .map(([fieldId, val]) => ({
        contact_id: contactId,
        custom_field_id: fieldId,
        value: val.trim(),
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('contact_custom_values').insert(rows);
      if (error) throw error;
    }
    setSavedCustomValues(customValues);
  }

  /** One Save for the whole Details tab, custom fields included. */
  async function saveAll() {
    if (!contactId || !editPhone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: editName.trim() || null,
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
          company: editCompany.trim() || null,
          lead_status: editLeadStatus,
          car_brand: editCarBrand.trim() || null,
          car_model: editCarModel.trim() || null,
          car_year: editCarYear ? parseInt(editCarYear, 10) : null,
          car_trim: editCarTrim.trim() || null,
          vin: editVin.trim() || null,
          plate_number: editPlate.trim() || null,
          service_types: editServiceTypes.length ? editServiceTypes : null,
          // Keep the legacy single column in sync (first selection).
          service_type: editServiceTypes[0] ?? null,
          job_description: editJobDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (error) throw error;
      if (customFieldsDirty) await saveCustomFields();

      toast.success('Changes saved');
      fetchContact();
      onUpdated();
    } catch {
      toast.error('Could not save changes. Check your connection and try again.');
    }
    setSaving(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (!error) {
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
        onUpdated();
      }
    } else {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (!error) {
        setContactTagIds((prev) => [...prev, tagId]);
        onUpdated();
      }
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error('Not authenticated');
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error('Failed to add note');
    } else {
      setNewNote('');
      fetchNotes();
      toast.success('Note added');
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Failed to delete note');
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Note deleted');
    }
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const filledCustomCount = Object.values(customValues).filter((v) => v.trim()).length;

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} width="md">
      <SidePanelContent aria-label="Customer details">
        {loading || !contact ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SidePanelHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <SidePanelTitle>{contact.name || 'Unknown'}</SidePanelTitle>
                    {contact.lead_status && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEAD_STATUS_META[contact.lead_status].badge}`}
                      >
                        {LEAD_STATUS_META[contact.lead_status].label}
                      </span>
                    )}
                  </div>
                  <SidePanelDescription className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      onClick={copyPhone}
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <Phone className="size-3" />
                      {contact.phone}
                      {copiedPhone ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {contact.company}
                      </span>
                    )}
                  </SidePanelDescription>
                </div>
              </div>
            </SidePanelHeader>

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(String(value))}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-5 rounded-none border-b border-border px-5 py-0 group-data-horizontal/tabs:h-auto"
              >
                {[
                  ['details', 'Details'],
                  ['notes', notes.length ? `Notes (${notes.length})` : 'Notes'],
                  ['deals', deals.length ? `Deals (${deals.length})` : 'Deals'],
                ].map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-9 flex-none rounded-none px-0 text-sm text-muted-foreground data-active:text-foreground group-data-horizontal/tabs:after:bottom-0"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ── Details ────────────────────────────────────────── */}
              <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Field label="Name">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Full name"
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone" required>
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="name@example.com"
                          className={INPUT_CLASS}
                        />
                      </Field>
                    </div>
                    <Field label="Company">
                      <Input
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        placeholder="Optional"
                        className={INPUT_CLASS}
                      />
                    </Field>
                  </div>

                  {/* One segmented control, not three loose buttons. */}
                  <Field label="Lead temperature">
                    <div className="flex w-full rounded-lg border border-border bg-muted p-0.5">
                      {LEAD_STATUSES.map((s) => {
                        const active = editLeadStatus === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setEditLeadStatus(active ? null : s)}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {LEAD_STATUS_META[s].label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <div className="space-y-3">
                    <SectionLabel>Vehicle</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Make">
                        <BrandCombobox
                          value={editCarBrand}
                          onChange={setEditCarBrand}
                          placeholder="Toyota"
                        />
                      </Field>
                      <Field label="Model">
                        <Input
                          value={editCarModel}
                          onChange={(e) => setEditCarModel(e.target.value)}
                          placeholder="Camry"
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="Year">
                        <Input
                          type="number"
                          min={1900}
                          max={2030}
                          value={editCarYear}
                          onChange={(e) => setEditCarYear(e.target.value)}
                          placeholder="2022"
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="Trim">
                        <Input
                          value={editCarTrim}
                          onChange={(e) => setEditCarTrim(e.target.value)}
                          placeholder="Sport"
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="Plate">
                        <Input
                          value={editPlate}
                          onChange={(e) => setEditPlate(e.target.value)}
                          placeholder="DXB A 12345"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </Field>
                      <Field label="VIN">
                        <Input
                          value={editVin}
                          onChange={(e) => setEditVin(e.target.value)}
                          placeholder="1HGBH41JXMN109186"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <SectionLabel>Service</SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_TYPES.map((t) => {
                        const checked = editServiceTypes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleEditService(t)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              checked
                                ? 'border-primary bg-primary-soft text-primary'
                                : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {checked && <Check className="size-3" />}
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <Field label="Job description">
                      <Textarea
                        value={editJobDescription}
                        onChange={(e) => setEditJobDescription(e.target.value)}
                        placeholder="What the customer asked for, in their words"
                        className="min-h-[72px] resize-none bg-muted text-sm text-foreground"
                      />
                    </Field>
                  </div>

                  {allTags.length > 0 && (
                    <div className="space-y-3">
                      <SectionLabel>Tags</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag) => {
                          const selected = contactTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => toggleTag(tag.id)}
                              disabled={savingTags}
                              aria-pressed={selected}
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
                                selected ? '' : 'opacity-45 hover:opacity-75'
                              }`}
                              style={{
                                backgroundColor: tag.color + '20',
                                color: tag.color,
                              }}
                            >
                              {selected && <Check className="size-3" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Present, but out of the way until someone needs them. */}
                  {!loadingCustom && customFields.length > 0 && (
                    <details className="group border-t border-border pt-4">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                        More fields
                        {filledCustomCount > 0 && (
                          <span className="font-normal normal-case tracking-normal">
                            ({filledCustomCount} filled)
                          </span>
                        )}
                      </summary>
                      <div className="mt-3 space-y-3">
                        {customFields.map((field) => (
                          <Field key={field.id} label={field.field_name}>
                            <Input
                              value={customValues[field.id] ?? ''}
                              onChange={(e) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.value,
                                }))
                              }
                              className={`${INPUT_CLASS} capitalize`}
                            />
                          </Field>
                        ))}
                      </div>
                    </details>
                  )}

                  <div className="border-t border-border pt-5">
                    <ContactAiPanel contact={contact} onUpdated={fetchContact} />
                  </div>
                </div>
              </TabsContent>

              {/* ── Notes ──────────────────────────────────────────── */}
              <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col px-5 py-4">
                <div className="mb-4 space-y-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write a note..."
                    className="min-h-[72px] resize-none bg-muted text-sm text-foreground"
                  />
                  <Button
                    onClick={addNote}
                    disabled={!newNote.trim() || savingNote}
                    size="sm"
                    className="h-8"
                  >
                    {savingNote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Add note
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                  {loadingNotes ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No notes yet. The first one goes above.
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="group border-b border-border pb-3 last:border-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 whitespace-pre-wrap text-sm text-foreground">
                            {note.note_text}
                          </p>
                          <button
                            onClick={() => deleteNote(note.id)}
                            aria-label="Delete note"
                            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* ── Deals ──────────────────────────────────────────── */}
              <TabsContent value="deals" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {loadingDeals ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : deals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No jobs booked for this customer yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deals.map((deal) => (
                      <div key={deal.id} className="border-b border-border pb-3 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{deal.title}</p>
                          {deal.stage && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${deal.stage.color}20`,
                                color: deal.stage.color,
                              }}
                            >
                              {deal.stage.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency || 'USD',
                              maximumFractionDigits: 0,
                            }).format(Number(deal.value || 0))}
                          </span>
                          {deal.status && deal.status !== 'open' && (
                            <span
                              className={deal.status === 'won' ? 'text-success' : 'text-danger'}
                            >
                              {deal.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {tab === 'details' && (
              <SidePanelFooter className="justify-between">
                <span aria-live="polite" className="text-xs text-muted-foreground">
                  {dirty ? 'Unsaved changes' : 'All changes saved'}
                </span>
                <Button onClick={saveAll} disabled={!dirty || saving} size="sm" className="h-8">
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  Save changes
                </Button>
              </SidePanelFooter>
            )}
          </>
        )}
      </SidePanelContent>
    </SidePanel>
  );
}
