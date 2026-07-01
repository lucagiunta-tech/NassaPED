/**
 * /api/dropbox-token
 *
 * Restituisce un Dropbox access token al browser per upload diretti.
 * Strategia (in ordine di priorità):
 *
 *   1. OAuth2 refresh (automatico, non scade mai)
 *      Richiede: DROPBOX_APP_KEY + DROPBOX_APP_SECRET + DROPBOX_REFRESH_TOKEN
 *
 *   2. Token statico (fallback, scade ogni ~4h)
 *      Richiede: DROPBOX_ACCESS_TOKEN
 *      Rinnovo manuale: dropbox.com/developers/apps → Settings → OAuth2 → Generate
 *
 * Il body della risposta 500 contiene il motivo esatto del fallimento.
 */

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// Cache server-side: evita di chiamare Dropbox ad ogni request
let _cached = null;
let _cachedExp = 0;

async function resolveToken() {
  const now = Date.now();

  // Usa cache se ancora valida (margine 5 min)
  if (_cached && now < _cachedExp) {
    return { token: _cached, source: 'cache' };
  }

  const {
    DROPBOX_APP_KEY,
    DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN,
    DROPBOX_ACCESS_TOKEN,
  } = process.env;

  // ── Strategia 1: OAuth2 refresh token ──────────────────────────────
  if (DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN) {
    try {
      const resp = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET
          ).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: DROPBOX_REFRESH_TOKEN,
        }),
      });

      const text = await resp.text();

      if (!resp.ok) {
        // OAuth2 failed — log and fall through to static token
        console.warn('[dropbox-token] OAuth2 refresh failed:', resp.status, text.slice(0, 200));
      } else {
        const data = JSON.parse(text);
        if (data.access_token) {
          _cached = data.access_token;
          // Cache until 5 min before expiry (default 4h = 14400s)
          _cachedExp = now + ((data.expires_in || 14400) - 300) * 1000;
          console.log('[dropbox-token] ✅ OAuth2 refresh OK, expires in',
            Math.round((data.expires_in || 14400) / 60), 'min');
          return { token: _cached, source: 'oauth2' };
        }
        console.warn('[dropbox-token] OAuth2 response has no access_token:', text.slice(0, 200));
      }
    } catch (err) {
      console.warn('[dropbox-token] OAuth2 exception:', err.message);
    }
  }

  // ── Strategia 2: token statico ──────────────────────────────────────
  if (DROPBOX_ACCESS_TOKEN) {
    console.log('[dropbox-token] Using static DROPBOX_ACCESS_TOKEN (fallback)');
    _cached = DROPBOX_ACCESS_TOKEN;
    _cachedExp = now + 60 * 60 * 1000; // cache 1h (may expire sooner on Dropbox side)
    return { token: _cached, source: 'static' };
  }

  // ── Nessun token disponibile ────────────────────────────────────────
  const missing = [];
  if (!DROPBOX_APP_KEY)       missing.push('DROPBOX_APP_KEY');
  if (!DROPBOX_APP_SECRET)    missing.push('DROPBOX_APP_SECRET');
  if (!DROPBOX_REFRESH_TOKEN) missing.push('DROPBOX_REFRESH_TOKEN');
  if (!DROPBOX_ACCESS_TOKEN)  missing.push('DROPBOX_ACCESS_TOKEN');

  throw new Error(
    'Nessun token Dropbox disponibile. ' +
    'Variabili mancanti su Vercel: ' + missing.join(', ') + '. ' +
    'Aggiungi DROPBOX_REFRESH_TOKEN (+ APP_KEY + APP_SECRET) per il rinnovo automatico, ' +
    'oppure DROPBOX_ACCESS_TOKEN per il token manuale.'
  );
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth: accetta sia cookie HttpOnly (nuovo) che x-nassa-key (legacy)
  const sessionCookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const apiKey = req.headers['x-nassa-key'];
  const validKey = process.env.NASSA_API_KEY;
  const authed = apiKey === validKey || !!sessionCookie;
  if (!authed) return res.status(401).json({ error: 'Non autorizzato' });

  try {
    const { token, source } = await resolveToken();
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min browser cache
    return res.status(200).json({ token, source });
  } catch (err) {
    console.error('[dropbox-token] FATAL:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
