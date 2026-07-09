'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact } from '@/types';
import { CONTACT_STATUS_META, getContactStatus, type ContactStatus } from '@/lib/call-log';
import { CallLogCard } from '@/components/call-log/call-log-card';
import { CallLogModal } from '@/components/call-log/call-log-modal';
import { Input } from '@/components/ui/input';
import { Search, Loader2, PhoneCall } from 'lucide-react';

const COLUMN_ORDER: ContactStatus[] = ['not_contacted', 'follow_up', 'contacted'];

export default function CallLogPage() {
  const supabase = createClient();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('Failed to load contacts');
      setLoading(false);
      return;
    }
    setContacts((data ?? []) as Contact[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) =>
      [c.name, c.phone, c.car_brand, c.car_model, c.plate_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [contacts, search]);

  const buckets = useMemo(() => {
    const map: Record<ContactStatus, Contact[]> = {
      not_contacted: [],
      follow_up: [],
      contacted: [],
    };
    for (const c of filtered) map[getContactStatus(c)].push(c);

    // not_contacted: oldest first (work the backlog top-down).
    map.not_contacted.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    // follow_up: soonest / overdue callbacks first, undated last.
    map.follow_up.sort((a, b) => {
      const av = a.next_follow_up_at ?? '9999-12-31';
      const bv = b.next_follow_up_at ?? '9999-12-31';
      return av.localeCompare(bv);
    });
    // contacted: most recently reached first.
    map.contacted.sort(
      (a, b) =>
        new Date(b.last_contacted_at ?? b.created_at).getTime() -
        new Date(a.last_contacted_at ?? a.created_at).getTime(),
    );
    return map;
  }, [filtered]);

  const openModal = useCallback((contact: Contact) => {
    setActiveContact(contact);
    setModalOpen(true);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Call Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Work your customer list — who to call, who to follow up with, and who you&apos;ve reached.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, vehicle, plate…"
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMN_ORDER.map((status) => {
            const meta = CONTACT_STATUS_META[status];
            const list = buckets[status];
            return (
              <div
                key={status}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card/40"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                    {list.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {list.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                      <PhoneCall className="size-6 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">{meta.blurb}</p>
                      <p className="text-[11px] text-muted-foreground/60">Nobody here right now.</p>
                    </div>
                  ) : (
                    list.map((c) => <CallLogCard key={c.id} contact={c} onOpen={openModal} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CallLogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contact={activeContact}
        onSaved={load}
      />
    </div>
  );
}
