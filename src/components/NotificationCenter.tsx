import { X, MapPin, Mail, FileText, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  onClose: () => void;
}

const NOTIFICATIONS = [
  { id: 'n1', type: 'overdue_visit', title: 'Overdue Visit', body: 'Williamsburg Fasteners has not been visited in 45 days', timestamp: new Date().toISOString(), icon: MapPin, color: 'text-red-500 bg-red-50' },
  { id: 'n2', type: 'new_email', title: 'New Email Matched', body: 'Manhattan Tool & Supply sent an RFQ — auto-logged to activity feed', timestamp: new Date(Date.now() - 3600000 * 6).toISOString(), icon: Mail, color: 'text-blue-500 bg-blue-50' },
  { id: 'n3', type: 'teammate_note', title: 'Teammate Note', body: 'Mike Rosen added a note to Budget Maintenance', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), icon: FileText, color: 'text-amber-500 bg-amber-50' },
];

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  return (
    <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-800">Notifications</span>
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{NOTIFICATIONS.length}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <div className="divide-y divide-gray-50 max-h-80 overflow-auto">
        {NOTIFICATIONS.map(n => (
          <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.color}`}>
                <n.icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-gray-100">
        <button className="text-xs font-medium text-amber-500 hover:text-amber-600">Mark all as read</button>
      </div>
    </div>
  );
}
