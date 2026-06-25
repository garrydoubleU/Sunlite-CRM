import { useState, useMemo } from 'react';
import { Phone, MapPin, FileText, Mail } from 'lucide-react';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import CustomerModal from '../components/CustomerModal';
import type { ActivityType, Customer } from '../types';

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string; label: string }> = {
  call: { icon: Phone, color: 'bg-blue-100 text-blue-600', label: 'Call' },
  visit: { icon: MapPin, color: 'bg-green-100 text-green-600', label: 'Visit' },
  note: { icon: FileText, color: 'bg-gray-100 text-gray-600', label: 'Note' },
  email: { icon: Mail, color: 'bg-red-100 text-red-500', label: 'Email' },
};

function getDateGroup(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return 'This Week';
  return format(d, 'MMMM yyyy');
}

export default function ActivityFeed() {
  const { activities, customers } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const seesAll = role === 'admin' || role === 'owner';
  const myName = currentUser?.name ?? '';

  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'gmail-auto'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const sorted = useMemo(() => {
    return [...activities]
      .filter(a => {
        if (!seesAll && a.repName !== myName) return false;
        if (typeFilter !== 'all' && a.type !== typeFilter) return false;
        if (sourceFilter !== 'all' && (a.source ?? 'manual') !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, typeFilter, sourceFilter]);

  // Group by date label
  const grouped = useMemo(() => {
    const groups: Record<string, typeof sorted> = {};
    const order: string[] = [];
    for (const act of sorted) {
      const g = getDateGroup(act.date);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(act);
    }
    return { groups, order };
  }, [sorted]);

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center">Type:</span>
          {(['all', 'visit', 'call', 'note', 'email'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors capitalize ${
                typeFilter === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center ml-3">Source:</span>
          {(['all', 'manual', 'gmail-auto'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                sourceFilter === s ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All Sources' : s === 'gmail-auto' ? 'Gmail Auto' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{sorted.length} activities</p>

      {/* Timeline */}
      <div className="space-y-6">
        {grouped.order.map(group => (
          <div key={group}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-3">
              {grouped.groups[group].map(act => {
                const customer = customers.find(c =>
                  c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
                );
                const { icon: Icon, color, label } = TYPE_CONFIG[act.type];
                return (
                  <div key={act.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-4 hover:border-amber-200 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {customer ? (
                          <button onClick={() => setSelectedCustomer(customer)} className="font-bold text-sm text-gray-800 hover:text-amber-500 transition-colors text-left">
                            {customer.name}
                          </button>
                        ) : (
                          <span className="font-bold text-sm text-gray-800">{act.customerId}</span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${color}`}>{label}</span>
                        {act.source === 'gmail-auto' && (
                          <span className="text-[9px] font-bold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Gmail Auto</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{act.summary}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {act.repName && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 pl-1 pr-2.5 py-0.5 rounded-full">
                            <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-[8px] font-bold">
                              {act.repName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                            {act.repName}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{format(parseISO(act.date), 'MMM d, yyyy')}</span>
                        {customer && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400 font-mono">{customer.id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No activities match your filters.</p>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
