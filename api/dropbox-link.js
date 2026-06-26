// Crea shared link Dropbox.
// Usa OAuth2 refresh token (stesso sistema di dropbox-token.js) — non scade mai.

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// Server-side token cache shared within this serverless instance
let _cached = null;
let _cachedExp = 0;

async function resolveToken() {
  const now = Date.now();
  if (_cached && now < _cachedExp) return _cached;

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, DROPBOX_ACCESS_TOKEN } = process.env;

  // OAuth2 refresh (preferred — never expires)
  if (DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN) {
    try {
      const resp = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
      });
      const data = await resp.json();
      if (data.access_token) {
        _cached = data.access_token;
        _cachedExp = now + ((data.expires_in || 14400) - 300) * 1000;
        return _cached;
      }
    } catch(e) { console.warn('[dropbox-link] OAuth2 failed:', e.message); }
  }

  // Fallback: static token
  if (DROPBOX_ACCESS_TOKEN) return DROPBOX_ACCESS_TOKEN;
  throw new Error('No Dropbox token available');
}

function toDirectUrl(url) {
  if (!url) return '';
  let u = url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '').replace('?dl=1', '').replace('?raw=1', '');
  if (u.includes('dl.dropboxusercontent.com') && !u.includes('dl='))
    u += (u.includes('?') ? '&dl=1' : '?dl=1');
  return u;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth: cookie HttpOnly o x-nassa-key legacy
  const _cookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const key = req.headers['x-nassa-key'];
  const validKey = process.env.NASSA_API_KEY || 'NASSA_SECRET_2026';
  if(!_cookie && key !== validKey) return res.status(401).json({error:'Non autorizzato'});

  try {
    const token = await resolveToken();

    let path = req.body?.path;
    if (!path) {
      const raw = await new Promise((resolve, reject) => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d)); req.on('error', reject);
      });
      try { path = JSON.parse(raw || '{}').path; } catch(_) {}
    }
    if (!path) return res.status(400).json({ error: 'Missing path' });

    const linkRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, settings: { requested_visibility: 'public' } })
    });

    const linkText = await linkRes.text();
    let linkData;
    try { linkData = JSON.parse(linkText); } catch(_) {
      return res.status(500).json({ error: 'Non-JSON da Dropbox: ' + linkText.slice(0, 200) });
    }

    if (linkData.url) return res.status(200).json({ url: toDirectUrl(linkData.url) });

    const errorTag = linkData?.error?.['.tag'] || linkData?.error_summary || '';
    if (errorTag.includes('shared_link_already_exists')) {
      const existingUrl = linkData?.error?.shared_link_already_exists?.metadata?.url;
      if (existingUrl) return res.status(200).json({ url: toDirectUrl(existingUrl) });

      const listRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, direct_only: true })
      });
      const listData = await listRes.json();
      const existingLink = listData?.links?.[0]?.url;
      if (existingLink) return res.status(200).json({ url: toDirectUrl(existingLink) });
      return res.status(500).json({ error: 'Link esistente non recuperabile', detail: listData });
    }

    return res.status(500).json({ error: errorTag || 'Errore Dropbox', detail: linkData });

  } catch (err) {
    console.error('[dropbox-link] ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
