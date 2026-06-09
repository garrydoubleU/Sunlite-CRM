import type { Role, Customer } from '../types';

export function stripRevenueFromContext(customers: Customer[], role: Role): Omit<Customer, 'revenue'>[] {
  if (role === 'admin') return customers;
  return customers.map(({ revenue: _revenue, ...rest }) => rest);
}

export function canViewRevenue(role: Role): boolean {
  return role === 'admin';
}

export function canManageTerritory(role: Role): boolean {
  return role === 'admin';
}

export function canViewAllCustomers(role: Role): boolean {
  return role === 'admin' || role === 'customer_service';
}
