import { useEffect, useRef, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { useGmailStore, hasPreviousGmailAuth } from '../store/gmailStore';
import { fetchGmailSignature } from '../api/gmail';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
].join(' ');

interface Props {
  onAuthorized?: () => void;
}

export default function GmailAuthButton({ onAuthorized }: Props) {
  const { isTokenValid, setToken, setSignature, clearToken, setError, setAuthorizing, isAuthorizing } = useGmailStore();
  const clientRef = useRef<{ requestAccessToken: (opts?: { prompt?: string }) => void } | null>(null);

  const handleTokenResponse = useCallback(async (
    resp: { access_token: string; expires_in: number; error?: string },
    silent = false
  ) => {
    if (resp.error) {
      if (silent) {
        // Silent re-auth failed (e.g. session expired) — clear flag so button shows
        clearToken();
      } else {
        setError(resp.error);
      }
      return;
    }
    setToken(resp.access_token, resp.expires_in);
    fetchGmailSignature(resp.access_token).then(sig => {
      if (sig) setSignature(sig);
    }).catch(() => {});
    onAuthorized?.();
  }, [setToken, setSignature, clearToken, setError, onAuthorized]);

  useEffect(() => {
    if (!CLIENT_ID) return;

    // GIS may not be loaded yet — wait for it
    const init = () => {
      if (!window.google) return;
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp) => handleTokenResponse(resp, false),
      });

      // If user previously authorized, silently re-acquire token (no popup)
      if (hasPreviousGmailAuth() && !isTokenValid()) {
        const silentClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (resp) => handleTokenResponse(resp, true),
        });
        silentClient.requestAccessToken({ prompt: '' });
      }
    };

    if (window.google) {
      init();
    } else {
      // Script loads async — poll briefly
      const t = setInterval(() => {
        if (window.google) { clearInterval(t); init(); }
      }, 200);
      return () => clearInterval(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run handler changes without re-triggering silent auth
  useEffect(() => {
    if (!clientRef.current || !window.google || !CLIENT_ID) return;
    clientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => handleTokenResponse(resp, false),
    });
  }, [handleTokenResponse]);

  if (!CLIENT_ID) return null;
  if (isTokenValid()) return null;
  if (hasPreviousGmailAuth() && !isTokenValid()) return null; // silently re-authing

  const handleClick = () => {
    if (!clientRef.current) {
      setError('Google Identity Services not loaded yet. Please try again.');
      return;
    }
    setAuthorizing(true);
    clientRef.current.requestAccessToken({ prompt: 'consent' });
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
