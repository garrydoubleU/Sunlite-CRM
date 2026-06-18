import { useState, useMemo } from 'react';
import { Search, Phone } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import CustomerModal from '../components/CustomerModal';
import type { Customer } from '../types';

export default function Directory() {
  const { directory } = useCustomerStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return directory
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [directory, search]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <p className="text-lg font-bold text-gray-900">Company Directory</p>
        <p className="text-xs text-gray-400 mt-0.5">Search any account and log a call or note</p>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          placeholder="Search by name, ID or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 shadow-sm"
        />
      </div>

      {/* Results */}
      {search.trim() && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No accounts found.</p>
      )}

      {!search.trim() && (
        <p className="text-sm text-gray-400 text-center py-12">Start typing to search all accounts.</p>
      )}

      <div className="space-y-2">
        {results.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-amber-300 hover:shadow-sm transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-[11px] font-black flex-shrink-0">
              {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
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

      {selected && (
        <CustomerModal customer={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
