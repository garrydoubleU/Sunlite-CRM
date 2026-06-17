import type { Customer } from '../types';
import { canViewRevenue } from '../utils/roleGate';
import { useAuthStore } from '../store/authStore';
import { useCustomerStore } from '../store/customerStore';
import { safeFormat, safeDaysSince } from '../utils/scheduler';

interface CustomerCardProps {
  customer: Customer;
  onOpenModal?: () => void;
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-600',
  2: 'bg-amber-100 text-amber-600',
  3: 'bg-blue-100 text-blue-600',
  4: 'bg-gray-100 text-gray-500',
};

const FREQ_COLORS: Record<string, string> = {
  weekly: 'bg-blue-100 text-blue-600',
  biweekly: 'bg-purple-100 text-purple-600',
  monthly: 'bg-green-100 text-green-600',
};

export default function CustomerCard({ customer, onOpenModal }: CustomerCardProps) {
  const { currentUser } = useAuthStore();
  const { activities } = useCustomerStore();
  const showRevenue = canViewRevenue(currentUser?.role ?? 'field_sales');
  const isOwner = currentUser?.role === 'owner';

  // Derive effective last contact: most recent activity beats the GAS field (which may be stale)
  const customerName = customer.name.toLowerCase();
  const latestActivity = activities
    .filter(a => a.customerId === customer.id || a.customerId.toLowerCase() === customerName)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const effectiveLastContact = latestActivity
    ? (latestActivity.date > (customer.lastContactDate ?? '') ? latestActivity.date : customer.lastContactDate)
    : customer.lastContactDate;

  const daysSinceContact = safeDaysSince(effectiveLastContact);
  const isRecentlyContacted = daysSinceContact <= 30;
  const isUntouched = !isOwner && daysSinceContact >= 30;

  return (
    <div
      onClick={onOpenModal}
      className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
        isUntouched ? 'border-red-200' : isRecentlyContacted ? 'border-green-300' : 'border-gray-100'
      } ${onOpenModal ? 'cursor-pointer hover:shadow-md hover:border-amber-300' : ''}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm">{customer.name}</h3>
              {isUntouched && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wide">Untouched</span>
              )}
              {!isUntouched && isRecentlyContacted && (
                <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wide">✓ Contacted</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-gray-400 font-mono">{customer.id}</p>
              {customer.customerClass && (
                <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{customer.customerClass}</span>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${TIER_COLORS[customer.priorityTier]}`}>
            Tier {customer.priorityTier}
          </span>
        </div>

        {/* Rep & territory */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-[10px] font-bold">
            {(customer.assignedRepName || 'U').split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700">{customer.assignedRepName || 'Unassigned'}</p>
            <p className="text-[10px] text-gray-400">{customer.territory}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {customer.visitFrequency && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${FREQ_COLORS[customer.visitFrequency] ?? 'bg-gray-100 text-gray-500'}`}>
              {customer.visitFrequency}
            </span>
          )}
          {customer.customerClass && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{customer.customerClass}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs font-bold text-gray-800">{customer.openOrderCount}</p>
            <p className="text-[10px] text-gray-400">Orders</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className={`text-xs font-bold ${daysSinceContact > 14 ? 'text-red-500' : 'text-gray-800'}`}>{daysSinceContact}d</p>
            <p className="text-[10px] text-gray-400">Since Contact</p>
          </div>
          {showRevenue ? (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs font-bold text-gray-800">${(customer.revenue / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-gray-400">Revenue</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs font-bold text-gray-800">{safeFormat(effectiveLastContact, 'MMM d')}</p>
              <p className="text-[10px] text-gray-400">Last Contact</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
