// Diagnostica env vars + test OAuth live. Tutto inline.
const ALLOWED_ORIGINS = ['https://nassa-ped-yp63.vercel.app','http://localhost:3000'];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  const vars = {
    NASSA_API_KEY:         !!process.env.NASSA_API_KEY,
    DROPBOX_APP_KEY:       !!process.env.DROPBOX_APP_KEY,
    DROPBOX_APP_SECRET:    !!process.env.DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN: !!process.env.DROPBOX_REFRESH_TOKEN,
    DROPBOX_ACCESS_TOKEN:  !!process.env.DROPBOX_ACCESS_TOKEN,
  };

  let oauthTest = null;
  try {
    const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) throw new Error('Missing vars');
    const resp = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
    });
    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch(_) { data = { raw: text.slice(0,200) }; }
    oauthTest = { status: resp.status, ok: resp.ok, has_token: !!data.access_token, error: data.error||null, error_description: data.error_description||null };
  } catch(e) { oauthTest = { ok: false, error: e.message }; }

  return res.status(200).json({ vars, oauthTest });
}
