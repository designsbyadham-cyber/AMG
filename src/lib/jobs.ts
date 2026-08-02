/**
 * Shared presentation helpers for job (deal) cards and rows.
 *
 * Both the board card (`deal-card.tsx`) and the list row
 * (`deal-row.tsx`) render the same facts — quality-check state,
 * pipeline progress, dates — so the derivations live here rather than
 * being duplicated per component.
 */

import type { Deal, PipelineStage } from '@/types';

export function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

/** dd/mm/yyyy — matches the job log's date style. */
export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function initials(name?: string | null, fallback?: string | null) {
  const source = (name || fallback || '?').trim();
  if (!source) return '?';
  return source.charAt(0).toUpperCase();
}

export type DateStatus = 'overdue' | 'today' | 'future';

export function getDateStatus(dateStr: string, status?: string): DateStatus {
  if (status === 'won' || status === 'lost') return 'future';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  if (date < today) return 'overdue';
  if (date.getTime() === today.getTime()) return 'today';
  return 'future';
}

export interface QcState {
  label: string;
  /** Tailwind classes for the badge. */
  cls: string;
  done: boolean;
}

/**
 * Quality-check state derived from where the job sits relative to the
 * "QC" stage. Returns null when the pipeline has no QC stage, so the
 * block hides rather than showing a meaningless badge.
 */
export function getQcState(deal: Deal, stages: PipelineStage[]): QcState | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const qcIndex = ordered.findIndex((s) => s.name.trim().toLowerCase() === 'qc');
  if (qcIndex === -1) return null;
  const currentIndex = ordered.findIndex((s) => s.id === deal.stage_id);
  if (currentIndex === -1) return null;

  if (deal.status === 'lost') {
    return { label: 'Rejected', cls: 'bg-red-500/10 text-red-500', done: false };
  }
  if (currentIndex > qcIndex) {
    return { label: 'QC Verified', cls: 'bg-emerald-500/10 text-emerald-500', done: true };
  }
  if (currentIndex === qcIndex) {
    return { label: 'In Quality Check', cls: 'bg-cyan-500/10 text-cyan-500', done: false };
  }
  return { label: 'QC Pending', cls: 'bg-muted text-muted-foreground', done: false };
}

export interface JobProgress {
  /** 0-100 completion through the pipeline. */
  pct: number;
  /** 1-based position of the current stage. */
  step: number;
  total: number;
}

export function getProgress(deal: Deal, stages: PipelineStage[]): JobProgress | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((s) => s.id === deal.stage_id);
  if (currentIndex === -1 || ordered.length < 2) return null;
  return {
    pct: Math.round((currentIndex / (ordered.length - 1)) * 100),
    step: currentIndex + 1,
    total: ordered.length,
  };
}

/** "Ferrari F8" from the linked contact, falling back to the job title. */
export function vehicleName(deal: Deal): string {
  const name = [deal.contact?.car_brand, deal.contact?.car_model]
    .filter(Boolean)
    .join(' ');
  return name || deal.title;
}

/** The date the job is due — delivery date wins over expected close. */
export function dueDate(deal: Deal): string | null {
  return deal.delivery_date ?? deal.expected_close_date ?? null;
}
