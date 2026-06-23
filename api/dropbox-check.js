// Diagnostica: testa env vars + chiamata OAuth Dropbox live
import { getFreshDropboxToken } from '../lib/dropbox-auth.js';

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

  let oauthTest = null;
  try {
    const token = await getFreshDropboxToken();
    oauthTest = { ok: true, token_prefix: token.slice(0, 8) + '…' };
  } catch(e) {
    oauthTest = { ok: false, error: e.message };
  }

  return res.status(200).json({ vars, oauthTest });
}
