import { useState } from 'react';
import { LogIn, ChevronDown, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { SALES_REPS } from '../api/mockData';
import { useAuthStore, isGASConfigured } from '../store/authStore';

const gasMode = isGASConfigured();

export default function Login() {
  const { loginDemo, loginWithCredentials, isLoading, loginError } = useAuthStore();

  const [selectedRepId, setSelectedRepId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleDemoLogin = () => {
    if (selectedRepId) loginDemo(selectedRepId);
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) await loginWithCredentials(email, password);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 text-center mb-4">
          <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-amber-500 font-bold text-xl tracking-tight">sunlite</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sunlite</h1>
          <p className="text-xs font-bold text-amber-500 tracking-[0.25em] uppercase mt-1">Field Sales Hub</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
          {gasMode ? (
            <form onSubmit={handleCredentialLogin}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Sign In</p>

              {loginError && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-600 text-xs font-medium px-3 py-2.5 rounded-xl border border-red-100">
                  <AlertCircle size={14} />
                  {loginError}
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-amber-400 transition-colors">
                  <Mail size={15} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-amber-400 transition-colors">
                  <Lock size={15} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-amber-500 disabled:bg-gray-200 text-white disabled:text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                Default password: <span className="font-mono font-semibold">demo123</span>
              </p>
            </form>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sign In As</p>
              <div className="relative mb-4">
                <select
                  value={selectedRepId}
                  onChange={e => setSelectedRepId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none appearance-none focus:border-amber-400 transition-colors cursor-pointer"
                >
                  <option value="">Choose a sales rep...</option>
                  {SALES_REPS.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name} — {rep.role.replace('_', ' ')} ({rep.territory})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {selectedRepId && (
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  {(() => {
                    const rep = SALES_REPS.find(r => r.id === selectedRepId);
                    return rep ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                          {rep.avatarInitials}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{rep.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{rep.role.replace('_', ' ')} · {rep.territory}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <button
                onClick={handleDemoLogin}
                disabled={!selectedRepId}
                className="w-full bg-amber-500 disabled:bg-gray-200 text-white disabled:text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
              >
                <LogIn size={16} />
                Sign In
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">Demo mode — no password required</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
