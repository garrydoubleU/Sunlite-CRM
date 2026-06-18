import { useState, useMemo } from 'react';
import { Search, X, Phone } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import CustomerCard from '../components/CustomerCard';
import CustomerModal from '../components/CustomerModal';
import type { Customer, VisitFrequency } from '../types';

type BookFilter = 'mine' | 'pending' | 'directory';
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
  const [dirSearch, setDirSearch] = useState('');
  const dirResults = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return [];
    return directory
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [directory, dirSearch]);
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

  const fullDir = directory.length > 0 ? directory : customers;

  // Pending IDs for this rep
  const pendingIds = new Set(
    accessRequests
      .filter(r => r.status === 'pending' && r.requesterEmail === myEmail)
      .map(r => r.customerId)
  );

  // Pick base:
  // - reps on "mine" → their own book (customers)
  // - reps on "pending" → full directory filtered to pending IDs
  // - CS / admin / owner → full directory
  let base: Customer[];
  if (isRep && bookFilter === 'pending') {
    base = fullDir.filter(c => pendingIds.has(c.id));
  } else if (isRep) {
    base = customers; // "mine" — never touches fullDir
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

      {/* Book tabs — reps only: My Customers + Pending (+ Directory for field_sales) */}
      {isRep && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {([
            { id: 'mine'      as BookFilter, label: 'My Customers', count: 0 },
            { id: 'pending'   as BookFilter, label: 'Pending',      count: pendingCount },
            ...(role === 'field_sales' ? [{ id: 'directory' as BookFilter, label: 'Directory', count: 0 }] : []),
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

      {/* ── Directory tab content ──────────────────────────────── */}
      {bookFilter === 'directory' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Search any account and log a call or note</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name, ID or phone..."
              value={dirSearch}
              onChange={e => setDirSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 shadow-sm"
            />
          </div>
          {dirSearch.trim() && dirResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No accounts found.</p>
          )}
          {!dirSearch.trim() && (
            <p className="text-sm text-gray-400 text-center py-12">Start typing to search all accounts.</p>
          )}
          <div className="space-y-2">
            {dirResults.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-amber-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-[11px] font-black flex-shrink-0">
                  {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400 font-mono">{c.id}</p>
                    {c.phone && (
                      <>
                        <span className="text-gray-200">·</span>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {c.phone}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-500 truncate max-w-[120px]">{c.assignedRepName || '—'}</p>
                  {c.territory && <p className="text-[10px] text-gray-300">{c.territory}</p>}
                </div>
              </button>
            ))}
          </div>
          {selectedCustomer && (
            <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
          )}
        </div>
      )}

      {bookFilter !== 'directory' && (<>
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

      {/* Grid — keyed on active filters so React fully replaces it on any change */}
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
        <div
          key={`${bookFilter}|${tierFilter}|${freqFilter}|${repFilter}|${search}`}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              onOpenModal={() => setSelectedCustomer(c)}
            />
          ))}
        </div>
      )}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
      </>)}
    </div>
  );
}
