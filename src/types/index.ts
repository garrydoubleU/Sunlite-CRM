export type Role = 'admin' | 'field_sales' | 'inside_sales' | 'customer_service' | 'owner';

export interface Contact {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  phone?: string;
  ext?: string;
}
export type VisitFrequency = 'weekly' | 'biweekly' | 'monthly' | '';
export type ActivityType = 'note' | 'call' | 'visit' | 'email';
export type PriorityTier = 1 | 2 | 3 | 4;

export interface SalesRep {
  id: string;
  name: string;
  role: Role;
  territory: string;
  email: string;
  avatarInitials: string;
}

export interface Customer {
  id: string;
  name: string;
  assignedRepId: string;
  assignedRepName: string;
  territory: string;
  billingAddress: string;
  phone: string;
  email: string;
  priorityTier: PriorityTier;
  customerClass: string;
  visitFrequency: VisitFrequency;
  lastContactDate: string;
  activeStatus: boolean;
  openOrderCount: number;
  revenue: number;
  revenueByQuarter: Record<string, number>; // e.g. { Q1_2024: 1200, Q2_2024: 800 }
  dayOfWeek: number;
}

export interface Activity {
  id: string;
  customerId: string;
  type: ActivityType;
  date: string;
  repName: string;
  summary: string;
  source?: 'manual' | 'gmail-auto';
  followUpDate?: string;
  notifyRep?: boolean;
}

export interface CSHandoff {
  id: string;
  customerId: string;
  customerName: string;
  repEmail: string;
  csName: string;
  csEmail?: string;
  date: string;
  notes: string;
  acknowledged: boolean;
  ackNotes?: string;
  activityType?: string;
}

export interface Assignment {
  id: string;
  customerId: string;
  customerName: string;
  assignedToEmail: string;
  assignedToName: string;
  assignedByEmail: string;
  assignedByName: string;
  date: string;
  acknowledged: boolean;
}

export interface AccessRequest {
  id: string;
  customerId: string;
  customerName: string;
  requesterEmail: string;
  requesterName: string;
  date: string;
  status: 'pending' | 'granted' | 'denied';
}

export interface Route {
  customerId: string;
  frequency: VisitFrequency;
  lastVisitDate: string;
  dayOfWeek: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'overdue_visit' | 'new_email' | 'teammate_note' | 'route_change';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  customerId?: string;
}
