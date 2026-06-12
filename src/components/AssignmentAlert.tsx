import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { safeFormat } from '../utils/scheduler';
import CustomerModal from './CustomerModal';
import type { Customer } from '../types';

// Banner shown at the top of a rep's dashboard when accounts have been
// newly assigned to them. Dismissing an item acknowledges it (GAS-backed).
export default function AssignmentAlert() {
  const { assignments, acknowledgeAssignment, directory, customers } = useCustomerStore();
  const [selected, setSelected] = useState<Customer | null>(null);

  const pending = assignments.filter(a => !a.acknowledged);
  if (pending.length === 0) return null;

  const openCustomer = (customerId: string, name: string) => {
    const pool = [...customers, ...directory];
    const found = pool.find(c => c.id === customerId || c.name.toLowerCase() === name.toLowerCase());
    if (found) setSelected(found);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden mb-1">
      <div className="px-4 py-2.5 bg-amber-100/60 flex items-center gap-2">
        <Bell size={14} className="text-amber-600" />
        <p className="text-xs font-black text-amber-700 uppercase tracking-wider">
          {pending.length} new account{pending.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>
      <div className="divide-y divide-amber-100">
        {pending.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => openCustomer(a.customerId, a.customerName)}
                className="text-sm font-bold text-amber-800 hover:underline text-left truncate block"
              >
                {a.customerName || a.customerId}
              </button>
              <p className="text-[10px] text-amber-600/80 truncate">
                Assigned by {a.assignedByName || 'admin'} · {safeFormat(a.date, 'MMM d')}
              </p>
            </div>
            <button
              onClick={() => acknowledgeAssignment(a.id)}
              className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              Got it
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      {selected && <CustomerModal customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
