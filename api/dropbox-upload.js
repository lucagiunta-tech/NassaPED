// Dropbox upload proxy — keeps DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN server-side
const { IncomingForm } = require('formidable');
const fs = require('fs');
const https = require('https');

// Get a fresh Dropbox access token using the refresh token
async function getDropboxAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
    client_id: process.env.DROPBOX_APP_KEY,
    client_secret: process.env.DROPBOX_APP_SECRET,
  });

  const resp = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    body: params,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Dropbox token: ' + JSON.stringify(data));
  return data.access_token;
}

// Upload a file buffer to Dropbox and return a shared link
async function uploadToDropbox(accessToken, fileBuffer, destPath) {
  // Upload
  const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: destPath,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: fileBuffer,
  });
  const uploadData = await uploadResp.json();
  if (!uploadData.id) throw new Error('Dropbox upload failed: ' + JSON.stringify(uploadData));

  // Create shared link
  const linkResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: uploadData.path_display,
      settings: { requested_visibility: 'public' },
    }),
  });
  const linkData = await linkResp.json();
  // Convert dl=0 to dl=1 for direct media access
  const sharedUrl = (linkData.url || '').replace('?dl=0', '?raw=1');
  return sharedUrl;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const key = req.headers['x-nassa-key'];
  if (key !== process.env.NASSA_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse multipart form
    const form = new IncomingForm({ maxFileSize: 100 * 1024 * 1024 }); // 100MB
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err); else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const destPath = (Array.isArray(fields.path) ? fields.path[0] : fields.path) || '/nassa/' + file.originalFilename;

    if (!file) return res.status(400).json({ error: 'No file provided' });

    const fileBuffer = fs.readFileSync(file.filepath);
    const accessToken = await getDropboxAccessToken();
    const sharedUrl = await uploadToDropbox(accessToken, fileBuffer, destPath);

    // Cleanup temp file
    fs.unlinkSync(file.filepath);

    return res.status(200).json({ url: sharedUrl, shared_link: sharedUrl });
  } catch (err) {
    console.error('[DROPBOX-UPLOAD]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
