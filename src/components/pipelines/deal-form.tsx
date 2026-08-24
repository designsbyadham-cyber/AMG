"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Contact, Deal, DealStatus, PipelineStage, Profile } from "@/types";
import { SERVICE_TYPES } from "@/lib/services";
import { JobPhotoUpload } from "@/components/pipelines/job-photo-upload";
import {
  SidePanel,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  ClipboardList,
  Car,
  Gauge,
  Check,
  X,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();

  // Customer + vehicle (captured inline; resolved to a contact on save)
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [year, setYear] = useState("");
  const [odometer, setOdometer] = useState("");
  const [plate, setPlate] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  // Order details
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [entryDate, setEntryDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [depositPct, setDepositPct] = useState("25");
  const [depositPaid, setDepositPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // The contact this deal is (or will be) linked to. Set when editing an
  // existing deal, or resolved by phone on save.
  const [existingContactId, setExistingContactId] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleService(s: string) {
    setServiceTypes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  // Prefill vehicle/customer fields from a linked contact.
  function prefillFromContact(c: Contact) {
    setCustName(c.name ?? "");
    setCustPhone(c.phone ?? "");
    setCustEmail(c.email ?? "");
    setVehicle([c.car_brand, c.car_model].filter(Boolean).join(" "));
    setYear(c.car_year != null ? String(c.car_year) : "");
    setPlate(c.plate_number ?? "");
    setServiceTypes(
      c.service_types && c.service_types.length
        ? c.service_types
        : c.service_type
          ? [c.service_type]
          : [],
    );
  }

  // Reset / seed the form whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || "AED");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setEntryDate(deal.start_date ?? "");
      setCompletionDate(deal.delivery_date ?? deal.expected_close_date ?? "");
      setDepositPct(String(deal.deposit_percentage ?? 25));
      setDepositPaid(deal.deposit_paid ?? false);
      setNotes(deal.notes ?? "");
      setOdometer(deal.odometer != null ? String(deal.odometer) : "");
      setImageUrls(deal.image_urls ?? []);
      setExistingContactId(deal.contact_id ?? null);
      // Customer/vehicle prefill happens once contacts load (below) or
      // from the embedded contact if present on the deal.
      if (deal.contact) prefillFromContact(deal.contact);
    } else {
      setCustName("");
      setCustPhone("");
      setCustEmail("");
      setVehicle("");
      setYear("");
      setOdometer("");
      setPlate("");
      setServiceTypes([]);
      setValue("");
      setCurrency("AED");
      setEntryDate(todayISO());
      setCompletionDate("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setDepositPct("25");
      setDepositPaid(false);
      setNotes("");
      setImageUrls([]);
      setExistingContactId(null);
    }
  }, [open, deal, defaultStageId, stages]);

  // Load contacts + profiles once open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      const list = (c.data ?? []) as Contact[];
      setContacts(list);
      setProfiles((p.data ?? []) as Profile[]);
      // If editing a deal whose contact wasn't embedded, prefill from the
      // freshly-loaded list.
      if (deal?.contact_id && !deal.contact) {
        const linked = list.find((x) => x.id === deal.contact_id);
        if (linked) prefillFromContact(linked);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supabase]);

  const selectedStageName = stages.find((s) => s.id === stageId)?.name ?? "";
  const prevStageName = deal
    ? stages.find((s) => s.id === deal.stage_id)?.name ?? ""
    : "";

  function deriveTitle(): string {
    const base = vehicle.trim() || custName.trim() || "Job";
    return serviceTypes[0] ? `${base} — ${serviceTypes[0]}` : base;
  }

  async function ensureQcTag(): Promise<string | null> {
    const QC_TAG_NAME = "Quality Check Pending";
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("name", QC_TAG_NAME)
      .maybeSingle();
    if (existing) return existing.id;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) return null;
    const { data: created } = await supabase
      .from("tags")
      .insert({ user_id: user.id, account_id: accountId, name: QC_TAG_NAME, color: "#f59e0b" })
      .select("id")
      .single();
    return created?.id ?? null;
  }

  async function addQcTagToContact(cId: string) {
    const tagId = await ensureQcTag();
    if (!tagId) return;
    await supabase
      .from("contact_tags")
      .upsert({ contact_id: cId, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }

  /**
   * Resolve the deal's contact from the inline fields:
   *  - editing with a linked contact -> update it
   *  - otherwise match an existing contact by phone digits -> update it
   *  - no match -> create a new contact
   * Returns the contact id, or null on failure.
   */
  async function resolveContact(userId: string): Promise<string | null> {
    const phone = normalizePhone(custPhone);
    const contactFields = {
      name: custName.trim() || null,
      phone,
      email: custEmail.trim() || null,
      car_brand: null as string | null,
      car_model: vehicle.trim() || null,
      car_year: year ? parseInt(year, 10) : null,
      plate_number: plate.trim() || null,
      service_types: serviceTypes.length ? serviceTypes : null,
      service_type: serviceTypes[0] ?? null,
    };

    // Which existing contact (if any) should we attach to?
    let targetId = existingContactId;
    if (!targetId) {
      const digits = phone.replace(/\D/g, "");
      const match = contacts.find(
        (c) => c.phone && c.phone.replace(/\D/g, "") === digits,
      );
      targetId = match?.id ?? null;
    }

    if (targetId) {
      const { error } = await supabase
        .from("contacts")
        .update({ ...contactFields, updated_at: new Date().toISOString() })
        .eq("id", targetId);
      if (error) return null;
      return targetId;
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({ ...contactFields, user_id: userId, account_id: accountId })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  }

  async function handleSave() {
    if (!custName.trim() || !custPhone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (!stageId) {
      toast.error("Pick a stage");
      return;
    }
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }
    if (!accountId) {
      toast.error("Your profile is not linked to an account.");
      setSaving(false);
      return;
    }

    const contactId = await resolveContact(user.id);
    if (!contactId) {
      toast.error("Failed to save customer details");
      setSaving(false);
      return;
    }

    const movingToCollected = selectedStageName === "Collected";
    const movingAwayFromCollected = prevStageName === "Collected" && !movingToCollected;

    const payload: Record<string, unknown> = {
      title: deriveTitle(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      start_date: entryDate || null,
      delivery_date: completionDate || null,
      deposit_percentage: parseFloat(depositPct) || 25,
      deposit_paid: depositPaid,
      odometer: odometer ? parseInt(odometer, 10) : null,
      image_urls: imageUrls.length ? imageUrls : null,
    };

    if (movingToCollected) payload.collected_at = new Date().toISOString();
    else if (movingAwayFromCollected) payload.collected_at = null;

    if (deal) {
      const { error } = await supabase.from("deals").update(payload).eq("id", deal.id);
      if (error) {
        toast.error("Failed to save job");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error("Failed to create job");
        setSaving(false);
        return;
      }
    }

    if (movingToCollected) await addQcTagToContact(contactId);

    setSaving(false);
    toast.success(deal ? "Job updated" : "Order started");
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase.from("deals").update({ status }).eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error("Failed to update job status");
      return;
    }
    toast.success(status === "won" ? "Marked as won" : status === "lost" ? "Marked as lost" : "Job reopened");
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete job");
      return;
    }
    toast.success("Job deleted");
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  const depositAmount =
    parseFloat(value) && depositPct
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency || "AED",
          minimumFractionDigits: 0,
        }).format((parseFloat(value) * (parseFloat(depositPct) || 0)) / 100)
      : "—";

  const inputCls =
    "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} width="lg">
      <SidePanelContent>
        <div className="flex h-full flex-col">
          <SidePanelHeader>
            <SidePanelTitle>
              {deal ? "Edit Job" : "New Job Intake"}
            </SidePanelTitle>
          </SidePanelHeader>

          <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
            {/* Photos card */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Camera className="size-4 text-primary" />
                Vehicle / Job Photos
              </h3>
              <JobPhotoUpload value={imageUrls} onChange={setImageUrls} />
            </section>

            {/* New entry details card */}
            <section className="space-y-5 rounded-xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="size-4 text-primary" />
                New Entry Details
              </h3>

              {/* Vehicle */}
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Car className="size-3.5" />
                  Vehicle
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Make / Model</Label>
                    <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Nissan Sentra" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Gauge className="size-3" />
                      Odometer (km)
                    </Label>
                    <Input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="000000" inputMode="numeric" />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Plate Number</Label>
                    <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="DXB A 12345" />
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+971 50 123 4567" />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Email Address</Label>
                    <Input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Services Required
                </p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.map((s) => {
                    const on = serviceTypes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleService(s)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {on && <Check className="mr-1 inline size-3" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order details */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Details
                </p>
                <div className="grid grid-cols-[1fr_90px] gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Total Amount</Label>
                    <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Currency</Label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                      <option value="AED">AED</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Entry Date</Label>
                    <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Estimated Completion</Label>
                    <Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Stage</Label>
                    <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputCls}>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputCls}>
                      <option value="">Unassigned</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedStageName === "Collected" && (
                  <p className="text-xs text-warning">
                    Moving to Collected triggers the 10-day quality check follow-up.
                  </p>
                )}

                {/* Deposit */}
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Deposit %</Label>
                      <div className="relative">
                        <Input type="number" min={0} max={100} step={1} value={depositPct} onChange={(e) => setDepositPct(e.target.value)} className="pr-7" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Deposit Amount</Label>
                      <div className="flex h-9 items-center rounded-lg border border-border/50 bg-background px-3 text-sm text-muted-foreground">
                        {depositAmount}
                      </div>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={depositPaid} onChange={(e) => setDepositPaid(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm text-foreground">Deposit paid</span>
                  </label>
                </div>

                {/* Notes */}
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Additional Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." className="min-h-[80px]" />
                </div>
              </div>

              {/* Status (edit only) */}
              {deal && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handleStatusChange("won")}
                      disabled={!!statusAction || deal.status === "won"}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {statusAction === "won" ? <Loader2 className="size-4 animate-spin" /> : <><Check className="mr-1 size-4" />Won</>}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleStatusChange("lost")}
                      disabled={!!statusAction || deal.status === "lost"}
                      className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {statusAction === "lost" ? <Loader2 className="size-4 animate-spin" /> : <><X className="mr-1 size-4" />Lost</>}
                    </Button>
                  </div>
                  {deal.status && deal.status !== "open" && (
                    <Button type="button" variant="ghost" onClick={() => handleStatusChange("open")} disabled={!!statusAction} className="w-full text-muted-foreground hover:text-foreground">
                      Reopen job
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-card p-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !custName.trim() || !custPhone.trim() || !stageId}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <><Loader2 className="mr-1 size-4 animate-spin" />Saving…</>
                ) : deal ? (
                  "Save Changes"
                ) : (
                  <><Check className="mr-1 size-4" />Confirm & Start Order</>
                )}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
                  <span className="text-destructive">Delete this job?</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="rounded px-2 py-1 text-muted-foreground hover:bg-muted">
                      Cancel
                    </button>
                    <button type="button" onClick={handleDelete} disabled={deleting} className="rounded bg-destructive px-2 py-1 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                      {deleting ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-destructive hover:text-destructive/80">
                  <Trash2 className="size-3" />
                  Delete Job
                </button>
              ))}
          </div>
        </div>
      </SidePanelContent>
    </SidePanel>
  );
}
