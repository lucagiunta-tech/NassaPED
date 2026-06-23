/**
 * /api/dropbox-list
 * GET ?path=/nassa/... → lista file e cartelle Dropbox
 * GET ?search=query   → ricerca file Dropbox
 */

const ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

async function getDropboxToken() {
  const { DROPBOX_ACCESS_TOKEN, DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET } = process.env;
  if (DROPBOX_REFRESH_TOKEN && DROPBOX_APP_KEY && DROPBOX_APP_SECRET) {
    const r = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64') },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN })
    });
    if (r.ok) { const d = await r.json(); return d.access_token; }
  }
  return DROPBOX_ACCESS_TOKEN;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const cookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const key = req.headers['x-nassa-key'];
  if (!cookie && (!key || key !== process.env.NASSA_API_KEY))
    return res.status(401).json({ error: 'Non autorizzato' });

  const token = await getDropboxToken();
  if (!token) return res.status(500).json({ error: 'Token Dropbox non disponibile' });

  const { path = '/nassa', search, cursor } = req.query;

  try {
    // SEARCH mode
    if (search) {
      const r = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: search,
          options: { path: '/nassa', max_results: 30, file_status: 'active',
            filename_only: false }
        })
      });
      const d = await r.json();
      const entries = (d.matches || []).map(m => formatEntry(m.metadata?.metadata || m.metadata));
      return res.status(200).json({ entries, has_more: d.has_more || false });
    }

    // LIST mode — with cursor pagination
    let r, body;
    if (cursor) {
      r = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor })
      });
    } else {
      r = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path === '/' ? '' : path,
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          limit: 50
        })
      });
    }

    body = await r.json();
    if (!r.ok) return res.status(500).json({ error: body.error_summary || 'Errore Dropbox' });

    const entries = (body.entries || [])
      .map(formatEntry)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'it');
      });

    return res.status(200).json({
      entries,
      has_more: body.has_more || false,
      cursor: body.cursor || null,
      path
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function formatEntry(e) {
  if (!e) return null;
  const isFolder = e['.tag'] === 'folder';
  return {
    type: isFolder ? 'folder' : 'file',
    name: e.name,
    path: e.path_display || e.path_lower,
    size: e.size || 0,
    modified: e.client_modified || e.server_modified || null,
    ext: isFolder ? null : (e.name.split('.').pop() || '').toLowerCase(),
  };
}
