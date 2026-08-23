'use client';

import type { Contact } from '@/types';
import { LEAD_STATUS_META } from '@/lib/lead-status';
import {
  CALL_OUTCOME_META,
  daysAgo,
  getContactStatus,
  relativeDay,
} from '@/lib/call-log';
import { Phone, Car, MessageSquare, CalendarClock, Clock } from 'lucide-react';

interface CallLogCardProps {
  contact: Contact;
  onOpen: (contact: Contact) => void;
}

export function CallLogCard({ contact: c, onOpen }: CallLogCardProps) {
  const status = getContactStatus(c);
  const vehicle = [c.car_brand, c.car_model].filter(Boolean).join(' ') || null;
  const display = c.name || c.phone;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(c);
        }
      }}
      className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border/50 bg-card pl-4 pr-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-lg"
    >
      {/* Name + lead badge */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 truncate text-sm font-semibold leading-snug text-foreground" title={display}>
          {display}
        </h4>
        {c.lead_status && (
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEAD_STATUS_META[c.lead_status].badge}`}
          >
            {LEAD_STATUS_META[c.lead_status].label}
          </span>
        )}
      </div>

      {/* Phone */}
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Phone className="size-3 shrink-0" />
        <span className="truncate">{c.phone}</span>
      </div>

      {/* Vehicle */}
      {vehicle && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Car className="size-3 shrink-0" />
          <span className="truncate">{vehicle}</span>
        </div>
      )}

      {/* Status-specific footer */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {status === 'not_contacted' && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            Added {daysAgo(c.created_at)}
          </span>
        )}

        {status === 'follow_up' && c.next_follow_up_at && (() => {
          const rel = relativeDay(c.next_follow_up_at);
          return (
            <span className={`flex items-center gap-1 ${rel.overdue ? 'text-danger' : 'text-muted-foreground'}`}>
              <CalendarClock className="size-3" />
              {rel.label}
            </span>
          );
        })()}

        {status === 'contacted' && c.last_contacted_at && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            {daysAgo(c.last_contacted_at)}
          </span>
        )}

        {c.last_call_outcome && (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${CALL_OUTCOME_META[c.last_call_outcome].badge}`}
          >
            {CALL_OUTCOME_META[c.last_call_outcome].label}
          </span>
        )}

        {c.messaged && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
            <MessageSquare className="size-2.5" />
            Messaged
          </span>
        )}
      </div>
    </div>
  );
}
