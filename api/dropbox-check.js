// Endpoint diagnostica — testa le env vars E la chiamata OAuth Dropbox
// Non espone token, solo presenza e risultato del refresh
export default async function handler(req, res) {
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

  // Se manca qualcosa, restituisci subito
  const missing = Object.entries(vars).filter(([k,v]) => !v && k !== 'DROPBOX_ACCESS_TOKEN').map(([k]) => k);

  let oauthTest = null;
  if (vars.DROPBOX_APP_KEY && vars.DROPBOX_APP_SECRET && vars.DROPBOX_REFRESH_TOKEN) {
    try {
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
      const text = await resp.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch(_) { parsed = { raw: text.slice(0, 300) }; }
      oauthTest = {
        status: resp.status,
        ok: resp.ok,
        has_access_token: !!parsed.access_token,
        error: parsed.error || null,
        error_description: parsed.error_description || null,
      };
    } catch(e) {
      oauthTest = { exception: e.message };
    }
  }

  return res.status(200).json({ vars, missing, oauthTest });
}
