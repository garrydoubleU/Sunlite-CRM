// Google Sheets mock data layer
// TODO: Replace with Acumatica API integration

export type PriorityTier = 1 | 2 | 3 | 4;
export type VisitFrequency = 'weekly' | 'biweekly' | 'monthly';
export type CustomerClass = 'hardware' | 'lumber' | 'building_supply' | 'industrial';
export type ActivityType = 'note' | 'call' | 'visit' | 'email';
export type ActivitySource = 'manual' | 'gmail-auto';
export type RepRole = 'admin' | 'field_sales' | 'inside_sales' | 'customer_service';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Customer {
  BusinessAccountID: string;
  name: string;
  assignedRep: string;
  territory: string;
  billingAddress: string;
  phone: string;
  email: string;
  priorityTier: PriorityTier;
  customerClass: CustomerClass;
  visitFrequency: VisitFrequency;
  lastContactDate: string; // ISO date string
  activeStatus: boolean;
  openOrderCount: number;
}

export interface Activity {
  id: string;
  customerId: string;
  type: ActivityType;
  date: string; // ISO date string
  repName: string;
  summary: string;
  source: ActivitySource;
}

export interface Route {
  customerId: string;
  frequency: VisitFrequency;
  lastVisitDate: string; // ISO date string
  nextVisitDate: string; // ISO date string
  dayOfWeek: DayOfWeek;
}

export interface SalesRep {
  id: string;
  name: string;
  role: RepRole;
  territory: string;
  email: string;
  avatarInitials: string;
}

// ─── Sales Reps ───────────────────────────────────────────────────────────────

export const mockReps: SalesRep[] = [
  { id: 'REP001', name: 'Marcus Webb', role: 'admin', territory: 'All', email: 'marcus.webb@sunlite.com', avatarInitials: 'MW' },
  { id: 'REP002', name: 'Sarah Delgado', role: 'field_sales', territory: 'North', email: 'sarah.delgado@sunlite.com', avatarInitials: 'SD' },
  { id: 'REP003', name: 'Tyler Frost', role: 'field_sales', territory: 'South', email: 'tyler.frost@sunlite.com', avatarInitials: 'TF' },
  { id: 'REP004', name: 'Dana Kim', role: 'inside_sales', territory: 'East', email: 'dana.kim@sunlite.com', avatarInitials: 'DK' },
  { id: 'REP005', name: 'Jordan Reeves', role: 'customer_service', territory: 'West', email: 'jordan.reeves@sunlite.com', avatarInitials: 'JR' },
];

// ─── Customers ────────────────────────────────────────────────────────────────

