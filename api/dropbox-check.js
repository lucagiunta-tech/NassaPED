// Diagnostic endpoint — checks OAuth2 refresh token works
// Call: GET /api/dropbox-check
export default async function handler(req, res) {
  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN, DROPBOX_ACCESS_TOKEN } = process.env;

  const result = {
    has_app_key: !!DROPBOX_APP_KEY,
    has_app_secret: !!DROPBOX_APP_SECRET,
    has_refresh_token: !!DROPBOX_REFRESH_TOKEN,
    has_access_token: !!DROPBOX_ACCESS_TOKEN,
    oauth2_result: null,
    static_token_prefix: DROPBOX_ACCESS_TOKEN ? DROPBOX_ACCESS_TOKEN.slice(0, 10) + '...' : null,
  };

  if (DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN) {
    try {
      const resp = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(DROPBOX_APP_KEY + ':' + DROPBOX_APP_SECRET).toString('base64'),
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
      });
      const text = await resp.text();
      result.oauth2_http_status = resp.status;
      try {
        const data = JSON.parse(text);
        result.oauth2_result = data.access_token ? 'OK - got token starting with ' + data.access_token.slice(0, 10) : data;
      } catch(_) {
        result.oauth2_result = 'non-JSON: ' + text.slice(0, 200);
      }
    } catch(e) {
      result.oauth2_result = 'exception: ' + e.message;
    }
  } else {
    result.oauth2_result = 'skipped - missing env vars';
  }

  return res.status(200).json(result);
}
