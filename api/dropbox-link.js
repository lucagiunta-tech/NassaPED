// Crea shared link Dropbox. Usa OAuth2 refresh token (non scade mai).

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

async function getToken(req) {
  // Reuse our own dropbox-token endpoint — it has OAuth2 + caching + fallback
  const host = req.headers.host || 'nassa-ped-yp63.vercel.app';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const res = await fetch(`${proto}://${host}/api/dropbox-token`, {
    headers: {
      'x-nassa-key': process.env.NASSA_API_KEY,
      'cookie': req.headers.cookie || ''
    }
  });
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status);
  const d = await res.json();
  if (!d.token) throw new Error('No token in response');
  return d.token;
}

function toDirectUrl(url) {
  if (!url) return '';
  let u = url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '').replace('?dl=1', '').replace('?raw=1', '');
  if (u.includes('dl.dropboxusercontent.com') && !u.includes('raw='))
    u += (u.includes('?') ? '&raw=1' : '?raw=1');
  return u;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const _cookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const key = req.headers['x-nassa-key'];
  const validKey = process.env.NASSA_API_KEY;
  if(!_cookie && key !== validKey) return res.status(401).json({error:'Non autorizzato'});

  try {
    const token = await getToken(req);

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
    }

    return res.status(500).json({ error: errorTag || 'Errore Dropbox', detail: linkData });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
