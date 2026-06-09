import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import type { ChatMessage } from '../types';

const SUGGESTED_PROMPTS = [
  'Which customers are overdue for a visit?',
  'Summarize activity for Hartwell Hardware',
  'Who are my top Tier 1 accounts?',
  'Generate a visit plan for this week',
  'Which accounts have no open orders?',
];

const STUB_RESPONSES: Record<string, string> = {
  default: `Based on your current portfolio data, here's a quick summary:\n\n• **3 accounts** are overdue for visits (30+ days since last contact)\n• **2 Tier 1 accounts** have no activity this week\n• Your weekly route has **4 scheduled visits**\n\nWould you like me to prioritize your visit list or draft a follow-up email for a specific account?`,
  overdue: `Here are your **overdue accounts** (30+ days without contact):\n\n1. **Harlem Building Materials** — 40 days (Tier 2, bi-weekly)\n2. **Flushing Supply Co** — 35 days (Tier 3, monthly)\n3. **Williamsburg Fasteners** — 45 days (Tier 4, monthly)\n\nI'd recommend prioritizing Harlem Building Materials first given their Tier 2 status. Want me to draft a check-in message?`,
  tier1: `Your **Tier 1 accounts** are your highest priority relationships:\n\n• **Budget Maintenance** — Last contact 32 days ago ⚠️\n• **Certified Lumber** — Last contact 8 days ago ✓\n• **Manhattan Tool & Supply** — Last contact 3 days ago ✓\n\nBudget Maintenance needs attention. Would you like me to help schedule a visit?`,
  schedule: `Here's your **suggested visit plan for this week**:\n\n**Monday:** Manhattan Tool & Supply (weekly)\n**Tuesday:** Budget Maintenance (overdue — priority!)\n**Wednesday:** Certified Lumber (bi-weekly)\n**Thursday:** Jamaica Electrical Supply (bi-weekly)\n**Friday:** Staten Island Lumber Depot (monthly)\n\nThis covers all overdue accounts and keeps your weeklies on track. Should I send calendar invites?`,
};

function getStubResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('overdue') || lower.includes('due')) return STUB_RESPONSES.overdue;
  if (lower.includes('tier 1') || lower.includes('top')) return STUB_RESPONSES.tier1;
  if (lower.includes('plan') || lower.includes('schedule') || lower.includes('week')) return STUB_RESPONSES.schedule;
  return STUB_RESPONSES.default;
}

interface AIAssistantProps {
  onClose: () => void;
}

export default function AIAssistant({ onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your Sunlite AI assistant. I can help you prioritize accounts, draft follow-up messages, summarize activity, and plan your visit routes. What would you like to know?",
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = getStubResponse(msg);
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 900 + Math.random() * 600);
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-[#0F2A4A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">AI Assistant</p>
            <p className="text-white/50 text-xs">Sunlite Sales Intelligence</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Suggested prompts */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Suggested</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-xs bg-white border border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <ChevronRight size={10} />
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-amber-100' : 'bg-[#0F2A4A]'
            }`}>
              {msg.role === 'assistant'
                ? <Bot size={14} className="text-amber-600" />
                : <User size={14} className="text-white" />
              }
            </div>
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-gray-100 text-gray-700 rounded-tl-sm'
                  : 'bg-[#0F2A4A] text-white rounded-tr-sm'
              }`}>
                {msg.content.split('\n').map((line, i) => {
                  const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                  return (
                    <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: bold }} />
                  );
                })}
              </div>
              <span className="text-[10px] text-gray-400">
                {format(new Date(msg.timestamp), 'h:mm a')}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Bot size={14} className="text-amber-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-amber-400 focus-within:bg-white transition-all">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about accounts, routes, priorities..."
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="w-7 h-7 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
          >
            <Send size={12} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1.5">AI responses are illustrative — connect Claude API for live intelligence</p>
      </div>
    </motion.div>
  );
}
