// Restituisce un Dropbox access token fresco al browser.
// Usa il refresh token OAuth2 (DROPBOX_REFRESH_TOKEN) per ottenere
// un access token a vita breve (~4h) — mai più token scaduti.
//
// Variabili Vercel richieste:
//   DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, NASSA_API_KEY
// DROPBOX_ACCESS_TOKEN non è più necessario.

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// Cache server-side del token: evita di chiamare Dropbox ad ogni upload
let _cachedToken = null;
let _cachedTokenExp = 0; // timestamp ms di scadenza

export async function getFreshDropboxToken() {
  const now = Date.now();
  // Usa la cache se il token è ancora valido (margine sicurezza: 5 min)
  if (_cachedToken && now < _cachedTokenExp - 5 * 60 * 1000) {
    return _cachedToken;
  }

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    throw new Error('Missing DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN');
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
    throw new Error('Dropbox token refresh failed (' + resp.status + '): ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token in Dropbox response');

  _cachedToken = data.access_token;
  // expires_in è in secondi (tipicamente 14400 = 4h)
  _cachedTokenExp = now + (data.expires_in || 14400) * 1000;
  console.log('[dropbox-token] Token refreshed, expires in', Math.round((data.expires_in || 14400) / 60), 'min');
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
    const token = await getFreshDropboxToken();
    // Cache lato browser per 50 min (il token dura 4h, ma lo rinnoviamo spesso server-side)
    res.setHeader('Cache-Control', 'private, max-age=3000');
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[dropbox-token]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
