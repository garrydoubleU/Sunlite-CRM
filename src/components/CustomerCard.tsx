import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Mail, Package, Calendar } from 'lucide-react';
import type { Customer } from '../types';
import ActivityTimeline from './ActivityTimeline';
import { canViewRevenue } from '../utils/roleGate';
import { useAuthStore } from '../store/authStore';
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
  const [expanded, setExpanded] = useState(false);
  const { currentUser } = useAuthStore();
  const showRevenue = canViewRevenue(currentUser?.role ?? 'field_sales');

  const daysSinceContact = safeDaysSince(customer.lastContactDate);
  const isUntouched = daysSinceContact >= 30;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
      isUntouched ? 'border-red-200' : 'border-gray-100'
    } ${expanded ? 'ring-1 ring-amber-400' : ''}`}>
      {/* Tappable card body — expands inline detail */}
      <div className="p-4 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setExpanded(!expanded)}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm">{customer.name}</h3>
              {isUntouched && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wide">Untouched</span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{customer.id}</p>
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
              <p className="text-xs font-bold text-gray-800">{safeFormat(customer.lastContactDate, 'MMM d')}</p>
              <p className="text-[10px] text-gray-400">Last Contact</p>
            </div>
          )}
        </div>

        {/* Expand hint */}
        <div className="flex items-center justify-between mt-2">
          {onOpenModal && (
            <button
              onClick={e => { e.stopPropagation(); onOpenModal(); }}
              className="text-[10px] font-bold text-amber-600 hover:underline"
            >
              Open Record →
            </button>
          )}
          <span className="ml-auto text-[10px] text-gray-300 flex items-center gap-0.5">
            {expanded ? <><ChevronUp size={11} /> less</> : <><ChevronDown size={11} /> more</>}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin size={12} className="text-gray-400" />
              {customer.billingAddress}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone size={12} className="text-gray-400" />
              {customer.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Mail size={12} className="text-gray-400" />
              {customer.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Package size={12} className="text-gray-400" />
              {customer.openOrderCount} open orders
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Calendar size={12} className="text-gray-400" />
              Last contact: {safeFormat(customer.lastContactDate, 'MMMM d, yyyy')}
            </div>
          </div>
          <ActivityTimeline customerId={customer.id} />
        </div>
      )}
    </div>
  );
}
