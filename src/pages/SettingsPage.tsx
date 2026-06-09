import { useState } from 'react';
import { Plus, Check, Edit3, Star, X } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useGmailStore, hasPreviousGmailAuth } from '../store/gmailStore';
import GmailAuthButton from '../components/GmailAuthButton';

export default function SettingsPage() {
  const { signatures, addSignature, updateSignature, deleteSignature, setDefault } = useSettingsStore();
  const { isTokenValid, clearToken, signature: gmailSig } = useGmailStore();
  const gmailConnected = isTokenValid();
  const previouslyAuthed = hasPreviousGmailAuth();

  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');

  const handleAdd = () => {
    if (!newName.trim() || !newBody.trim()) return;
    addSignature(newName.trim(), newBody.trim());
    setNewName('');
    setNewBody('');
    setShowForm(false);
  };

  const startEdit = (id: string, name: string, body: string) => {
    setEditingId(id);
    setEditName(name);
    setEditBody(body);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateSignature(editingId, { name: editName.trim(), body: editBody.trim() });
    setEditingId(null);
  };

  const importGmailSig = () => {
    if (!gmailSig) return;
    addSignature('Gmail Signature', gmailSig);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your email signatures and account connections.</p>
      </div>

      {/* Gmail connection */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Gmail Connection</h2>
          {(gmailConnected || previouslyAuthed) && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">Send emails as yourself directly from customer profiles.</p>

        {gmailConnected || previouslyAuthed ? (
          <div className="flex items-center gap-3">
            <button
              onClick={clearToken}
              className="text-xs font-semibold text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Disconnect Gmail
            </button>
            {gmailSig && (
              <button
                onClick={importGmailSig}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Import Gmail Signature
              </button>
            )}
          </div>
        ) : (
          <GmailAuthButton />
        )}
      </div>

      {/* Signatures */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Email Signatures</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            New Signature
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Choose which signature to use when composing emails. The default auto-fills the compose panel.
        </p>

        {/* Add form */}
        {showForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Signature Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder='e.g. "Professional" or "Casual"'
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Signature Body</label>
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                placeholder={"John Smith\nSales Rep · Sunlite Lighting\n(555) 123-4567"}
                rows={5}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none resize-none focus:border-amber-400 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newBody.trim()}
                className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Check size={13} /> Save Signature
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-semibold text-gray-500 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Signature list */}
        {signatures.length === 0 && !showForm && (
          <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-sm text-gray-400 mb-2">No signatures yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              Create your first signature →
            </button>
          </div>
        )}

        <div className="space-y-3">
          {signatures.map(sig => (
            <div
              key={sig.id}
              className={`rounded-xl border p-4 transition-colors ${
                sig.isDefault ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white'
              }`}
            >
              {editingId === sig.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400"
                  />
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={5}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none resize-none focus:border-amber-400 font-mono"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg">
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{sig.name}</span>
                      {sig.isDefault && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          <Star size={9} fill="currentColor" /> Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!sig.isDefault && (
                        <button
                          onClick={() => setDefault(sig.id)}
                          className="text-[11px] font-semibold text-gray-400 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                        >
                          Set default
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(sig.id, sig.name, sig.body)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => deleteSignature(sig.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed bg-white/60 rounded-lg p-2.5 border border-white">
                    {sig.body}
                  </pre>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
