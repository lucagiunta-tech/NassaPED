// Supabase proxy — keeps ALL credentials server-side
// Browser never sees SUPABASE_URL, SUPABASE_SERVICE_KEY, or NASSA_API_KEY
//
// Required Vercel env vars:
//   SUPABASE_URL        → your Supabase project URL (e.g. https://xxxx.supabase.co)
//   SUPABASE_SERVICE_KEY → your Supabase service_role key (NOT the anon key)
//   NASSA_API_KEY       → any secret string, must match apiKey in app.js CLOUD object

const { createClient } = require('@supabase/supabase-js');

// Lazy-init so cold starts don't fail if env vars aren't set yet
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    }
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _supabase;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check — shared secret between browser and this function
  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = req.method === 'GET'
    ? req.query.user
    : req.body?.user;

  if (!user) return res.status(400).json({ error: 'Missing user' });

  try {
    const supabase = getSupabase();

    // GET → load project data for this user
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('data, updated_at')
        .eq('user_id', user)
        .maybeSingle(); // returns null instead of error when row doesn't exist

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        data: data?.data ?? null,
        updatedAt: data?.updated_at ?? null
      });
    }

    // POST → save/update project data for this user
    if (req.method === 'POST') {
      const { data: projectData } = req.body;

      if (projectData === undefined) {
        return res.status(400).json({ error: 'Missing data in body' });
      }

      const { error } = await supabase
        .from('projects')
        .upsert(
          { user_id: user, data: projectData, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[api/project]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
