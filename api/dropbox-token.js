// Restituisce al browser un Dropbox access token fresco via OAuth2 refresh.
// Il browser lo usa per uploadare direttamente su Dropbox (bypass limite 4.5MB Vercel).
// Variabili Vercel: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, NASSA_API_KEY

import { getFreshDropboxToken } from '../lib/dropbox-auth.js';

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = await getFreshDropboxToken();
    res.setHeader('Cache-Control', 'private, max-age=3000');
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[dropbox-token]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
