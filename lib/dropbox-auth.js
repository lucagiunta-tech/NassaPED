// Shared helper — NON è una Serverless Function (sta fuori da /api/)
// Usa OAuth2 refresh token per ottenere access token freschi automaticamente.
// Variabili Vercel: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN

let _cachedToken = null;
let _cachedTokenExp = 0;

export async function getFreshDropboxToken() {
  const now = Date.now();
  // Usa cache server-side se il token è ancora valido (margine 5 min)
  if (_cachedToken && now < _cachedTokenExp - 5 * 60 * 1000) {
    return _cachedToken;
  }

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    throw new Error('Missing DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN in Vercel env vars');
  }

  const resp = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error('Dropbox OAuth refresh failed (' + resp.status + '): ' + errText.slice(0, 300));
  }

  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token in Dropbox OAuth response: ' + JSON.stringify(data).slice(0, 200));

  _cachedToken = data.access_token;
  _cachedTokenExp = now + (data.expires_in || 14400) * 1000;
  console.log('[dropbox-auth] Token refreshed, expires in', Math.round((data.expires_in || 14400) / 60), 'min');
  return _cachedToken;
}
