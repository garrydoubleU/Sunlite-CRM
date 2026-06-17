import { useState, useMemo, useDeferredValue } from 'react';
import { Search, X } from 'lucide-react';
import { useCustomerStore, ownsAccount } from '../store/customerStore';
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
  const isRep = role === 'field_sales' || role === 'inside_sales';

  const [bookFilter, setBookFilter] = useState<BookFilter>('mine');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [freqFilter, setFreqFilter] = useState<FreqFilter>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const deferredSearch = useDeferredValue(search);

  const source = directory.length > 0 ? directory : customers;

  // Customers the rep has a pending access request for
  const pendingIds = useMemo(() =>
    new Set(accessRequests.filter(r => r.status === 'pending' && r.requesterEmail === myEmail).map(r => r.customerId)),
    [accessRequests, myEmail]
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();

    let base: Customer[];
    if (isRep && bookFilter === 'mine') {
      base = source.filter(c => ownsAccount(c, myEmail));
    } else if (isRep && bookFilter === 'pending') {
      base = source.filter(c => pendingIds.has(c.id));
    } else {
      base = source;
    }

    const results = base.filter(c => {
      if (q && !c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q) && !c.territory.toLowerCase().includes(q)) return false;
      if (tierFilter !== 'all' && c.priorityTier !== parseInt(tierFilter)) return false;
      if (freqFilter !== 'all' && c.visitFrequency !== freqFilter) return false;
      return true;
    });

    if (q) {
      results.sort((a, b) => {
        const aExact = a.id.toLowerCase() === q || a.name.toLowerCase() === q ? 0 : 1;
        const bExact = b.id.toLowerCase() === q || b.name.toLowerCase() === q ? 0 : 1;
        return aExact - bExact;
      });
    }
    return results;
  }, [source, deferredSearch, bookFilter, tierFilter, freqFilter, isRep, myEmail, pendingIds]);

  const isStale = search !== deferredSearch;

  function clearFilters() {
    setSearch('');
    setTierFilter('all');
    setFreqFilter('all');
  }

  const hasFilters = search || tierFilter !== 'all' || freqFilter !== 'all';

  return (
    <div>
      {/* Book filter tabs — reps only */}
      {isRep && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {([
            { id: 'mine' as BookFilter, label: 'My Customers' },
            { id: 'all' as BookFilter, label: 'All Customers' },
            { id: 'pending' as BookFilter, label: 'Pending', count: pendingIds.size },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setBookFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                bookFilter === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center">Tier:</span>
          {(['all', '1', '2', '3', '4'] as TierFilter[]).map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${tierFilter === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'all' ? 'All' : `Tier ${t}`}
            </button>
          ))}
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center ml-2">Frequency:</span>
          {(['all', 'weekly', 'biweekly', 'monthly'] as FreqFilter[]).map(f => (
            <button key={f} onClick={() => setFreqFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors capitalize ${freqFilter === f ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {!isStale && `${filtered.length} account${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Customer grid */}
      {!isStale && filtered.length === 0 ? (
        <div className="text-center py-16">
          {bookFilter === 'pending' ? (
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
          {!isStale && filtered.map(c => (
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
