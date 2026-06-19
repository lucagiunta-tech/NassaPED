// Dropbox upload proxy — all credentials server-side
// Required Vercel env vars: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, NASSA_API_KEY
import formidable from 'formidable';
import { readFileSync, unlinkSync } from 'fs';

async function getAccessToken() {
  const resp = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.DROPBOX_APP_KEY + ':' + process.env.DROPBOX_APP_SECRET
      ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Dropbox token: ' + JSON.stringify(data));
  return data.access_token;
}

function toDirectUrl(url) {
  if (!url) return '';
  // Convert Dropbox share link to direct embeddable URL
  // www.dropbox.com/s/xxx/file.jpg?dl=0 → dl.dropboxusercontent.com/s/xxx/file.jpg
  return url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '')
    .replace('?dl=1', '')
    .replace('?raw=1', '');
}

async function uploadToDropbox(token, buffer, destPath) {
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
  if (!uploadData.id) throw new Error('Upload failed: ' + JSON.stringify(uploadData));

  // Try to create shared link; if it already exists, fetch existing one
  const linkResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: uploadData.path_display, settings: { requested_visibility: 'public' } }),
  });
  const linkData = await linkResp.json();

  // Handle "already exists" error from Dropbox
  if (linkData?.error?.['.tag'] === 'shared_link_already_exists') {
    const existingUrl = linkData.error?.shared_link_already_exists?.metadata?.url;
    if (existingUrl) return toDirectUrl(existingUrl);
  }

  return toDirectUrl(linkData.url || '');
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 200 * 1024 * 1024 }); // 200MB
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => { if (err) reject(err); else resolve([fields, files]); });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const destPath = (Array.isArray(fields.path) ? fields.path[0] : fields.path) || '/nassa/' + file.originalFilename;
    const buffer = readFileSync(file.filepath);
    const token = await getAccessToken();
    const sharedUrl = await uploadToDropbox(token, buffer, destPath);

    try { unlinkSync(file.filepath); } catch(e) { /* ignore cleanup errors */ }

    return res.status(200).json({ url: sharedUrl, shared_link: sharedUrl });
  } catch (err) {
    console.error('[dropbox-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
