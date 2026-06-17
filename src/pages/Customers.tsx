import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import CustomerCard from '../components/CustomerCard';
import CustomerModal from '../components/CustomerModal';
import type { Customer, VisitFrequency } from '../types';

type BookFilter = 'mine' | 'all' | 'pending';
type TierFilter = 'all' | '1' | '2' | '3' | '4';
type FreqFilter = 'all' | VisitFrequency;

export default function Customers() {
  const { customers, directory, accessRequests, lastSync, isSyncing } = useCustomerStore();
  const { currentUser } = useAuthStore();

  const role     = currentUser?.role ?? 'field_sales';
  const myEmail  = currentUser?.email?.toLowerCase() ?? '';
  const isRep    = role === 'field_sales' || role === 'inside_sales';
  const canRepFilter = role === 'customer_service' || role === 'owner' || role === 'admin';

  const [bookFilter, setBookFilter] = useState<BookFilter>('mine');
  const [search,     setSearch]     = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [freqFilter, setFreqFilter] = useState<FreqFilter>('all');
  const [repFilter,  setRepFilter]  = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  function clearFilters() {
    setSearch('');
    setTierFilter('all');
    setFreqFilter('all');
    setRepFilter('all');
  }

  // ── Show spinner while first GAS load is in progress ──────────
  if (lastSync === null && isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading accounts…</p>
      </div>
    );
  }

  // directory = full company list; customers = rep's own book (both derived from
  // the same background fetch so they're always consistent after GAS loads).
  const fullDir = directory.length > 0 ? directory : customers;

  // Pending IDs for this rep
  const pendingIds = new Set(
    accessRequests
      .filter(r => r.status === 'pending' && r.requesterEmail === myEmail)
      .map(r => r.customerId)
  );

  // Pick base by tab
  let base: Customer[];
  if (isRep && bookFilter === 'mine') {
    base = customers;
  } else if (isRep && bookFilter === 'pending') {
    base = fullDir.filter(c => pendingIds.has(c.id));
  } else {
    base = fullDir;
  }

  // Apply all filters in one pass
  const q = search.toLowerCase().trim();
  const filtered = base.filter(c => {
    if (q) {
      if (
        !c.name.toLowerCase().includes(q) &&
        !c.id.toLowerCase().includes(q) &&
        !c.territory.toLowerCase().includes(q)
      ) return false;
    }
    if (tierFilter !== 'all' && c.priorityTier !== parseInt(tierFilter)) return false;
    if (freqFilter !== 'all' && c.visitFrequency !== freqFilter) return false;
    if (repFilter !== 'all' && c.assignedRepName !== repFilter) return false;
    return true;
  });

  // Unique rep names for dropdown
  const repNames: string[] = [];
  if (canRepFilter) {
    const seen = new Set<string>();
    fullDir.forEach(c => {
      if (c.assignedRepName && !seen.has(c.assignedRepName)) {
        seen.add(c.assignedRepName);
        repNames.push(c.assignedRepName);
      }
    });
    repNames.sort();
  }

  const hasFilters = !!(search || tierFilter !== 'all' || freqFilter !== 'all' || repFilter !== 'all');
  const pendingCount = pendingIds.size;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>

      {/* Book tabs — reps only */}
      {isRep && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {([
            { id: 'mine'    as BookFilter, label: 'My Customers',  count: 0 },
            { id: 'all'     as BookFilter, label: 'All Customers', count: 0 },
            { id: 'pending' as BookFilter, label: 'Pending',       count: pendingCount },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setBookFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                bookFilter === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-amber-400 transition-colors">
            <Search size={15} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, or territory..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Tier:</span>
          {(['all', '1', '2', '3', '4'] as TierFilter[]).map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                tierFilter === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t === 'all' ? 'All' : `Tier ${t}`}
            </button>
          ))}

          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide ml-2">Frequency:</span>
          {(['all', 'weekly', 'biweekly', 'monthly'] as FreqFilter[]).map(f => (
            <button key={f} onClick={() => setFreqFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors capitalize ${
                freqFilter === f ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}

          {canRepFilter && repNames.length > 0 && (
            <>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide ml-2">Rep:</span>
              <select
                value={repFilter}
                onChange={e => setRepFilter(e.target.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full appearance-none cursor-pointer transition-colors ${
                  repFilter !== 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <option value="all">All Reps</option>
                {repNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Count — derived from the exact same array as the grid */}
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
        {filtered.length} account{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Grid — uses same `filtered` array, no indirection */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          {isRep && bookFilter === 'pending' ? (
            <p className="text-gray-400 text-sm">No pending access requests.</p>
          ) : (
            <>
              <p className="text-gray-400 text-sm">No accounts match your filters.</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-amber-500 text-sm font-medium hover:underline">
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <CustomerCard
              key={c.id || `row-${i}`}
              customer={c}
              onOpenModal={() => setSelectedCustomer(c)}
            />
          ))}
        </div>
      )}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
