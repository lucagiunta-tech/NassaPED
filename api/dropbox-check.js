// Endpoint di diagnostica temporaneo — controlla quali env vars Dropbox sono presenti
// NON espone i valori, solo la presenza/assenza
export default function handler(req, res) {
  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    DROPBOX_APP_KEY:       !!process.env.DROPBOX_APP_KEY,
    DROPBOX_APP_SECRET:    !!process.env.DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN: !!process.env.DROPBOX_REFRESH_TOKEN,
    DROPBOX_ACCESS_TOKEN:  !!process.env.DROPBOX_ACCESS_TOKEN, // vecchio, non più necessario
    NASSA_API_KEY:         !!process.env.NASSA_API_KEY,
  });
}
