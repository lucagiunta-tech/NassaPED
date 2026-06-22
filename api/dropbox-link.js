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

  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'DROPBOX_ACCESS_TOKEN not configured' });

  try {
    // Support both auto-parsed body and raw stream
    let path;
    if (req.body && req.body.path) {
      path = req.body.path;
    } else {
      const raw = await new Promise((resolve, reject) => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d)); req.on('error', reject);
      });
      try { path = JSON.parse(raw || '{}').path; } catch(_) {}
    }
    if (!path) return res.status(400).json({ error: 'Missing path' });

    // Try to create shared link
    const linkRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, settings: { requested_visibility: 'public' } })
    });

    const linkText = await linkRes.text();
    console.log('[dropbox-link] status:', linkRes.status, 'body:', linkText.slice(0, 500));

    let linkData;
    try { linkData = JSON.parse(linkText); } catch(_) {
      return res.status(500).json({ error: 'Non-JSON from Dropbox: ' + linkText.slice(0, 200) });
    }

    // Case 1: Success
    if (linkData.url) {
      return res.status(200).json({ url: toDirectUrl(linkData.url) });
    }

    // Case 2: Link already exists — get it via list_shared_links
    const errorTag = linkData?.error?.['.tag'] || linkData?.error_summary || '';
    if (errorTag.includes('shared_link_already_exists')) {
      console.log('[dropbox-link] Link exists, fetching existing link...');
      
      // Try to get existing link from error metadata first
      const existingUrl = linkData?.error?.shared_link_already_exists?.metadata?.url;
      if (existingUrl) {
        console.log('[dropbox-link] Got URL from error metadata:', existingUrl.slice(0, 80));
        return res.status(200).json({ url: toDirectUrl(existingUrl) });
      }

      // Fallback: list existing shared links for this path
      const listRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, direct_only: true })
      });
      const listData = await listRes.json();
      console.log('[dropbox-link] list_shared_links:', JSON.stringify(listData).slice(0, 300));
      
      const existingLink = listData?.links?.[0]?.url;
      if (existingLink) {
        console.log('[dropbox-link] ✅ Found existing link:', existingLink.slice(0, 80));
        return res.status(200).json({ url: toDirectUrl(existingLink) });
      }

      return res.status(500).json({ error: 'Could not retrieve existing link', detail: listData });
    }

    // Case 3: Other error
    console.error('[dropbox-link] Unexpected error:', linkText);
    return res.status(500).json({ error: errorTag || 'Unknown Dropbox error', detail: linkData });

  } catch (err) {
    console.error('[dropbox-link] Exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
