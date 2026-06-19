export default async function handler(req, res) {
  // Only allow GET or POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;

  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Missing Dropbox Environment Variables in Vercel' });
  }

  try {
    // Exchange the refresh token for a short-lived access token securely on the backend
    const response = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: DROPBOX_REFRESH_TOKEN,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dropbox token exchange failed:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch access token from Dropbox' });
    }

    const data = await response.json();
    
    // Return the fresh access token to the frontend
    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in
    });

  } catch (error) {
    console.error('Server error during token exchange:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
