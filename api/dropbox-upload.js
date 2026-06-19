// Dropbox upload proxy — keeps all Dropbox credentials server-side
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
  if (!data.access_token) throw new Error('Failed to get Dropbox token');
  return data.access_token;
}

async function uploadToDropbox(accessToken, fileBuffer, destPath) {
  const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: destPath, mode: 'add', autorename: true, mute: false }),
    },
    body: fileBuffer,
  });
  const uploadData = await uploadResp.json();
  if (!uploadData.id) throw new Error('Dropbox upload failed: ' + JSON.stringify(uploadData));

  const linkResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: uploadData.path_display, settings: { requested_visibility: 'public' } }),
  });
  const linkData = await linkResp.json();
  return (linkData.url || '').replace('?dl=0', '?raw=1');
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
    const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => { if (err) reject(err); else resolve([fields, files]); });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const destPath = (Array.isArray(fields.path) ? fields.path[0] : fields.path) || '/nassa/' + file.originalFilename;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const fileBuffer = readFileSync(file.filepath);
    const accessToken = await getAccessToken();
    const sharedUrl = await uploadToDropbox(accessToken, fileBuffer, destPath);
    unlinkSync(file.filepath);

    return res.status(200).json({ url: sharedUrl, shared_link: sharedUrl });
  } catch (err) {
    console.error('[dropbox-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
