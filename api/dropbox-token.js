// Restituisce al browser un Dropbox access token fresco via OAuth2 refresh.
// Tutto inline — nessun import da altri file per massima compatibilità Vercel.
// Variabili Vercel: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, NASSA_API_KEY

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

let _cachedToken = null;
let _cachedTokenExp = 0;

async function getFreshToken() {
  const now = Date.now();
  if (_cachedToken && now < _cachedTokenExp - 5 * 60 * 1000) return _cachedToken;

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    throw new Error('Missing env vars: ' +
      (!DROPBOX_APP_KEY ? 'DROPBOX_APP_KEY ' : '') +
      (!DROPBOX_APP_SECRET ? 'DROPBOX_APP_SECRET ' : '') +
      (!DROPBOX_REFRESH_TOKEN ? 'DROPBOX_REFRESH_TOKEN' : ''));
  }

  const resp = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error('Dropbox OAuth failed (' + resp.status + '): ' + text.slice(0, 300));

  let data;
  try { data = JSON.parse(text); } catch(_) { throw new Error('Dropbox non-JSON: ' + text.slice(0, 200)); }
  if (!data.access_token) throw new Error('No access_token: ' + text.slice(0, 200));

  _cachedToken = data.access_token;
  _cachedTokenExp = now + (data.expires_in || 14400) * 1000;
  console.log('[dropbox-token] refreshed, expires in', Math.round((data.expires_in || 14400) / 60), 'min');
  return _cachedToken;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = await getFreshToken();
    res.setHeader('Cache-Control', 'private, max-age=3000');
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[dropbox-token] ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
