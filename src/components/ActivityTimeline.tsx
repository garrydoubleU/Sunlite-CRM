import { useState } from 'react';
import { Phone, MapPin, FileText, Mail, Plus, Trash2, Edit3, Check, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { safeFormat, parseEmailSummary, looksLikeEmail } from '../utils/scheduler';
import type { ActivityType } from '../types';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';

interface ActivityTimelineProps {
  customerId: string;
}

const TYPE_CONFIG: Record<ActivityType, { icon: typeof Phone; color: string; label: string }> = {
  call: { icon: Phone, color: 'text-blue-500 bg-blue-50', label: 'Call' },
  visit: { icon: MapPin, color: 'text-green-500 bg-green-50', label: 'Visit' },
  note: { icon: FileText, color: 'text-gray-500 bg-gray-100', label: 'Note' },
  email: { icon: Mail, color: 'text-red-500 bg-red-50', label: 'Email' },
};

export default function ActivityTimeline({ customerId }: ActivityTimelineProps) {
  const { getActivitiesForCustomer, addActivity, deleteActivity, updateActivity } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const activities = getActivitiesForCustomer(customerId);

  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<ActivityType>('note');
  const [newSummary, setNewSummary] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleAdd = () => {
    if (!newSummary.trim()) return;
    addActivity({
      id: `a${Date.now()}`,
      customerId,
      type: newType,
      date: new Date().toISOString(),
      repName: currentUser?.name ?? 'Unknown',
      summary: newSummary.trim(),
      source: 'manual',
    });
    setNewSummary('');
    setShowForm(false);
  };

  const handleEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditText(current);
  };

  const handleSaveEdit = (id: string) => {
    updateActivity(id, { summary: editText });
    setEditingId(null);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Activity Timeline</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Log Activity
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex gap-2 mb-2">
            {(['note', 'call', 'visit'] as ActivityType[]).map(t => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                  newType === t ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={newSummary}
            onChange={e => setNewSummary(e.target.value)}
            placeholder="Add your note..."
            className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none resize-none focus:border-amber-400"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleAdd} className="flex items-center gap-1 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600">
              <Check size={12} /> Save
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {activities.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
        )}
        {activities.map(activity => {
          const { icon: Icon, color, label } = TYPE_CONFIG[activity.type];
          return (
            <div key={activity.id} className="flex gap-3 group">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{label}</span>
                    {activity.source === 'gmail-auto' && (
                      <span className="text-[10px] bg-red-100 text-red-500 font-semibold px-1.5 py-0.5 rounded-full">Gmail</span>
                    )}
                    <span className="text-[10px] text-gray-400">{activity.repName}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId !== activity.id && (
                      <button onClick={() => handleEdit(activity.id, activity.summary)} className="text-gray-400 hover:text-gray-600 p-0.5">
                        <Edit3 size={11} />
                      </button>
                    )}
                    <button onClick={() => deleteActivity(activity.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {editingId === activity.id ? (
                  <div className="mt-1">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full text-xs p-1.5 border border-gray-200 rounded-lg outline-none resize-none focus:border-amber-400"
                      rows={2}
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => handleSaveEdit(activity.id)} className="text-[10px] font-semibold bg-amber-500 text-white px-2 py-1 rounded">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] font-semibold text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
                    </div>
                  </div>
                ) : (() => {
                  const isEmail = activity.type === 'email' || looksLikeEmail(activity.summary);
                  const email = isEmail ? parseEmailSummary(activity.summary) : null;
                  if (email) {
                    return (
                      <div className="mt-1 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white border-b border-gray-100">
                          {email.direction === 'sent'
                            ? <ArrowUpRight size={10} className="text-blue-400 flex-shrink-0" />
                            : <ArrowDownLeft size={10} className="text-green-500 flex-shrink-0" />}
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                            {email.direction === 'sent' ? 'Sent' : 'Received'}
                          </span>
                          {email.address && (
                            <span className="text-[10px] text-gray-400 truncate">{email.address}</span>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold text-gray-800 leading-snug">{email.subject}</p>
                          {email.body && (
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{email.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{activity.summary}</p>;
                })()}
                <p className="text-[10px] text-gray-400 mt-1">{safeFormat(activity.date, 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