export const mockCustomers: Customer[] = [
  {
    BusinessAccountID: 'BU000001',
    name: 'Hartwell Hardware & Supply',
    assignedRep: 'Sarah Delgado',
    territory: 'North',
    billingAddress: '1402 Industrial Blvd, Springfield, IL 62701',
    phone: '(217) 555-0142',
    email: 'purchasing@hartwellhardware.com',
    priorityTier: 1,
    customerClass: 'hardware',
    visitFrequency: 'weekly',
    lastContactDate: '2026-06-02',
    activeStatus: true,
    openOrderCount: 4,
  },
  {
    BusinessAccountID: 'BU000002',
    name: 'Pinecrest Lumber Co.',
    assignedRep: 'Tyler Frost',
    territory: 'South',
    billingAddress: '889 Timber Rd, Memphis, TN 38101',
    phone: '(901) 555-0275',
    email: 'orders@pinecrestlumber.com',
    priorityTier: 1,
    customerClass: 'lumber',
    visitFrequency: 'weekly',
    lastContactDate: '2026-05-28',
    activeStatus: true,
    openOrderCount: 7,
  },
  {
    BusinessAccountID: 'BU000003',
    name: 'Ridgeline Building Supply',
    assignedRep: 'Sarah Delgado',
    territory: 'North',
    billingAddress: '3310 Commerce Dr, Rockford, IL 61101',
    phone: '(815) 555-0388',
    email: 'info@ridgelinebuild.com',
    priorityTier: 2,
    customerClass: 'building_supply',
    visitFrequency: 'biweekly',
    lastContactDate: '2026-05-15',
    activeStatus: true,
    openOrderCount: 2,
  },
  {
    BusinessAccountID: 'BU000004',
    name: 'Delta Industrial Products',
    assignedRep: 'Tyler Frost',
    territory: 'South',
    billingAddress: '227 Factory Lane, Nashville, TN 37201',
    phone: '(615) 555-0421',
    email: 'procurement@deltaind.com',
    priorityTier: 2,
    customerClass: 'industrial',
    visitFrequency: 'biweekly',
    lastContactDate: '2026-05-20',
    activeStatus: true,
    openOrderCount: 3,
  },
  {
    BusinessAccountID: 'BU000005',
    name: 'Cornerstone True Value',
    assignedRep: 'Dana Kim',
    territory: 'East',
    billingAddress: '74 Main St, Columbus, OH 43201',
    phone: '(614) 555-0537',
    email: 'store@cornerstonetruevalue.com',
    priorityTier: 2,
    customerClass: 'hardware',
    visitFrequency: 'monthly',
    lastContactDate: '2026-04-30',
    activeStatus: true,
    openOrderCount: 1,
  },
  {
    BusinessAccountID: 'BU000006',
    name: 'Maywood Millwork & Lumber',
    assignedRep: 'Sarah Delgado',
    territory: 'North',
    billingAddress: '556 Saw Mill Rd, Peoria, IL 61602',
    phone: '(309) 555-0661',
    email: 'orders@maywoodmill.com',
    priorityTier: 1,
    customerClass: 'lumber',
    visitFrequency: 'weekly',
    lastContactDate: '2026-06-06',
    activeStatus: true,
    openOrderCount: 5,
  },
  {
    BusinessAccountID: 'BU000007',
    name: 'SunCoast Hardware Depot',
    assignedRep: 'Jordan Reeves',
    territory: 'West',
    billingAddress: '1890 Coastal Hwy, Tampa, FL 33601',
    phone: '(813) 555-0784',
    email: 'depot@suncoasthardware.com',
    priorityTier: 3,
    customerClass: 'hardware',
    visitFrequency: 'monthly',
    lastContactDate: '2026-05-05',
    activeStatus: true,
    openOrderCount: 0,
  },
  {
    BusinessAccountID: 'BU000008',
    name: 'Blue Ridge Supply Group',
    assignedRep: 'Tyler Frost',
    territory: 'South',
    billingAddress: '432 Mountain View Rd, Asheville, NC 28801',
    phone: '(828) 555-0895',
    email: 'supply@blueridgegroup.com',
    priorityTier: 3,
    customerClass: 'building_supply',
    visitFrequency: 'biweekly',
    lastContactDate: '2026-05-10',
    activeStatus: true,
    openOrderCount: 2,
  },
  {
    BusinessAccountID: 'BU000009',
    name: 'Greenfield Industrial & Fasteners',
    assignedRep: 'Dana Kim',
    territory: 'East',
    billingAddress: '90 Commerce Park, Cincinnati, OH 45201',
    phone: '(513) 555-0912',
    email: 'parts@greenfieldindustrial.com',
    priorityTier: 4,
    customerClass: 'industrial',
    visitFrequency: 'monthly',
    lastContactDate: '2026-03-18',
    activeStatus: true,
    openOrderCount: 0,
  },
  {
    BusinessAccountID: 'BU000010',
    name: 'Summit Builders Supply',
    assignedRep: 'Sarah Delgado',
    territory: 'North',
    billingAddress: '2100 Builder Blvd, Aurora, IL 60505',
    phone: '(630) 555-1033',
    email: 'info@summitbuilders.com',
    priorityTier: 2,
    customerClass: 'building_supply',
    visitFrequency: 'biweekly',
    lastContactDate: '2026-05-27',
    activeStatus: true,
    openOrderCount: 3,
  },
  {
    BusinessAccountID: 'BU000011',
    name: 'Keystone Hardware Associates',
    assignedRep: 'Dana Kim',
    territory: 'East',
    billingAddress: '318 Penn Ave, Pittsburgh, PA 15201',
    phone: '(412) 555-1147',
    email: 'orders@keystonehardware.com',
    priorityTier: 1,
    customerClass: 'hardware',
    visitFrequency: 'weekly',
    lastContactDate: '2026-06-05',
    activeStatus: true,
    openOrderCount: 6,
  },
  {
    BusinessAccountID: 'BU000012',
    name: 'Lakeside Building Materials',
    assignedRep: 'Jordan Reeves',
    territory: 'West',
    billingAddress: '760 Lakeshore Dr, Milwaukee, WI 53201',
    phone: '(414) 555-1262',
    email: 'purchasing@lakesidebuilding.com',
    priorityTier: 3,
    customerClass: 'building_supply',
    visitFrequency: 'monthly',
    lastContactDate: '2026-04-12',
    activeStatus: false,
    openOrderCount: 0,
  },
  {
    BusinessAccountID: 'BU000013',
    name: 'Iron Horse Industrial Supply',
    assignedRep: 'Marcus Webb',
    territory: 'All',
    billingAddress: '1555 Industrial Pkwy, Detroit, MI 48201',
    phone: '(313) 555-1371',
    email: 'supply@ironhorseindustrial.com',
    priorityTier: 4,
    customerClass: 'industrial',
    visitFrequency: 'monthly',
    lastContactDate: '2026-02-28',
    activeStatus: true,
    openOrderCount: 1,
  },
];

