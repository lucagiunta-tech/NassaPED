// Dropbox upload proxy — all credentials server-side
// Required Vercel env vars: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, NASSA_API_KEY
import formidable from 'formidable';
import { readFileSync, unlinkSync } from 'fs';
import { basename } from 'path';

// FIX QA: whitelist MIME types — previene upload di file eseguibili o phishing HTML
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
]);

// FIX QA: sanitizza il path — previene path traversal
// Forza il file dentro /nassa/{user}/uploads/ e rimuove caratteri pericolosi
function safePath(rawPath, user) {
  // Prendi solo il basename (ultima parte), ignora eventuali /../ nel path
  const name = basename(String(rawPath || 'file'))
    .replace(/[^a-zA-Z0-9._\-]/g, '_') // solo caratteri sicuri
    .slice(0, 200);                      // lunghezza massima
  const safeUser = String(user || 'shared').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 50);
  return `/nassa/${safeUser}/uploads/${Date.now()}_${name}`;
}

// Token cache server-side (shared across invocations in same Vercel instance)
let _tokenCache = null;
let _tokenCacheExp = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_tokenCache && now < _tokenCacheExp) return _tokenCache;

  const {
    DROPBOX_APP_KEY, DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN, DROPBOX_ACCESS_TOKEN,
  } = process.env;

  // Strategy 1: OAuth2 refresh token (preferred — never expires)
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
      if (resp.ok) {
        const data = await resp.json();
        if (data.access_token) {
          _tokenCache = data.access_token;
          _tokenCacheExp = now + ((data.expires_in || 14400) - 300) * 1000;
          console.log('[dropbox-upload] OAuth2 refresh OK');
          return _tokenCache;
        }
      }
      console.warn('[dropbox-upload] OAuth2 refresh failed:', resp.status);
    } catch (err) {
      console.warn('[dropbox-upload] OAuth2 exception:', err.message);
    }
  }

  // Strategy 2: Static token fallback
  if (DROPBOX_ACCESS_TOKEN) {
    _tokenCache = DROPBOX_ACCESS_TOKEN;
    _tokenCacheExp = now + 60 * 60 * 1000;
    return _tokenCache;
  }

  // Nothing available
  const missing = [];
  if (!DROPBOX_APP_KEY)       missing.push('DROPBOX_APP_KEY');
  if (!DROPBOX_APP_SECRET)    missing.push('DROPBOX_APP_SECRET');
  if (!DROPBOX_REFRESH_TOKEN) missing.push('DROPBOX_REFRESH_TOKEN');
  if (!DROPBOX_ACCESS_TOKEN)  missing.push('DROPBOX_ACCESS_TOKEN');
  throw new Error('Dropbox: env vars mancanti su Vercel: ' + missing.join(', '));
}
function toDirectUrl(url) {
  if (!url) return '';
  // Convert shared link to direct download URL using dl=1 — no rlkey expiry
  // Pattern: https://www.dropbox.com/s/xxx/file.jpg?dl=0 → https://dl.dropboxusercontent.com/s/xxx/file.jpg
  // For newer scl/fi/ URLs: keep rlkey but add dl=1 for direct access
  const u = url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '')
    .replace('?dl=1', '')
    .replace('?raw=1', '');
  // If it's the new scl/fi/ format, ensure dl=1 is appended for direct access
  if (u.includes('dl.dropboxusercontent.com') && !u.includes('dl=')) {
    return u + (u.includes('?') ? '&dl=1' : '?dl=1');
  }
  return u;
}

async function uploadToDropbox(token, buffer, destPath) {
  console.log('[dropbox-upload] Starting upload to path:', destPath, 'size:', buffer.length, 'bytes');
  const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: destPath, mode: 'add', autorename: true, mute: false }),
    },
    body: buffer,
  });
  const uploadData = await uploadResp.json();
  console.log('[dropbox-upload] Upload response status:', uploadResp.status);
  if (!uploadData.id) {
    console.error('[dropbox-upload] Upload failed response:', JSON.stringify(uploadData));
    throw new Error('Upload failed: ' + JSON.stringify(uploadData));
  }
  console.log('[dropbox-upload] File uploaded OK, path:', uploadData.path_display);

  const linkResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: uploadData.path_display, settings: { requested_visibility: 'public' } }),
  });
  const linkData = await linkResp.json();
  console.log('[dropbox-upload] Link creation status:', linkResp.status, 'error tag:', linkData?.error?.['.tag'] || 'none');

  if (linkData?.error?.['.tag'] === 'shared_link_already_exists') {
    const existingUrl = linkData.error?.shared_link_already_exists?.metadata?.url;
    console.log('[dropbox-upload] Using existing link:', existingUrl?.slice(0,80));
    if (existingUrl) return toDirectUrl(existingUrl);
  }

  if (!linkData.url) {
    console.error('[dropbox-upload] No URL in link response:', JSON.stringify(linkData));
  }
  const finalUrl = toDirectUrl(linkData.url || '');
  console.log('[dropbox-upload] Final URL:', finalUrl?.slice(0,80));
  return finalUrl;
}

export const config = { api: { bodyParser: false } };

// FIX QA: CORS whitelist — non più wildcard *
const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000', // dev locale
];

export default async function handler(req, res) {
  // FIX QA: CORS ristretto al dominio dell'app
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth: cookie HttpOnly o x-nassa-key legacy
  const _cookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const key = req.headers['x-nassa-key'];
  if(!_cookie && (!key || key !== process.env.NASSA_API_KEY)) return res.status(401).json({error:'Non autorizzato'});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let file = null;
  try {
    const form = formidable({ maxFileSize: 200 * 1024 * 1024 }); // 200MB
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => { if (err) reject(err); else resolve([fields, files]); });
    });

    file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    // FIX QA: validazione MIME type — blocca file pericolosi
    const mime = file.mimetype || '';
    if (!ALLOWED_MIME.has(mime)) {
      try { unlinkSync(file.filepath); } catch(_) {}
      return res.status(400).json({ error: `Tipo file non consentito: ${mime}` });
    }

    // FIX QA: path sicuro — ignora il path inviato dal client, costruiamo il nostro
    const user = (Array.isArray(fields.user) ? fields.user[0] : fields.user) || 'shared';
    const rawName = file.originalFilename || 'upload';
    const destPath = safePath(rawName, user);

    const buffer = readFileSync(file.filepath);
    const token = await getAccessToken();
    const sharedUrl = await uploadToDropbox(token, buffer, destPath);

    try { unlinkSync(file.filepath); } catch(_) { /* ignore cleanup */ }

    return res.status(200).json({ url: sharedUrl, shared_link: sharedUrl });
  } catch (err) {
    // Cleanup file temporaneo anche in caso di errore
    if (file?.filepath) { try { unlinkSync(file.filepath); } catch(_) {} }
    console.error('[dropbox-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
