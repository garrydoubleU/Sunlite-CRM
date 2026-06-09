// Gmail API — sends email as the authenticated user via OAuth access token
// Token is obtained via Google Identity Services popup (src/store/gmailStore.ts)

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function makeRfc2822(params: {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
}): string {
  const { to, subject, body, fromName, fromEmail } = params;
  const raw = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');
  // Base64url encode
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Strip HTML tags from signature (GAS sends plain text)
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export async function fetchGmailSignature(accessToken: string): Promise<string> {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return '';
  const data = await res.json() as { sendAs?: Array<{ isPrimary?: boolean; signature?: string }> };
  const primary = data.sendAs?.find(s => s.isPrimary) ?? data.sendAs?.[0];
  return primary?.signature ? stripHtml(primary.signature) : '';
}

export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  accessToken: string;
}): Promise<void> {
  const raw = makeRfc2822(params);
  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gmail API error ${res.status}`);
  }
}
