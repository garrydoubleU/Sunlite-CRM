import { useMemo, useState } from 'react';
import { useCustomerStore } from '../store/customerStore';
import type { Activity } from '../types';

type ActivityType = 'call' | 'visit' | 'email' | 'note';
type Period = 'lastWeek' | 'thisMonth' | 'ytd';

interface RepStats {
  name: string;
  call: number;
  visit: number;
  email: number;
  note: number;
  total: number;
}

function getRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (period === 'lastWeek') {
    const dow = now.getDay();
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(now.getDate() - daysSinceMonday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    lastSunday.setHours(23, 59, 59, 999);
    const fmtShort = (d: Date) =>
      d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { start: lastMonday, end: lastSunday, label: `Week of ${fmtShort(lastMonday)} – ${fmtShort(lastSunday)}` };
  }

  if (period === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (MTD)` };
  }

  // ytd
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: `Jan 1 – ${fmt(end)} (YTD)` };
}

function buildStats(activities: Activity[], start: Date, end: Date) {
  const repMap: Record<string, RepStats> = {};
  const typeTotals = { call: 0, visit: 0, email: 0, note: 0, total: 0 };

  for (const a of activities) {
    const d = new Date(a.date);
    if (d < start || d > end) continue;
    const name = a.repName || 'Unknown';
    if (!repMap[name]) repMap[name] = { name, call: 0, visit: 0, email: 0, note: 0, total: 0 };
    const t = a.type as ActivityType;
    if (t in repMap[name]) (repMap[name][t] as number) += 1;
    repMap[name].total += 1;
    if (t in typeTotals) (typeTotals[t] as number) += 1;
    typeTotals.total += 1;
  }

  return { repMap, typeTotals };
}

const PERIOD_LABELS: Record<Period, string> = {
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  ytd: 'YTD',
};

export default function ReportsPage() {
  const { activities } = useCustomerStore();
  const [period, setPeriod] = useState<Period>('lastWeek');

  const { start, end, label } = useMemo(() => getRange(period), [period]);
  const { repMap, typeTotals } = useMemo(() => buildStats(activities, start, end), [activities, start, end]);
  const repRows = useMemo(() => Object.values(repMap).sort((a, b) => b.total - a.total), [repMap]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Activity Report</h1>
          <p className="text-sm text-slate-400 mt-1">{label}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                period === p ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="col-span-2 sm:col-span-1 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center">
          <span className="text-3xl font-black text-amber-600">{typeTotals.total}</span>
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider mt-1">Total</span>
        </div>
        {(['call', 'visit', 'email', 'note'] as ActivityType[]).map(t => (
          <div key={t} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col items-center shadow-sm">
            <span className="text-2xl font-black text-slate-700">{typeTotals[t]}</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1 capitalize">{t}s</span>
          </div>
        ))}
      </div>

      {/* Rep breakdown table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Breakdown by Rep</h2>
        </div>
        {repRows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">No activity logged for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rep</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Calls</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Visits</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Emails</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Notes</th>
                  <th className="px-4 py-3 text-xs font-bold text-amber-500 uppercase tracking-wider text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {repRows.map(row => (
                  <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-800">{row.name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.call || '–'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.visit || '–'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.email || '–'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.note || '–'}</td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600">{row.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">All Reps</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{typeTotals.call || '–'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{typeTotals.visit || '–'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{typeTotals.email || '–'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{typeTotals.note || '–'}</td>
                  <td className="px-4 py-3 text-center font-black text-amber-600">{typeTotals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
