import { addDays, getDay, parseISO, differenceInDays } from 'date-fns';
import type { VisitFrequency } from '../types';

export function calculateNextVisit(lastVisitDate: string, frequency: VisitFrequency, _dayOfWeek: number): Date {
  const last = parseISO(lastVisitDate);
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
