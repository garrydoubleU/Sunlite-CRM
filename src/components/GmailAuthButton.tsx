import { useEffect, useRef } from 'react';
import { Mail } from 'lucide-react';
import { useGmailStore } from '../store/gmailStore';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token: string; expires_in: number; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

interface Props {
  onAuthorized?: () => void;
}

export default function GmailAuthButton({ onAuthorized }: Props) {
  const { isTokenValid, setToken, setError, setAuthorizing, isAuthorizing } = useGmailStore();
  const clientRef = useRef<{ requestAccessToken: () => void } | null>(null);

  useEffect(() => {
    if (!CLIENT_ID || !window.google) return;
    clientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          setError(resp.error);
          return;
        }
        setToken(resp.access_token, resp.expires_in);
        onAuthorized?.();
      },
    });
  }, [setToken, setError, onAuthorized]);

  if (!CLIENT_ID) return null;
  if (isTokenValid()) return null;

  const handleClick = () => {
    if (!clientRef.current) {
      setError('Google Identity Services not loaded yet. Please try again.');
      return;
    }
    setAuthorizing(true);
    clientRef.current.requestAccessToken();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isAuthorizing}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <Mail size={14} className="text-red-500" />
      {isAuthorizing ? 'Connecting...' : 'Connect Gmail to send as you'}
    </button>
  );
}
