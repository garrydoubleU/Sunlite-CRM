import { addDays, getDay, parseISO, differenceInDays, format, isValid } from 'date-fns';
import type { VisitFrequency } from '../types';

// Parse structured email summaries stored by GAS into subject + body + metadata.
// Handles formats:
//   "[Email sent] Subject\nbody..."
//   "[Gmail to: addr] Subject\nbody..."
//   "[Gmail from: addr] Subject\nbody..."
export interface ParsedEmail {
  direction: 'sent' | 'received' | null;
  address: string | null;
  subject: string;
  body: string;
}

export function parseEmailSummary(summary: string): ParsedEmail | null {
  if (!summary) return null;
  const tagMatch = summary.match(/^\[([^\]]+)\]\s*/);
  if (!tagMatch) return null;

  const tag = tagMatch[1].toLowerCase();
  let direction: ParsedEmail['direction'] = null;
  let address: string | null = null;

  if (tag.startsWith('gmail from:') || tag.startsWith('email from:')) {
    direction = 'received';
    address = tagMatch[1].replace(/^[^:]+:\s*/i, '').trim();
  } else if (tag.startsWith('gmail to:') || tag.startsWith('email to:')) {
    direction = 'sent';
    address = tagMatch[1].replace(/^[^:]+:\s*/i, '').trim();
  } else if (tag.includes('email sent') || tag.includes('sent')) {
    direction = 'sent';
  } else {
    return null;
  }

  const rest = summary.slice(tagMatch[0].length);
  const nlIdx = rest.indexOf('\n');
  let subject: string;
  let body: string;
  if (nlIdx !== -1) {
    subject = rest.slice(0, nlIdx).trim();
    body = rest.slice(nlIdx + 1).trim();
  } else {
    const colonIdx = rest.indexOf(': ');
    subject = colonIdx !== -1 ? rest.slice(0, colonIdx).trim() : rest.trim();
    body = colonIdx !== -1 ? rest.slice(colonIdx + 2).trim() : '';
  }

  return { direction, address, subject, body };
}

/** Never throws — returns fallback string when date is missing or invalid */
export function safeFormat(dateStr: string | undefined | null, fmt: string, fallback = '—'): string {
  if (!dateStr) return fallback;
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

/** Never throws — returns NaN-safe day difference */
export function safeDaysSince(dateStr: string | undefined | null): number {
  if (!dateStr) return 0;
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? differenceInDays(new Date(), d) : 0;
  } catch {
    return 0;
  }
}

export function calculateNextVisit(lastVisitDate: string, frequency: VisitFrequency, _dayOfWeek: number): Date {
  // Guard against empty/invalid date strings
  const parsed = lastVisitDate ? parseISO(lastVisitDate) : new Date();
  const last = isNaN(parsed.getTime()) ? new Date() : parsed;
  let candidate: Date;

  if (frequency === 'weekly') {
    candidate = addDays(last, 7);
  } else if (frequency === 'biweekly') {
    candidate = addDays(last, 14);
  } else {
    candidate = addDays(last, 30);
    const dow = getDay(candidate);
    // If Fri(5), Sat(6), Sun(0) — shift to nearest Mon or Thu
    if (dow === 5) candidate = addDays(candidate, 3); // Fri → Mon
    else if (dow === 6) candidate = addDays(candidate, 2); // Sat → Mon
    else if (dow === 0) candidate = addDays(candidate, 1); // Sun → Mon
  }

  return candidate;
}

export function isOverdue(nextVisit: Date): boolean {
  return differenceInDays(new Date(), nextVisit) > 0;
}

export function getDaysUntil(date: Date): number {
  return differenceInDays(date, new Date());
}

export function getDueDateLabel(nextVisit: Date): string {
  const days = getDaysUntil(nextVisit);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `IN ${days}D`;
}

export function getDueDateColor(nextVisit: Date): string {
  const days = getDaysUntil(nextVisit);
  if (days <= 0) return 'bg-red-100 text-red-600';
  if (days <= 2) return 'bg-amber-100 text-amber-600';
  return 'bg-blue-100 text-blue-600';
}
