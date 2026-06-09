import { useState } from 'react';
import { Sun, LogIn } from 'lucide-react';
import { SALES_REPS } from '../api/mockData';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [selectedRep, setSelectedRep] = useState('');
  const { login } = useAuthStore();

  function handleLogin() {
    if (selectedRep) login(selectedRep);
  }

  return (
    <div className="min-h-screen bg-[#0F2A4A] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-2xl mb-4">
            <Sun size={36} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">sunlite</h1>
          <p className="text-amber-400 text-sm font-bold uppercase tracking-[0.25em] mt-1">Sales & Routing Hub</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-black text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-400 mb-6">Select your rep profile to continue</p>

          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Sales Representative
          </label>
          <select
            value={selectedRep}
            onChange={e => setSelectedRep(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-6 cursor-pointer"
          >
            <option value="">— Select your profile —</option>
            {SALES_REPS.map(rep => (
              <option key={rep.id} value={rep.id}>
                {rep.name} ({rep.role.replace(/_/g, ' ')}) — {rep.territory}
              </option>
            ))}
          </select>

          <button
            onClick={handleLogin}
            disabled={!selectedRep}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            <LogIn size={16} />
            Enter Hub
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Demo mode — role-based access controls active
          </p>
        </div>

        {/* Role legend */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {[
            { role: 'Admin', desc: 'Full access + revenue data', color: 'bg-red-100 text-red-600' },
            { role: 'Field Sales', desc: 'Account visits & routes', color: 'bg-amber-100 text-amber-600' },
            { role: 'Inside Sales', desc: 'Orders & follow-ups', color: 'bg-blue-100 text-blue-600' },
            { role: 'Customer Service', desc: 'Account support', color: 'bg-green-100 text-green-600' },
          ].map(({ role, desc, color }) => (
            <div key={role} className="bg-white/10 rounded-xl p-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${color}`}>{role}</span>
              <p className="text-xs text-white/50 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
