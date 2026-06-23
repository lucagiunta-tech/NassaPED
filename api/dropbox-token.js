// Restituisce il DROPBOX_ACCESS_TOKEN al browser.
// Token generato manualmente da: dropbox.com/developers/apps → Settings → OAuth 2 → Generate
// Quando scade: rigenerarlo e aggiornare la env var DROPBOX_ACCESS_TOKEN su Vercel.

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

export default function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token)
    return res.status(500).json({ error: 'DROPBOX_ACCESS_TOKEN non configurato su Vercel' });

  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.status(200).json({ token });
}
