// Creates a Dropbox shared link server-side (avoids browser CSP restrictions)
const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

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

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'DROPBOX_ACCESS_TOKEN not configured' });

  try {
    // Support both parsed body (Vercel auto-parses JSON) and raw stream
    let path;
    if (req.body && req.body.path) {
      path = req.body.path;
    } else {
      // Fallback: read raw body
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      try { path = JSON.parse(raw || '{}').path; } catch(_) {}
    }

    if (!path) return res.status(400).json({ error: 'Missing path' });
    console.log('[dropbox-link] Creating link for:', path);

    const linkRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path, settings: { requested_visibility: 'public' } })
    });

    const linkText = await linkRes.text();
    console.log('[dropbox-link] Dropbox response status:', linkRes.status);
    console.log('[dropbox-link] Dropbox response body:', linkText.slice(0, 500));

    let linkData;
    try { linkData = JSON.parse(linkText); } catch(_) {
      return res.status(500).json({ error: 'Dropbox returned non-JSON: ' + linkText.slice(0,200) });
    }

    let sharedUrl = '';
    if (linkData?.error?.['.tag'] === 'shared_link_already_exists') {
      sharedUrl = linkData.error?.shared_link_already_exists?.metadata?.url || '';
    } else {
      sharedUrl = linkData.url || '';
    }

    if (!sharedUrl) {
      return res.status(500).json({ error: 'No shared link returned', dropbox_error: linkData?.error_summary || linkData });
    }

    return res.status(200).json({ url: toDirectUrl(sharedUrl) });
  } catch (err) {
    console.error('[dropbox-link] Exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
