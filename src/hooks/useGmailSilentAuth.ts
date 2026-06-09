import { useEffect, useRef } from 'react';
import { useGmailStore, hasPreviousGmailAuth } from '../store/gmailStore';
import { fetchGmailSignature } from '../api/gmail';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
].join(' ');

// Runs once on app load. If the user previously authorized Gmail,
// silently re-acquires a fresh token with no popup.
export function useGmailSilentAuth() {
  const { setToken, setSignature, clearToken, isTokenValid } = useGmailStore();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (!CLIENT_ID || !hasPreviousGmailAuth() || isTokenValid()) return;

    const tryAuth = () => {
      if (!window.google) return false;
      attempted.current = true;

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID!,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) {
            clearToken(); // Google session expired — show connect button
            return;
          }
          setToken(resp.access_token, resp.expires_in);
          fetchGmailSignature(resp.access_token)
            .then(sig => { if (sig) setSignature(sig); })
            .catch(() => {});
        },
      });
      client.requestAccessToken({ prompt: '' });
      return true;
    };

    if (!tryAuth()) {
      // GIS script not loaded yet — poll until ready
      const interval = setInterval(() => {
        if (tryAuth()) clearInterval(interval);
      }, 300);
      return () => clearInterval(interval);
    }
  }, [setToken, setSignature, clearToken, isTokenValid]);
}