// ─── Activities ───────────────────────────────────────────────────────────────

export const mockActivities: Activity[] = [
  // BU000001 - Hartwell Hardware
  { id: 'ACT001', customerId: 'BU000001', type: 'visit', date: '2026-06-02', repName: 'Sarah Delgado', summary: 'Quarterly review - discussed new fastener line, customer interested in bulk order.', source: 'manual' },
  { id: 'ACT002', customerId: 'BU000001', type: 'call', date: '2026-05-28', repName: 'Sarah Delgado', summary: 'Confirmed delivery date for PO #44821. Customer satisfied with service.', source: 'manual' },
  { id: 'ACT003', customerId: 'BU000001', type: 'email', date: '2026-05-25', repName: 'Sarah Delgado', summary: 'Sent Q3 product catalog and pricing sheet. Awaiting feedback.', source: 'gmail-auto' },
  { id: 'ACT004', customerId: 'BU000001', type: 'note', date: '2026-05-20', repName: 'Marcus Webb', summary: 'Flagged as high-value account. Increase visit cadence to weekly.', source: 'manual' },
  { id: 'ACT005', customerId: 'BU000001', type: 'visit', date: '2026-05-15', repName: 'Sarah Delgado', summary: 'Introduced new adhesive products. Left samples for evaluation.', source: 'manual' },

  // BU000002 - Pinecrest Lumber
  { id: 'ACT006', customerId: 'BU000002', type: 'visit', date: '2026-05-28', repName: 'Tyler Frost', summary: 'Met with purchasing manager. Discussed lumber pricing for Q3. Strong pipeline.', source: 'manual' },
  { id: 'ACT007', customerId: 'BU000002', type: 'email', date: '2026-05-22', repName: 'Tyler Frost', summary: 'Customer inquired about cedar availability. Replied with current inventory levels.', source: 'gmail-auto' },
  { id: 'ACT008', customerId: 'BU000002', type: 'call', date: '2026-05-18', repName: 'Tyler Frost', summary: 'Resolved shipping delay issue for order #50221. Customer appreciated quick follow-up.', source: 'manual' },

  // BU000003 - Ridgeline Building
  { id: 'ACT009', customerId: 'BU000003', type: 'visit', date: '2026-05-15', repName: 'Sarah Delgado', summary: 'Presented new roofing supplies line. Moderate interest - follow up in 2 weeks.', source: 'manual' },
  { id: 'ACT010', customerId: 'BU000003', type: 'note', date: '2026-05-10', repName: 'Sarah Delgado', summary: 'Customer mentioned budget constraints for Q2. May reduce order volume.', source: 'manual' },

  // BU000004 - Delta Industrial
  { id: 'ACT011', customerId: 'BU000004', type: 'call', date: '2026-05-20', repName: 'Tyler Frost', summary: 'Checked in on recent delivery. No issues. Customer mentioned potential expansion.', source: 'manual' },
  { id: 'ACT012', customerId: 'BU000004', type: 'email', date: '2026-05-14', repName: 'Tyler Frost', summary: 'Sent industrial tool catalog for summer season. Customer replied with interest.', source: 'gmail-auto' },

  // BU000005 - Cornerstone True Value
  { id: 'ACT013', customerId: 'BU000005', type: 'visit', date: '2026-04-30', repName: 'Dana Kim', summary: 'Monthly visit. Reviewed seasonal inventory needs. Placed standard restock order.', source: 'manual' },
  { id: 'ACT014', customerId: 'BU000005', type: 'call', date: '2026-04-15', repName: 'Dana Kim', summary: 'Reminder call about upcoming promotions. Customer engaged and interested.', source: 'manual' },

  // BU000006 - Maywood Millwork
  { id: 'ACT015', customerId: 'BU000006', type: 'visit', date: '2026-06-06', repName: 'Sarah Delgado', summary: 'Delivered new product samples. Customer very interested in hardwood flooring line.', source: 'manual' },
  { id: 'ACT016', customerId: 'BU000006', type: 'email', date: '2026-06-02', repName: 'Sarah Delgado', summary: 'Confirmed PO #55193 shipment tracking. Expected arrival June 7.', source: 'gmail-auto' },
  { id: 'ACT017', customerId: 'BU000006', type: 'call', date: '2026-05-30', repName: 'Sarah Delgado', summary: 'Discussed Q3 planning. Customer expects 15% volume increase in lumber.', source: 'manual' },

  // BU000007 - SunCoast Hardware
  { id: 'ACT018', customerId: 'BU000007', type: 'visit', date: '2026-05-05', repName: 'Jordan Reeves', summary: 'Monthly visit. Account seems inactive — no new orders in 30 days.', source: 'manual' },

  // BU000008 - Blue Ridge Supply
  { id: 'ACT019', customerId: 'BU000008', type: 'call', date: '2026-05-10', repName: 'Tyler Frost', summary: 'Follow-up on outstanding quote. Customer comparing with competitor pricing.', source: 'manual' },
  { id: 'ACT020', customerId: 'BU000008', type: 'email', date: '2026-05-05', repName: 'Tyler Frost', summary: 'Sent competitive pricing proposal for drywall and insulation products.', source: 'gmail-auto' },

  // BU000009 - Greenfield Industrial
  { id: 'ACT021', customerId: 'BU000009', type: 'visit', date: '2026-03-18', repName: 'Dana Kim', summary: 'Initial visit after account reactivation. Customer lukewarm — needs nurturing.', source: 'manual' },

  // BU000010 - Summit Builders
  { id: 'ACT022', customerId: 'BU000010', type: 'visit', date: '2026-05-27', repName: 'Sarah Delgado', summary: 'Discussed spring building season needs. Strong pipeline for lumber and concrete.', source: 'manual' },
  { id: 'ACT023', customerId: 'BU000010', type: 'call', date: '2026-05-20', repName: 'Sarah Delgado', summary: 'Confirmed biweekly visit schedule. Customer prefers Tuesday mornings.', source: 'manual' },

  // BU000011 - Keystone Hardware
  { id: 'ACT024', customerId: 'BU000011', type: 'visit', date: '2026-06-05', repName: 'Dana Kim', summary: 'Excellent meeting — confirmed 3 new product lines for shelf placement.', source: 'manual' },
  { id: 'ACT025', customerId: 'BU000011', type: 'email', date: '2026-06-01', repName: 'Dana Kim', summary: 'Sent updated price sheet. Customer confirmed will renew annual agreement.', source: 'gmail-auto' },
  { id: 'ACT026', customerId: 'BU000011', type: 'call', date: '2026-05-28', repName: 'Dana Kim', summary: 'Resolved billing discrepancy on invoice #38001. Customer satisfied with resolution.', source: 'manual' },

  // BU000012 - Lakeside Building (inactive)
  { id: 'ACT027', customerId: 'BU000012', type: 'note', date: '2026-04-12', repName: 'Jordan Reeves', summary: 'Account marked inactive pending credit review. Do not process new orders.', source: 'manual' },

  // BU000013 - Iron Horse Industrial
  { id: 'ACT028', customerId: 'BU000013', type: 'visit', date: '2026-02-28', repName: 'Marcus Webb', summary: 'Annual account review. Discussed expansion into new product categories.', source: 'manual' },
];

