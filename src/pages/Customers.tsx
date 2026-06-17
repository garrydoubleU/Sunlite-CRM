import { useState, useMemo } from 'react';
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
  const { customers, directory, accessRequests } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const myEmail = currentUser?.email ?? '';

  // Who can do what
  const isRep = role === 'field_sales' || role === 'inside_sales';
  const isCS  = role === 'customer_service';
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const canFilterByRep = isCS || isOwnerOrAdmin;

  // For owner/admin/CS: customers already contains everyone (seesAll=true in store).
  // For reps: customers = their own book; directory = full company (async).
  // Pick the right base once and never switch mid-render.
  const allAccounts = isRep ? (directory.length > 0 ? directory : customers) : customers;

  const [bookFilter, setBookFilter]   = useState<BookFilter>('mine');
  const [search, setSearch]           = useState('');
  const [tierFilter, setTierFilter]   = useState<TierFilter>('all');
  const [freqFilter, setFreqFilter]   = useState<FreqFilter>('all');
  const [repFilter, setRepFilter]     = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Rep names list — only meaningful for CS/owner
  const repNames = useMemo(() => {
    if (!canFilterByRep) return [];
    const names = new Set<string>();
    allAccounts.forEach(c => { if (c.assignedRepName) names.add(c.assignedRepName); });
    return Array.from(names).sort();
  }, [allAccounts, canFilterByRep]);

  // Pending requests this rep submitted
  const pendingIds = useMemo(() =>
    new Set(
      accessRequests
        .filter(r => r.status === 'pending' && r.requesterEmail === myEmail)
        .map(r => r.customerId)
    ),
    [accessRequests, myEmail]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    // 1. Pick the base set from the book-level tab (reps only)
    let base: Customer[];
    if (isRep && bookFilter === 'mine') {
      base = customers;
    } else if (isRep && bookFilter === 'pending') {
      base = allAccounts.filter(c => pendingIds.has(c.id));
    } else {
      base = allAccounts; // "all" for reps, or everything for CS/owner/admin
    }

    // 2. Apply filters
    return base.filter(c => {
      if (q) {
        const matchesText =
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.territory.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (tierFilter !== 'all' && c.priorityTier !== parseInt(tierFilter)) return false;
      if (freqFilter !== 'all' && c.visitFrequency !== freqFilter) return false;
      if (repFilter !== 'all' && c.assignedRepName !== repFilter) return false;
      return true;
    });
  }, [allAccounts, customers, search, bookFilter, tierFilter, freqFilter, repFilter, isRep, pendingIds]);

  function clearFilters() {
    setSearch('');
    setTierFilter('all');
    setFreqFilter('all');
    setRepFilter('all');
  }

  const hasFilters = !!(search || tierFilter !== 'all' || freqFilter !== 'all' || repFilter !== 'all');

  return (
    <div>
      {/* Book tabs — reps only */}
      {isRep && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {([
            { id: 'mine'    as BookFilter, label: 'My Customers' },
            { id: 'all'     as BookFilter, label: 'All Customers' },
            { id: 'pending' as BookFilter, label: 'Pending', count: pendingIds.size },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setBookFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                bookFilter === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        {/* Search row */}
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

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Tier:</span>
          {(['all', '1', '2', '3', '4'] as TierFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                tierFilter === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? 'All' : `Tier ${t}`}
            </button>
          ))}

          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide ml-2">Frequency:</span>
          {(['all', 'weekly', 'biweekly', 'monthly'] as FreqFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFreqFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors capitalize ${
                freqFilter === f ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}

          {canFilterByRep && repNames.length > 0 && (
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
                {repNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
        {filtered.length} account{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
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
          {filtered.map(c => (
            <CustomerCard key={c.id} customer={c} onOpenModal={() => setSelectedCustomer(c)} />
          ))}
        </div>
      )}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
