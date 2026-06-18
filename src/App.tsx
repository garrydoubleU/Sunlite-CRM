import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useCustomerStore } from './store/customerStore';
import Layout from './components/Layout';
import AIAssistant from './components/AIAssistant';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ActivityFeed from './pages/ActivityFeed';
import QuickLinksPage from './pages/QuickLinksPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import { useGmailSilentAuth } from './hooks/useGmailSilentAuth';

type Page = 'dashboard' | 'customers' | 'activity' | 'quicklinks' | 'settings' | 'reports';

function App() {
  const { isAuthenticated } = useAuthStore();
  const { loadFromGAS } = useCustomerStore();
  useGmailSilentAuth(); // silently restore Gmail token on every page load

  // Load live data from Google Sheets on login
  useEffect(() => {
    if (isAuthenticated) loadFromGAS();
  }, [isAuthenticated]);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [aiOpen, setAiOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <Toaster position="bottom-right" />
      </>
    );
  }

  const pageContent = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'customers': return <Customers />;
      case 'activity': return <ActivityFeed />;
      case 'quicklinks': return <QuickLinksPage />;
      case 'settings': return <SettingsPage />;
      case 'reports': return <ReportsPage />;
    }
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {pageContent()}
      </Layout>

      {/* AI Assistant toggle */}
      <button
        onClick={() => setAiOpen(v => !v)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-40"
        title="Open AI Assistant"
      >
        <Sparkles size={22} />
      </button>

      {/* AI Drawer */}
      <AnimatePresence>
        {aiOpen && <AIAssistant onClose={() => setAiOpen(false)} />}
      </AnimatePresence>

      <Toaster position="bottom-left" toastOptions={{ className: 'text-sm' }} />
    </>
  );
}

export default App;
