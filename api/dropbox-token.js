// Restituisce al browser un Dropbox access token.
// Strategia: prova prima OAuth2 refresh token, fallback su DROPBOX_ACCESS_TOKEN statico.
// Variabili Vercel: NASSA_API_KEY + uno dei seguenti set:
//   SET A (preferito): DROPBOX_APP_KEY + DROPBOX_APP_SECRET + DROPBOX_REFRESH_TOKEN
//   SET B (fallback):  DROPBOX_ACCESS_TOKEN

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

let _cachedToken = null;
let _cachedTokenExp = 0;

async function getToken() {
  const now = Date.now();
  if (_cachedToken && now < _cachedTokenExp - 5 * 60 * 1000) {
    console.log('[dropbox-token] using cached token');
    return _cachedToken;
  }

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, DROPBOX_ACCESS_TOKEN } = process.env;

  // Prova OAuth2 refresh se le variabili ci sono
  if (DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN) {
    console.log('[dropbox-token] trying OAuth2 refresh...');
    try {
      const resp = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
      });
      const text = await resp.text();
      console.log('[dropbox-token] OAuth2 response status:', resp.status, 'body:', text.slice(0, 200));
      if (resp.ok) {
        const data = JSON.parse(text);
        if (data.access_token) {
          _cachedToken = data.access_token;
          _cachedTokenExp = now + (data.expires_in || 14400) * 1000;
          console.log('[dropbox-token] OAuth2 OK, expires in', Math.round((data.expires_in||14400)/60), 'min');
          return _cachedToken;
        }
      }
      console.warn('[dropbox-token] OAuth2 failed:', text.slice(0, 200));
    } catch(e) {
      console.warn('[dropbox-token] OAuth2 exception:', e.message);
    }
  } else {
    console.log('[dropbox-token] OAuth2 vars missing, skipping refresh');
  }

  // Fallback: token statico
  if (DROPBOX_ACCESS_TOKEN) {
    console.log('[dropbox-token] using static DROPBOX_ACCESS_TOKEN');
    _cachedToken = DROPBOX_ACCESS_TOKEN;
    _cachedTokenExp = now + 60 * 60 * 1000; // cache 1h
    return _cachedToken;
  }

  throw new Error(
    'Nessun token Dropbox disponibile. ' +
    'Configura DROPBOX_REFRESH_TOKEN (+ APP_KEY + APP_SECRET) oppure DROPBOX_ACCESS_TOKEN su Vercel.'
  );
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
    const token = await getToken();
    res.setHeader('Cache-Control', 'private, max-age=3000');
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[dropbox-token] FATAL:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
