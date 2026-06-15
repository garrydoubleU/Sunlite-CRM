import { Clock, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useCustomerStore } from '../store/customerStore';
import { calculateNextVisit, isOverdue, getDaysUntil, getDueDateLabel, getDueDateColor } from '../utils/scheduler';
import type { Customer } from '../types';

interface RoutePlannerProps {
  onOpenModal?: (customer: Customer) => void;
}

export default function RoutePlanner({ onOpenModal }: RoutePlannerProps) {
  const { customers } = useCustomerStore();

  // Build route entries
  const routeEntries = customers
    .filter(c => c.activeStatus)
    .map(c => {
      const nextVisit = calculateNextVisit(c.lastContactDate, c.visitFrequency, c.dayOfWeek);
      const overdue = isOverdue(nextVisit);
      const daysUntil = getDaysUntil(nextVisit);
      return { customer: c, nextVisit, overdue, daysUntil };
    })
    .sort((a, b) => a.nextVisit.getTime() - b.nextVisit.getTime());

  const overdueCount = routeEntries.filter(r => r.overdue).length;
  const thisWeek = routeEntries.filter(r => !r.overdue && r.daysUntil <= 7);

  const freqCounts = {
    weekly: customers.filter(c => c.visitFrequency === 'weekly').length,
    biweekly: customers.filter(c => c.visitFrequency === 'biweekly').length,
    monthly: customers.filter(c => c.visitFrequency === 'monthly').length,
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Field Visitation Schedule</h2>
            <p className="text-xs text-gray-400">Routing & Routines</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full uppercase tracking-wide">
          Active Routines: {customers.filter(c => c.activeStatus).length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: upcoming accounts */}
        <div className="lg:col-span-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Upcoming Routed Accounts</p>
          {overdueCount > 0 && (
            <div className="mb-3 flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold">
              <AlertTriangle size={14} />
              {overdueCount} overdue visit{overdueCount > 1 ? 's' : ''} — action required
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {routeEntries.slice(0, 12).map(({ customer: c, nextVisit, overdue }) => (
              <div
                key={c.id}
                onClick={() => onOpenModal?.(c)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${onOpenModal ? 'cursor-pointer' : ''} ${
                  overdue ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-gray-50 border-gray-100 hover:bg-amber-50 hover:border-amber-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  overdue ? 'bg-red-100' : 'bg-white'
                }`}>
                  {overdue
                    ? <AlertTriangle size={14} className="text-red-500" />
                    : <CheckCircle size={14} className="text-green-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-800">{c.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                      c.visitFrequency === 'weekly' ? 'bg-blue-100 text-blue-600' :
                      c.visitFrequency === 'biweekly' ? 'bg-purple-100 text-purple-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {c.visitFrequency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-[10px] text-gray-500">
                      Next: {format(nextVisit, 'EEE, MMM d')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{c.id}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${getDueDateColor(nextVisit)}`}>
                  {getDueDateLabel(nextVisit)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: coverage summary */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Schedule Coverage</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">Weekly</p>
                <p className="text-[10px] text-gray-400">Every 7 days</p>
              </div>
              <span className="text-sm font-black text-blue-600">{freqCounts.weekly}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">Bi-Weekly</p>
                <p className="text-[10px] text-gray-400">Every 14 days</p>
              </div>
              <span className="text-sm font-black text-purple-600">{freqCounts.biweekly}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">Monthly</p>
                <p className="text-[10px] text-gray-400">Every 30 days</p>
              </div>
              <span className="text-sm font-black text-green-600">{freqCounts.monthly}</span>
            </div>
          </div>

          {/* This week */}
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">This Week</p>
            <p className="text-2xl font-black text-amber-600">{thisWeek.length}</p>
            <p className="text-[10px] text-amber-600">scheduled visits</p>
          </div>
          <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Overdue</p>
            <p className="text-2xl font-black text-red-600">{overdueCount}</p>
            <p className="text-[10px] text-red-600">past due visits</p>
          </div>
        </div>
      </div>
    </div>
  );
}