// ─── Routes ───────────────────────────────────────────────────────────────────

export const mockRoutes: Route[] = [
  { customerId: 'BU000001', frequency: 'weekly', lastVisitDate: '2026-06-02', nextVisitDate: '2026-06-09', dayOfWeek: 1 },
  { customerId: 'BU000002', frequency: 'weekly', lastVisitDate: '2026-05-28', nextVisitDate: '2026-06-04', dayOfWeek: 4 },
  { customerId: 'BU000003', frequency: 'biweekly', lastVisitDate: '2026-05-15', nextVisitDate: '2026-06-09', dayOfWeek: 1 },
  { customerId: 'BU000004', frequency: 'biweekly', lastVisitDate: '2026-05-20', nextVisitDate: '2026-06-10', dayOfWeek: 2 },
  { customerId: 'BU000005', frequency: 'monthly', lastVisitDate: '2026-04-30', nextVisitDate: '2026-06-02', dayOfWeek: 2 },
  { customerId: 'BU000006', frequency: 'weekly', lastVisitDate: '2026-06-06', nextVisitDate: '2026-06-13', dayOfWeek: 6 },
  { customerId: 'BU000007', frequency: 'monthly', lastVisitDate: '2026-05-05', nextVisitDate: '2026-06-05', dayOfWeek: 5 },
  { customerId: 'BU000008', frequency: 'biweekly', lastVisitDate: '2026-05-10', nextVisitDate: '2026-06-09', dayOfWeek: 1 },
  { customerId: 'BU000009', frequency: 'monthly', lastVisitDate: '2026-03-18', nextVisitDate: '2026-06-16', dayOfWeek: 2 },
  { customerId: 'BU000010', frequency: 'biweekly', lastVisitDate: '2026-05-27', nextVisitDate: '2026-06-10', dayOfWeek: 3 },
  { customerId: 'BU000011', frequency: 'weekly', lastVisitDate: '2026-06-05', nextVisitDate: '2026-06-12', dayOfWeek: 5 },
  { customerId: 'BU000012', frequency: 'monthly', lastVisitDate: '2026-04-12', nextVisitDate: '2026-06-15', dayOfWeek: 1 },
  { customerId: 'BU000013', frequency: 'monthly', lastVisitDate: '2026-02-28', nextVisitDate: '2026-06-02', dayOfWeek: 6 },
];

// ─── Async fetch stubs (for Acumatica replacement) ───────────────────────────

export async function fetchCustomers(): Promise<Customer[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockCustomers), 300));
}

export async function fetchActivities(): Promise<Activity[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockActivities), 200));
}

export async function fetchRoutes(): Promise<Route[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockRoutes), 200));
}

export async function fetchReps(): Promise<SalesRep[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockReps), 100));
}
