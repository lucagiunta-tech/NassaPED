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

// Read raw body from request stream
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
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
    // Parse body manually (Vercel plain functions don't auto-parse JSON)
    const rawBody = await readBody(req);
    const body = JSON.parse(rawBody || '{}');
    const { path } = body;
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
    const linkData = await linkRes.json();
    console.log('[dropbox-link] Response status:', linkRes.status, 'error tag:', linkData?.error?.['.tag'] || 'none');

    let sharedUrl = '';
    if (linkData?.error?.['.tag'] === 'shared_link_already_exists') {
      sharedUrl = linkData.error?.shared_link_already_exists?.metadata?.url || '';
    } else {
      sharedUrl = linkData.url || '';
    }

    if (!sharedUrl) {
      console.error('[dropbox-link] No URL:', JSON.stringify(linkData));
      return res.status(500).json({ error: 'No shared link returned', detail: linkData });
    }

    const finalUrl = toDirectUrl(sharedUrl);
    console.log('[dropbox-link] ✅ URL:', finalUrl.slice(0, 80));
    return res.status(200).json({ url: finalUrl });

  } catch (err) {
    console.error('[dropbox-link] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
