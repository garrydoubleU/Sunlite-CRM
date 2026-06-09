import { BookOpen, DollarSign, ShoppingCart, FileText, Map, BarChart2, Package, Headphones, ExternalLink } from 'lucide-react';

const LINKS = [
  { id: 'ql1', label: 'Product Catalog', icon: BookOpen, description: 'Full product catalog & specs', color: 'bg-blue-50 text-blue-600', url: '#' },
  { id: 'ql2', label: 'Price Sheet', icon: DollarSign, description: 'Current pricing by category', color: 'bg-green-50 text-green-600', url: '#' },
  { id: 'ql3', label: 'Order Entry', icon: ShoppingCart, description: 'Acumatica order entry portal', color: 'bg-amber-50 text-amber-600', url: '#' },
  { id: 'ql4', label: 'Internal Docs', icon: FileText, description: 'Policies, SOPs, and training', color: 'bg-purple-50 text-purple-600', url: '#' },
  { id: 'ql5', label: 'Territory Map', icon: Map, description: 'Rep territory boundaries', color: 'bg-teal-50 text-teal-600', url: '#' },
  { id: 'ql6', label: 'CRM Reports', icon: BarChart2, description: 'Sales activity reports', color: 'bg-indigo-50 text-indigo-600', url: '#' },
  { id: 'ql7', label: 'Sample Requests', icon: Package, description: 'Request product samples', color: 'bg-orange-50 text-orange-600', url: '#' },
  { id: 'ql8', label: 'Support Desk', icon: Headphones, description: 'Internal IT & ops support', color: 'bg-red-50 text-red-500', url: '#' },
];

export default function QuickLinks() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Quick Links</h2>
        <p className="text-sm text-gray-400">Access tools, catalogs, and resources</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {LINKS.map(({ id, label, icon: Icon, description, color, url }) => (
          <a
            key={id}
            href={url}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-amber-200 transition-all group flex flex-col gap-3"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-800 text-sm">{label}</p>
                <ExternalLink size={11} className="text-gray-300 group-hover:text-amber-500 transition-colors" />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
