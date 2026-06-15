import { useMemo } from 'react';
import { useCustomerStore } from '../store/customerStore';
import type { Activity } from '../types';

type ActivityType = 'call' | 'visit' | 'email' | 'note';

interface RepStats {
  name: string;
  call: number;
  visit: number;
  email: number;
  note: number;
  total: number;
}

function getLastWeekRange(): { start: Date; end: Date; label: string } {
  const today = new Date();
  // Day of week: 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = today.getDay();
  // Days since last Monday
  const daysSinceThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  // This Monday at midnight
  const thisMonday = new Date(today);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(today.getDate() - daysSinceThisMonday);
  // Last Monday = 7 days before this Monday
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  // Last Sunday = 1 day before this Monday
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const label = `Week of ${fmt(lastMonday)} – ${fmt(lastSunday)}`;

  return { start: lastMonday, end: lastSunday, label };
}

export default function ReportsPage() {
  const { activities } = useCustomerStore();

  const { start, end, label } = useMemo(() => getLastWeekRange(), []);

  const weekActivities = useMemo(() =>
    activities.filter((a: Activity) => {
      const d = new Date(a.date);
      return d >= start && d <= end;
    }),
    [activities, start, end]
  );

  const { repMap, typeTotals } = useMemo(() => {
    const repMap: Record<string, RepStats> = {};
    const typeTotals = { call: 0, visit: 0, email: 0, note: 0, total: 0 };

    for (const a of weekActivities) {
      const name = a.repName || 'Unknown';
      if (!repMap[name]) {
        repMap[name] = { name, call: 0, visit: 0, email: 0, note: 0, total: 0 };
      }
      const t = a.type as ActivityType;
      if (t in repMap[name]) {
        (repMap[name][t] as number) += 1;
      }
      repMap[name].total += 1;
      if (t in typeTotals) {
        (typeTotals[t] as number) += 1;
      }
      typeTotals.total += 1;
    }

    return { repMap, typeTotals };
  }, [weekActivities]);

  const repRows = useMemo(() =>
    Object.values(repMap).sort((a, b) => b.total - a.total),
    [repMap]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Activity Report</h1>
        <p className="text-sm text-slate-500 mt-1">{label}</p>
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
